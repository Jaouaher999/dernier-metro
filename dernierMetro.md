
# Projet Dernier Metro — Paris (Brief formateur)

Ce mini-projet simule un service qui aide un usager a decider s'il attrapera le **dernier metro** a Paris. Il sert de fil rouge pour introduire Express, Docker et Compose/Swagger.

## 1) Storytelling et contexte (script)
- "Imaginez Lina, 00:58, elle sort d'un concert a Chatelet. Elle doit prendre la ligne 1. A-t-elle le temps d'attraper le **dernier metro** ?"
- "Nous allons construire une petite API qui repond en quelques millisecondes avec la prochaine rame et si c'est la derniere. Pas de donnees temps reel: on simule des horaires pour se concentrer sur les fondamentaux backend et la containerisation."

Message cle: un probleme concret, une solution minime mais professionnelle, testable partout.

## 2) Portee du MVP (J1)
- Endpoints:
  - GET `/health` -> 200 { status: "ok" }
  - GET `/next-metro?station=NAME` -> 200 JSON avec: station, line, headwayMin, nextArrival (HH:MM), isLast (bool), tz (Europe/Paris)
- Erreurs et UX API:
  - 400 si `station` manquante -> { error }
  - 404 catch-all JSON -> { error }
- Non-fonctionnel:
  - Logs par requete (methode, chemin, status, duree)
  - PORT via ENV
  - Reponses JSON uniquement
  - Dockerfile.v1 + .dockerignore

## 3) Modele metier simplifie
- Plage de service: 05:30 -> 01:15 (fictif).  
- Frequence (headway): 3 minutes.  
- `isLast = true` entre 00:45 et 01:15.  
- Hors plage: au choix, renvoyer 200 `{ service: "closed" }` ou 204; fixer le comportement et le documenter.

Pseudo-code de calcul:
```js
function nextArrival(now = new Date(), headwayMin = 3) {
  const tz = 'Europe/Paris';
  const toHM = d => String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  const end = new Date(now); end.setHours(1,15,0,0);         // 01:15
  const lastWindow = new Date(now); lastWindow.setHours(0,45,0,0); // 00:45
  if (now > end) return { service: 'closed', tz };
  const next = new Date(now.getTime() + headwayMin*60*1000);
  return { nextArrival: toHM(next), isLast: now >= lastWindow, headwayMin, tz };
}
```

## 4) Exemples de reponses
```json
{"station":"Chatelet","line":"M1","headwayMin":3,"nextArrival":"12:34","isLast":false,"tz":"Europe/Paris"}
```
Erreurs:
```json
{"error":"missing station"}
```

## 5) Architecture cible (J1)
- Express (server.js) -> reponses JSON; middlewares (logs, 404).
- Dockerfile.v1 -> image Node 18-alpine, EXPOSE 3000, CMD node server.js.
- .dockerignore -> eviter node_modules, .git, logs, etc.
- (Apres-midi) Compose + Swagger UI -> documentation interactive.

## 6) Livrables & validation
- Repo avec `server.js`, `package.json`, `Dockerfile.v1`, `.dockerignore`, `README.md`.
- cURL de validation (`/health`, `/next-metro` 200/400) + logs visibles.

## 7) Barreme (suggestion, J1/Partie A)
- API base (routes, 404, logs) .............. 4
- Validation req.query + codes 200/400 ........ 2
- Dockerfile (+ .dockerignore) ................ 3
- README clair ................................ 1

## 8) Risques et pieges frequents (anti-bugs)
- Port deja pris -> changer mapping `-p 3001:3000`.
- `Cannot find module 'express'` -> `npm install`.
- Pas de reponse -> `next()` oublie dans le logger; mauvais port.
- Formats de temps -> ne pas utiliser toLocaleString (lent, variable) pour l'API; preferer HH:MM fixe.

## 9) Roadmap pedagogique
- Matin: API + Dockerfile.v1.  
- Apres-midi: mini-cours Docker/Compose/Swagger, ajout Swagger UI et spec OpenAPI minimale.

## 10) Script d'animation (extraits)
- Ouverture: "On va resoudre un vrai probleme d'usager nocturne avec une API minuscule."
- Pendant le live-coding: "Je code d'abord les reponses OK/erreurs, puis j'ajoute l'observabilite (logs)."
- Transition Docker: "Si ca marche chez moi, je veux la meme chose partout -> conteneur."
- Conclusion: "Vous avez une API testable localement et dans un conteneur. Cet apres-midi, on ajoute la doc et on orchestre." 

> Note: ce projet est pedagogique; les horaires et lignes sont simules. Aucune integration RATP temps reel n'est requise.
