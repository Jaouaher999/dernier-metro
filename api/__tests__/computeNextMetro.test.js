const { computeNextMetro } = require("../computeNextMetro");

const ENV_HEADWAY_MIN = 3;
const ENV_LAST_WINDOW_START = "00:45";
const ENV_SERVICE_END = "01:15";

// Mock parseHHMM pour éviter dépendance
const parseHHMM = (str) => {
  const [hh, mm] = str.split(":").map(Number);
  return { hh, mm };
};

describe("computeNextMetro", () => {
  const fixedNow = new Date("2023-03-10T12:00:00+01:00"); // Europe/Paris

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(fixedNow);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test("headway = 3 → ajoute +3 minutes", () => {
    const result = computeNextMetro(new Date(), 3);
    expect(result.nextArrival).toBe("12:03"); // 12:00 + 3min
    expect(result.headwayMin).toBe(3);
  });

  test("headway non passé → utilise valeur par défaut (3)", () => {
    const result = computeNextMetro(new Date());
    expect(result.nextArrival).toBe("12:03");
    expect(result.headwayMin).toBe(3);
  });

  test("headway invalide (<=0) → retourne null", () => {
    const result = computeNextMetro(new Date(), 0);
    expect(result.nextArrival).toBeNull(); // comportement choisi
  });
});
