"use strict";

const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  const t0 = Date.now();

  res.on("finish", () => {
    const t1 = Date.now();
    const duration = t1 - t0;
    console.log(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
  });
  next();
});

app.get("/health", (req, res) => {
  return res.status(200).json({
    status: "ok",
  });
});

function computeNextMetro(now = new Date(), headwayMin = 3) {
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
    lastWindow.setHours(0, 45, 0, 0); // 00:45 
    lastWindow = addDays(lastWindow, 1);

    serviceEnd = new Date(now);
    serviceEnd.setHours(1, 15, 0, 0); // 01:15
    serviceEnd = addDays(serviceEnd, 1);
  } else {
    serviceStart = addDays(serviceStartToday, -1); // yesterday 05:30

    lastWindow = new Date(now);
    lastWindow.setHours(0, 45, 0, 0); // today 00:45

    serviceEnd = new Date(now);
    serviceEnd.setHours(1, 15, 0, 0); // today 01:15
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

app.get("/next-metro", (req, res) => {
  const station = req.query.station;

  if (!station) {
    return res.status(400).json({
      error: "missing station",
    });
  }

  const calc = computeNextMetro(new Date(), 3);

  if (calc.service === "closed") {
    return res.status(200).json({ ...calc });
  }

  const result = {
    station: String(station),
    line: "M1",
    headwayMin: calc.headwayMin,
    nextArrival: calc.nextArrival,
    isLast: calc.isLast,
    tz: calc.tz,
  };

  return res.status(200).json(result);
});

app.use((req, res, next) => {
  return res.status(404).json({
    error: "Route not found",
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
