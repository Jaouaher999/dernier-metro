"use strict";

const express = require("express");
const { Pool } = require("pg");

const app = express();

const ENV_HEADWAY_MIN = Number(process.env.HEADWAY_MIN || 3);
const ENV_LAST_WINDOW_START = String(process.env.LAST_WINDOW_START || "00:45");
const ENV_SERVICE_END = String(process.env.SERVICE_END || "01:15");
const PORT = process.env.PORT || 3000;

const KNOWN_STATIONS = [
  "Chatelet",
  "La Defense",
  "Bastille",
  "Gare de Lyon",
  "Nation",
];

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  return next();
});

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : undefined
);

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry(maxAttempts = 10, backoffMs = 1000) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      await pool.query("SELECT 1");
      console.log("PostgreSQL connected");
      return;
    } catch (err) {
      console.warn(
        `PostgreSQL connection failed (attempt ${attempt}/${maxAttempts}): ${err.message}`
      );
      if (attempt >= maxAttempts) {
        throw err;
      }
      await delay(backoffMs);
    }
  }
}

async function initSchemaAndSeed() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS stations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    )`
  );
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM stations"
  );
  if (rows[0] && rows[0].count === 0) {
    for (const name of KNOWN_STATIONS) {
      await pool.query(
        "INSERT INTO stations(name) VALUES($1) ON CONFLICT(name) DO NOTHING",
        [name]
      );
    }
    console.log("Seeded stations table");
  }
}

app.use((req, res, next) => {
  const t0 = Date.now();

  res.on("finish", () => {
    const t1 = Date.now();
    const duration = t1 - t0;
    console.log(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
  });
  next();
});

function parseHHMM(hhmm) {
  const [hh, mm] = String(hhmm)
    .split(":")
    .map((s) => Number(s));
  if (
    Number.isFinite(hh) &&
    Number.isFinite(mm) &&
    hh >= 0 &&
    hh <= 23 &&
    mm >= 0 &&
    mm <= 59
  ) {
    return { hh, mm };
  }
  return null;
}

function computeNextMetro(now = new Date(), headwayMin = ENV_HEADWAY_MIN) {
  const tz = "Europe/Paris";
  const formatHM = (d) =>
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0");

  const serviceStartToday = new Date(now);
  serviceStartToday.setHours(5, 30, 0, 0);

  const addDays = (d, days) => {
    const r = new Date(d);
    r.setDate(r.getDate() + days);
    return r;
  };

  let serviceStart;
  let lastWindow;
  let serviceEnd;

  if (now >= serviceStartToday) {
    serviceStart = serviceStartToday;
    lastWindow = new Date(now);
    const parsedLast = parseHHMM(ENV_LAST_WINDOW_START) || { hh: 0, mm: 45 };
    lastWindow.setHours(parsedLast.hh, parsedLast.mm, 0, 0); // LAST_WINDOW_START
    lastWindow = addDays(lastWindow, 1);

    serviceEnd = new Date(now);
    const parsedEnd = parseHHMM(ENV_SERVICE_END) || { hh: 1, mm: 15 };
    serviceEnd.setHours(parsedEnd.hh, parsedEnd.mm, 0, 0); // SERVICE_END
    serviceEnd = addDays(serviceEnd, 1);
  } else {
    serviceStart = addDays(serviceStartToday, -1); // yesterday 05:30

    lastWindow = new Date(now);
    const parsedLast = parseHHMM(ENV_LAST_WINDOW_START) || { hh: 0, mm: 45 };
    lastWindow.setHours(parsedLast.hh, parsedLast.mm, 0, 0); // today LAST_WINDOW_START

    serviceEnd = new Date(now);
    const parsedEnd = parseHHMM(ENV_SERVICE_END) || { hh: 1, mm: 15 };
    serviceEnd.setHours(parsedEnd.hh, parsedEnd.mm, 0, 0); // today SERVICE_END
  }

  const isOpen = now >= serviceStart && now <= serviceEnd;
  if (!isOpen) {
    return { service: "closed", tz };
  }

  const next = new Date(now.getTime() + headwayMin * 60 * 1000);
  return {
    nextArrival: formatHM(next),
    isLast: now >= lastWindow && now <= serviceEnd,
    headwayMin,
    tz,
  };
}

app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT 1 as TEST");
    return res.status(200).json({ status: "ok", result: result.rows[0] });
  } catch (e) {
    return res
      .status(500)
      .json({ status: "degraded", error: "db_unreachable" });
  }
});

app.get("/stations", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT name FROM stations ORDER BY name ASC"
    );
    const names = result.rows.map((r) => r.name);
    return res.status(200).json(names);
  } catch (e) {
    return res.status(500).json({ error: "db_error" });
  }
});

app.get("/next-metro", async (req, res) => {
  const station = req.query.station;
  const nParam = req.query.n;

  if (!station) {
    return res.status(400).json({
      error: "missing station",
    });
  }

  const normalized = String(station).trim();

  try {
    const existsResult = await pool.query(
      "SELECT 1 FROM stations WHERE LOWER(name)=LOWER($1) LIMIT 1",
      [normalized]
    );
    const exists = existsResult.rowCount > 0;
    if (!exists) {
      const suggestionsResult = await pool.query(
        "SELECT name FROM stations ORDER BY name ASC"
      );
      const suggestions = suggestionsResult.rows.map((r) => r.name);
      return res.status(404).json({
        error: "unknown station",
        station: normalized,
        suggestions,
      });
    }
  } catch (e) {
    return res.status(500).json({ error: "db_error" });
  }

  const headway = ENV_HEADWAY_MIN;
  const now = new Date();
  const calc = computeNextMetro(now, headway);

  if (calc.service === "closed") {
    return res.status(200).json({ ...calc });
  }

  let n = 1;
  if (typeof nParam !== "undefined") {
    const asNum = Number(nParam);
    if (Number.isFinite(asNum)) n = Math.floor(asNum);
  }
  if (n < 1) n = 1;
  if (n > 5) n = 5;

  const result = {
    station: String(station),
    line: "M1",
    headwayMin: calc.headwayMin,
    tz: calc.tz,
  };

  if (n > 1) {
    const arrivals = [];
    let t = new Date(now);
    for (let i = 0; i < n; i++) {
      const c = computeNextMetro(t, headway);
      if (c.service === "closed") break;
      arrivals.push({ time: c.nextArrival, isLast: c.isLast });
      t = new Date(t.getTime() + headway * 60 * 1000);
    }
    result.arrivals = arrivals;
  } else {
    result.nextArrival = calc.nextArrival;
    result.isLast = calc.isLast;
  }

  return res.status(200).json(result);
});

app.use((req, res, next) => {
  return res.status(404).json({
    error: "Route not found",
  });
});

(async () => {
  try {
    await connectWithRetry();
    await initSchemaAndSeed();
  } catch (err) {
    console.error("Database initialization failed:", err.message);
  }

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
})();
