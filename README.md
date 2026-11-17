# 🎄 Chrismas Calendar — un calendrier de l'Avent qui se joue comme un jeu mobile

Un calendrier de l'Avent web pour **deux personnes à distance**. Le monde est en **isométrique** : une route enneigée descend d'îlot en îlot (montagnes, village de Saint-Nicolas, lac gelé, marché de Noël, grotte de glace, pôle Nord). Chaque jour, une nouvelle case s'ouvre : mini-jeux, jeux en direct à deux, défis photo, et des cases que chacun prépare pour l'autre.

Le guide s'appelle **Pingou**, un petit pingouin qui vous accompagne tout le long du chemin.

## Stack

| Rôle | Outil |
|---|---|
| Monde isométrique, météo, mini-jeux | [PixiJS](https://pixijs.com) 8 |
| Interface (cases, éditeur, connexion) | React 19 + TypeScript |
| Animations | GSAP |
| Musique générée dans le navigateur | Tone.js *(à venir)* |
| Comptes, photos, temps réel | Supabase *(à venir, optionnel : mode démo sans backend)* |
| Build et hébergement | Vite, GitHub Pages via GitHub Actions |

## Lancer en local

```bash
npm install
npm run dev
```

Pour tester un jour précis : `http://localhost:5173/?jour=12`.

## Structure

```
src/
  world/      # moteur du monde isométrique
    iso.ts      projection 2:1 et primitives (pavés, toits, pyramides, sapins)
    props.ts    décors vectoriels (maisons, chalets, stands, grande roue, cristaux…)
    zones.ts    les 6 mondes : couleurs jour/nuit, décors, météo
    layout.ts   génération de la route, des îlots et du placement des décors
    actors.ts   personnages et mascotte
    Scene.ts    scène Pixi : caméra liée au défilement, neige, cases
  ui/         # interface React (mascotte, cartes…)
  data/       # planning des 24 jours
```

## Déploiement

Chaque push sur `main` construit le site et le publie sur GitHub Pages (`.github/workflows/deploy.yml`).
Dans le dépôt : **Settings → Pages → Source : GitHub Actions**.
