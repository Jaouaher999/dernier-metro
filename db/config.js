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
}

module.exports = { pool, connectWithRetry, initSchemaAndSeed };
