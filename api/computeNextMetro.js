const ENV_HEADWAY_MIN = Number(process.env.HEADWAY_MIN || 3);
const ENV_LAST_WINDOW_START = process.env.LAST_WINDOW_START || "00:45";
const ENV_SERVICE_END = process.env.SERVICE_END || "01:15";

function parseHHMM(hhmm) {
  const [hh, mm] = hhmm.split(":").map(Number);
  return Number.isFinite(hh) && Number.isFinite(mm)
    ? { hh, mm }
    : { hh: 0, mm: 0 };
}

function computeNextMetro(now = new Date(), headwayMin = ENV_HEADWAY_MIN) {
  const tz = "Europe/Paris";

  const formatHM = (date) =>
    `${String(date.getHours()).padStart(2, "0")}:${String(date
      .getMinutes())
      .padStart(2, "0")}`;

  const serviceStart = new Date(now);
  serviceStart.setHours(5, 30, 0, 0);

  const { hh: endH, mm: endM } = parseHHMM(ENV_SERVICE_END);
  const serviceEnd = new Date(now);
  serviceEnd.setHours(endH, endM, 0, 0);

  const { hh: lastH, mm: lastM } = parseHHMM(ENV_LAST_WINDOW_START);
  const lastWindow = new Date(now);
  lastWindow.setHours(lastH, lastM, 0, 0);

  if (serviceEnd < serviceStart) serviceEnd.setDate(serviceEnd.getDate() + 1);
  if (lastWindow < serviceStart) lastWindow.setDate(lastWindow.getDate() + 1);

  if (now < serviceStart || now > serviceEnd) {
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

module.exports = { computeNextMetro };
