# Dernier Metro API

## Run locally

```bash
npm install
npm start
```

- Health: `GET http://localhost:3000/health`
- Next metro (200): `GET http://localhost:3000/next-metro?station=Chatelet`
- Missing station (400): `GET http://localhost:3000/next-metro`

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
