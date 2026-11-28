# Montage des vidéos TikTok (Remotion)

Principe : **rushes = le vrai site filmé** image par image (`../outils/filmer.mjs`, salon fictif « Sam & Camille »),
**montage = Remotion** (ce dossier : coupes, zooms, textes, carte de fin), **son = la musique Tone.js du site**
rendue hors ligne (`../outils/musique.mjs`). Charte : [`design.md`](design.md).

## Tout refaire en une commande (quand le monde aura changé)

```bash
cd docs/marketing/montage
npm install          # une fois (node_modules est ignoré par git)
npm run videos       # = rushes + musique + rendre  (≈ 45 min sur 2 cœurs)
```

| Commande | Ce qu'elle fait | Durée (2 cœurs) |
|---|---|---|
| `npm run rushes` | reconstruit le site si besoin, filme les 6 rushes (`zones`, `monde`, `surprise`, `luge`, `flocons`, `quiz`) dans `/tmp/film/rushes/`, les encode dans `public/rushes/` et copie leurs images clés dans `src/rushes/*.json` | ≈ 35 min |
| `npm run rushes -- --seulement=zones,monde` | refait seulement certains rushes | |
| `npm run musique` | rend 3 morceaux et quelques bruitages du site dans `public/audio/` (Vite sur le port 4198) | ≈ 2 min |
| `npm run rendre` | rend les vidéos dans `../videos/` (sans musique + `-musique`) et leurs planches-contact | ≈ 2 min par vidéo |
| `npm run rendre -- --seulement=monde` | une seule vidéo | |
| `npm run studio` | Remotion Studio, pour prévisualiser et retoucher | |

Le serveur des captures utilise le port **4199** (`QA_PORT`) pour ne pas gêner les autres équipes.
Remotion ne peut pas télécharger son navigateur ici : `remotion.config.ts` prend `/usr/bin/google-chrome`
(variable `REMOTION_CHROME` pour un autre chemin).

## L'adresse du site sur la carte de fin

Une seule source : **`src/lien.ts`** (`LIEN_PAR_DEFAUT`). Par défaut elle est **vide** : la carte de fin dit
seulement « Lien en bio 👆 » (pas d'adresse GitHub, en attendant le choix d'un nom de domaine).

- **Changer l'adresse pour de bon** : mettre par ex. `export const LIEN_PAR_DEFAUT = "notre-calendrier.fr";`
  dans `src/lien.ts`, puis `npm run rendre` (re-rend les 5 vidéos, ≈ 10 min ; rushes et musique inchangés).
  Une adresse avec un « / » est coupée sur deux lignes après le premier « / » ; « (lien en bio) » s'affiche dessous.
- **Juste le temps d'un rendu**, sans toucher au fichier : `LIEN_SITE=notre-calendrier.fr npm run rendre`
  (`LIEN_SITE= npm run rendre` = aucune adresse). `rendre.mjs` la passe aux compositions (`--props`).
- Vérifier une seule image : `npx remotion still copine /tmp/fin.png --frame=470 --props='{"lien":"notre-calendrier.fr"}'`.

## Les coupes suivent le site
Chaque rush écrit ses **images clés** (`src/rushes/<rush>.json` : toucher du cadeau, enveloppe, lettre, début du jeu,
début de chaque monde, envol du traîneau…). Les compositions coupent sur ces repères : si une animation du site
dure plus ou moins longtemps, le montage suit. Si le monde change beaucoup (nouveaux lieux, cadrages), revoir
les cadrages (`zoom`, `origine`, `glisse` des `<Plan>`) dans `src/videos/*.tsx` en regardant les planches-contact.

## Fichiers
- `src/commun.tsx` : briques (Plan filmé + caméra, Titre, Pastille, Bruit, carte de Fin), charte.
- `src/videos/Surprise.tsx`, `Monde.tsx`, `Jeux.tsx`, `Demain.tsx`, `Copine.tsx` : les vidéos 1 à 5.
- `src/lien.ts` : l'adresse affichée sur la carte de fin (voir plus haut).
- `public/fonts/` : Fredoka (licence OFL), `public/pingou.svg` : icône de l'appli.
- `../outils/filmer.mjs` (plans), `../outils/rushes.mjs`, `../outils/musique.mjs`, `../outils/rendre.mjs`.

## Règle absolue
Uniquement le salon fictif **Sam & Camille**. `filmer.mjs` échoue si un vrai prénom ou la ville du couple apparaît
dans le texte de la page ; relire quand même chaque planche-contact avant de publier.
