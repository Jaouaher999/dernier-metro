"use strict";

const { Pool } = require("pg");

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

async function initSchemaAndSeed(knownStations) {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS stations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    )`
  );
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM stations"
  );
  if (rows[0] && rows[0].count === 0 && Array.isArray(knownStations)) {
    for (const name of knownStations) {
      await pool.query(
        "INSERT INTO stations(name) VALUES($1) ON CONFLICT(name) DO NOTHING",
        [name]
      );
    }
    console.log("Seeded stations table");
  }

  // Config table
  await pool.query(
    `CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL
    )`
  );

  // Seed defaults
  const defaultsKey = "metro.defaults";
  const lastKey = "metro.last";

  const defaultsExists = await pool.query("SELECT 1 FROM config WHERE key=$1", [
    defaultsKey,
  ]);
  if (defaultsExists.rowCount === 0) {
    const defaultsValue = { line: "M1", tz: "Europe/Paris" };
    await pool.query("INSERT INTO config(key, value) VALUES($1, $2::jsonb)", [
      defaultsKey,
      JSON.stringify(defaultsValue),
    ]);
    console.log("Seeded config: metro.defaults");
  }

  const lastExists = await pool.query("SELECT 1 FROM config WHERE key=$1", [
    lastKey,
  ]);
  if (lastExists.rowCount === 0) {
    const lastValue = {};
    if (Array.isArray(knownStations)) {
      for (const name of knownStations) {
        lastValue[name] = "01:15";
      }
    }
    await pool.query("INSERT INTO config(key, value) VALUES($1, $2::jsonb)", [
      lastKey,
      JSON.stringify(lastValue),
    ]);
    console.log("Seeded config: metro.last");
  }
}

module.exports = { pool, connectWithRetry, initSchemaAndSeed };
