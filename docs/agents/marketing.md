# Brief — équipe Marketing

## Rôle
Faire connaître le calendrier sur TikTok (compte dédié, ni visage ni voix) : vidéos verticales 9:16 de 15 à 30 s
qui montrent le **vrai site** en action, avec un appel clair à créer son propre calendrier.

## Dossiers
`docs/marketing/` (stratégie, scripts, outils, montage, vidéos) et ce brief. Rien d'autre : pas de `src/`, ni `tests/`.
Besoin d'une option du site ou de `npm run capture` → le noter ci-dessous (le chef ouvre les issues).

## Règles absolues
- **Salon fictif « Sam & Camille » uniquement.** Les vrais prénoms du couple et sa ville ne doivent apparaître
  nulle part (image, texte, nom de fichier) : la personne qui reçoit le calendrier ne doit pas découvrir la surprise.
  `filmer.mjs` vérifie le texte de la page ; relire en plus chaque planche-contact.
- Pas de musique sous droits : la musique vient du site (Tone.js, `src/audio/`), rendue hors ligne.
- MP4 livrés : H.264 CRF 23 `veryfast`, ≤ 8 Mo. Images brutes hors dépôt (`/tmp/film/`).
- Port des captures : `QA_PORT=4199`.

## Outils (voir `docs/marketing/montage/README.md`)
- `docs/marketing/outils/filmer.mjs` : tournage image par image du site (ticker PixiJS piloté → fluide même sous
  SwiftShader). Plans : `zones`, `monde`, `surprise`, `case` (`--jour=N`), `makingof`. `--propre` = sans texte,
  avec `marques.json` (images clés).
- `docs/marketing/outils/rushes.mjs`, `musique.mjs`, `rendre.mjs` ; montage Remotion dans `docs/marketing/montage/`.
- **Tout refaire : `cd docs/marketing/montage && npm install && npm run videos`** (≈ 45 min).

## Journal

### 28 nov — trois vidéos montées avec Remotion (branche `chef/marketing-videos`)
- Constat d'Alexandre : la 1re vidéo (simple défilement du monde) « pas du tout impactante ».
- Fait : chaîne complète rushes → montage → rendu, relancable en une commande quand le monde sera figé.
  - `filmer.mjs` : mode `--propre` (textes faits au montage), images clés `marques.json`, nouveau plan `zones`
    (un plan de 2,2 s par monde avec zoom, + la nuit qui tombe au marché), pilote automatique du quiz.
  - Montage Remotion (`docs/marketing/montage/`) : plans de 1 à 2 s, coupes franches avec coup de zoom,
    titres en étiquettes (façon légende TikTok), pastilles de lieux/jeux, carte de fin bleu nuit (grille du
    calendrier, Pingou, « C'est gratuit », adresse). Charte : `montage/design.md` (skill `video-design`).
  - Son : bruitages du site sur les coupes ; version `-musique` avec un morceau du site (cosy / marché / action).
- Vidéos (`docs/marketing/videos/`) : `1-surprise` (POV : un secret dans la case 4 → lettre → billet),
  `2-monde` (les six mondes, la nuit, le traîneau qui s'envole), `3-jeux` (luge, Pingou et les flocons, quiz).
  Puis `4-demain` (S3 « J-1 : le 1er décembre, c'est demain », à poster le 30 nov ; aucun nouveau rush).
  Chacune en version sans musique (pour le son tendance de TikTok) et `-musique`, + planche dans `videos/planches/`.
- Relecture (critique `video-design`, planches-contact) : corrigé les titres à contour illisibles (→ étiquettes),
  les bandes vides après recadrage, les plans où le sujet sortait du cadre, la carte de fin figée (Pingou bouge,
  durée 3,2 s), la grille sous le texte.
- Remarques techniques : Remotion ne peut pas télécharger son navigateur (hôte bloqué) → Chrome du système
  (`remotion.config.ts`). La musique passe par `audio-demo.html` servi par Vite (port 4198).

### 28 nov (soir) — vidéo 5 « copine » et adresse paramétrable (branche `marketing/video-copine`)
- `5-copine` (+ `-musique`, planche) : POV écrit « Regardez ce que mon copain m'a fait 🥹 » → lettre, « je pleure 😭 », photo-souvenir, jeux, nuit + bulles de message, fin « Fais-le pour ta moitié. » (`montage/src/videos/Copine.tsx`, aucun nouveau rush).
- Adresse de la carte de fin : une seule source `montage/src/lien.ts` (défaut vide = « Lien en bio 👆 »), ou `LIEN_SITE=… npm run rendre` ; vidéos 1 à 4 re-rendues sans adresse GitHub. Reste : relecture critique `video-design` complète non faite (arrêt anticipé, quota), choix du domaine par Alexandre.

### Décisions à demander à Alexandre (via le chef)
- Les textes des vidéos (accroches, « Offre-le à ta moitié », « même à 800 km ») et le choix des morceaux.
- Garder ou non les bruitages dans la version « sans musique ».

### Reste à faire
- Vidéos 5 et 6 : making-of S6/S7 (le plan `makingof` de filmer.mjs existe, à porter en Remotion ; vérifier
  qu'aucune page GitHub filmée ne montre de vrai prénom), ou une version « assistant de création » (S3) si
  l'on filme l'assistant avec le salon fictif.
- PR brouillon : #156.
- Le jeu de luge filmé est un peu vide (piste blanche) : un pilote qui ramasse des cadeaux rendrait mieux.
- Option utile côté Qualité : `npm run capture` n'a pas de mode « jeu ouvert » ni de pilote automatique
  (contourné dans `filmer.mjs`).
- Quand le monde sera figé : `npm run videos`, puis relire les planches (cadrages `zoom/origine/glisse`).
