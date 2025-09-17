const request = require("supertest");
const app = require("../server");
const { pool, initSchemaAndSeed } = require("../db/config");


beforeAll(async () => {
  await initSchemaAndSeed([
    "Chatelet",
    "La Defense",
    "Bastille",
    "Gare de Lyon",
    "Nation",
  ]);
});

afterAll(async () => {
  await pool.end();
});

describe("/last-metro", () => {
  it("200 avec station connue (case insensitive)", async () => {
    const res = await request(app).get("/last-metro?station=chatelet");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("station", "chatelet");
    expect(res.body).toHaveProperty("lastMetro");
    expect(res.body).toHaveProperty("line", "M1");
    expect(res.body).toHaveProperty("tz", "Europe/Paris");
  });

  it("404 avec station inconnue", async () => {
    const res = await request(app).get("/last-metro?station=Inconnue");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "unknown station");
  });

  it("400 sans station", async () => {
    const res = await request(app).get("/last-metro");
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "missing station");
  });
});

describe("/next-metro", () => {
  it("200 avec station connue retourne nextArrival", async () => {
    const res = await request(app).get("/next-metro?station=Chatelet");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("nextArrival");

    expect(res.body.nextArrival).toMatch(/^\d{2}:\d{2}$/);
  });
});
