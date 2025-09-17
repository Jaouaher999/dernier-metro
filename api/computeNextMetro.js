const ENV_HEADWAY_MIN = Number(process.env.HEADWAY_MIN || 3);
const ENV_LAST_WINDOW_START = String(process.env.LAST_WINDOW_START || "00:45");
const ENV_SERVICE_END = String(process.env.SERVICE_END || "01:15");

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

  if (headwayMin <= 0) {
    return { nextArrival: null, headwayMin, tz };
  }

  const next = new Date(now.getTime() + headwayMin * 60 * 1000);
  return {
    nextArrival: formatHM(next),
    isLast: now >= lastWindow && now <= serviceEnd,
    headwayMin,
    tz,
  };
}

module.exports = { computeNextMetro };
