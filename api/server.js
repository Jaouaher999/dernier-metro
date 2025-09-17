"use strict";

const express = require("express");
const { pool, connectWithRetry, initSchemaAndSeed } = require("./db/config");
const { computeNextMetro } = require("./computeNextMetro");

const app = express();

const ENV_HEADWAY_MIN = Number(process.env.HEADWAY_MIN || 3);
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

app.use((req, res, next) => {
  const t0 = Date.now();

  res.on("finish", () => {
    const t1 = Date.now();
    const duration = t1 - t0;
    console.log(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
  });
  next();
});

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
    const parsedN = Number(nParam);
    if (Number.isFinite(parsedN)) {
      n = Math.max(1, Math.min(5, Math.floor(parsedN)));
    }
  }

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

app.get("/last-metro", async (req, res) => {
  const station = req.query.station;
  if (!station) {
    return res.status(400).json({ error: "missing station" });
  }

  const normalized = String(station).trim();

  try {
    const existsResult = await pool.query(
      "SELECT 1 FROM stations WHERE LOWER(name)=LOWER($1) LIMIT 1",
      [normalized]
    );
    if (existsResult.rowCount === 0) {
      return res
        .status(404)
        .json({ error: "unknown station", station: normalized });
    }

    const config = await pool.query(
      "SELECT key, value FROM config WHERE key = ANY($1)",
      [["metro.defaults", "metro.last"]]
    );

    const asMap = new Map(config.rows.map((r) => [r.key, r.value]));
    const defaults = asMap.get("metro.defaults") || {};
    const lastMap = asMap.get("metro.last") || {};

    const line = defaults.line || "M1";
    const tz = defaults.tz || "Europe/Paris";

    let lastMetro = null;
    const entries = Object.entries(lastMap);
    for (const [name, value] of entries) {
      if (String(name).toLowerCase() === normalized.toLowerCase()) {
        lastMetro = String(value);
        break;
      }
    }

    if (!lastMetro) {
      return res
        .status(404)
        .json({ error: "unknown station", station: normalized });
    }

    return res.status(200).json({ station: normalized, lastMetro, line, tz });
  } catch (e) {
    console.error("/last-metro error:", e.message);
    return res.status(500).json({ error: "internal_error" });
  }
});

app.use((req, res, next) => {
  return res.status(404).json({
    error: "Route not found",
  });
});

(async () => {
  try {
    await connectWithRetry();
    await initSchemaAndSeed(KNOWN_STATIONS);
  } catch (err) {
    console.error("Database initialization failed:", err.message);
  }

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
})();

module.exports = app;
