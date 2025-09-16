# Dernier Metro API

## Run locally

```bash
npm install
npm start
```

- Health: `GET http://localhost:3000/health`
- Next metro (200): `GET http://localhost:3000/next-metro?station=Chatelet`
- Missing station (400): `GET http://localhost:3000/next-metro`

### Configuration via environment variables

- `HEADWAY_MIN` (default: `3`) — Frequency in minutes
- `LAST_WINDOW_START` (default: `00:45`) — When `isLast` starts, format `HH:MM`
- `SERVICE_END` (default: `01:15`) — Service end, format `HH:MM`

Examples (PowerShell):

```powershell
$env:HEADWAY_MIN=5; $env:LAST_WINDOW_START="00:40"; $env:SERVICE_END="01:20"; npm start
```

Examples (Docker):

```bash
docker run --rm -p 3000:3000 \
  -e HEADWAY_MIN=5 \
  -e LAST_WINDOW_START=00:40 \
  -e SERVICE_END=01:20 \
  dernier-metro:v1
```

## Docker

```bash
docker build -f Dockerfile.v1 -t dernier-metro:v1 .
# Map host port 3001 -> container 3000 if 3000 is busy
docker run --rm -p 3000:3000 dernier-metro:v1
```

## Example responses

```json
{
  "station": "Chatelet",
  "line": "M1",
  "headwayMin": 3,
  "nextArrival": "12:34",
  "isLast": false,
  "tz": "Europe/Paris"
}
```

```json
{ "error": "missing station" }
```

## API details

### GET /next-metro?station=NAME

- Returns the next arrival and metadata for `station`.
- Service window is computed in `Europe/Paris` timezone, daily from 05:30 to next-day `SERVICE_END` (default 01:15). `isLast` becomes true from `LAST_WINDOW_START` (default 00:45) until service end.

### Multiple next arrivals (Challenge B)

`GET /next-metro?station=NAME&n=3`

- Optional `n` (1..5). If provided and >1, response includes `arrivals` as objects with time and isLast.
- If `n` is absent or 1, only `nextArrival` and `isLast` are returned (original behavior).

Example (n=3):

```json
{
  "station": "Chatelet",
  "line": "M1",
  "headwayMin": 3,
  "tz": "Europe/Paris",
  "arrivals": [
    { "time": "12:34", "isLast": false },
    { "time": "12:37", "isLast": false },
    { "time": "12:40", "isLast": false }
  ]
}
```

### Station validation + suggestions (Challenge C)

- If `station` is unknown, returns 404:

```json
{
  "error": "unknown station",
  "station": "Chate",
  "suggestions": [
    "Chatelet",
    "La Defense",
    "Bastille",
    "Gare de Lyon",
    "Nation"
  ]
}
```

- Suggestions are a basic list of known stations to help the user correct input.
