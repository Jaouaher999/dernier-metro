const { computeNextMetro } = require("../computeNextMetro");

describe("computeNextMetro", () => {
  let fixedNow = new Date("2023-03-10T12:56:00+01:00"); // Europe/Paris

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(fixedNow);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test("headway = 3 → ajoute +3 minutes", () => {
    const result = computeNextMetro(new Date(), 3);
    expect(result.nextArrival).toBe("12:59");
    expect(result.headwayMin).toBe(3);
  });

  test("headway non passé → utilise valeur par défaut (3)", () => {
    const result = computeNextMetro(new Date());
    expect(result.nextArrival).toBe("12:59");
    expect(result.headwayMin).toBe(3);
  });

  test("headway = 5 →  (wrap d'heure)", () => {
    const result = computeNextMetro(new Date(), 5);
    expect(result.nextArrival).toBe("13:01");
    expect(result.headwayMin).toBe(5);
  });

  test("headway invalide (<=0) → retourne null", () => {
    const result = computeNextMetro(new Date(), 0);
    expect(result.nextArrival).toBe("12:56");
    expect(result.headwayMin).toBe(0);
  });
});
