# Chrismas Calendar — règles du projet

Calendrier de l'Avent web pour **Alexandre et Flavie** (couple à distance), vécu comme un **jeu mobile** :
une route traverse un monde isométrique continu (montagnes, village de Saint-Nicolas, forêt et lac gelé,
marché de Noël, grotte de glace, pôle Nord). 24 cases, dont 6 préparées par chacun pour l'autre.
Mascotte : **Pingou**, un pingouin qui guide et parle dans une bulle.

**Échéance : tout doit être prêt et en ligne le 30 novembre 2026 au soir.**

## Langue
- On parle à Alexandre en **français**. Textes de l'interface en français. Code et noms de variables en anglais ou français, mais commentaires en français.

## Stack
React 19 + TypeScript (strict) + Vite · PixiJS 8 (monde et jeux d'adresse) · GSAP · Tone.js (audio) ·
Supabase (comptes, règles d'accès, photos, temps réel) avec **mode démo sans backend** · GitHub Pages.

## Équipes et dossiers
Chaque équipe ne modifie **que son dossier**. Toucher au dossier d'une autre équipe = demander d'abord.

| Équipe | Dossiers | Brief |
|---|---|---|
| Chef de projet | `src/core/`, `src/App.tsx`, `CLAUDE.md`, `docs/` | `docs/agents/chef.md` |
| Monde & design | `src/world/` | `docs/agents/monde.md` |
| Interface | `src/ui/`, `src/index.css` | `docs/agents/interface.md` |
| Backend | `src/backend/`, `supabase/`, `.github/` | `docs/agents/backend.md` |
| Jeux | `src/games/`, `src/data/` (contenu des jeux) | `docs/agents/jeux.md` |
| Audio | `src/audio/` | `docs/agents/audio.md` |
| Qualité | `tests/`, `docs/qa/` | `docs/agents/qualite.md` |

Les **contrats partagés** sont dans `src/core/contracts.ts` (BackendApi, SoundApi, GameModule…).
On code contre ces interfaces. Besoin d'un changement de contrat → le demander au chef de projet.

## Façon de travailler
1. **Une branche par tâche** : `<equipe>/<tache>` (ex. `monde/pics-montagne`). Jamais de commit direct sur `main`.
2. **Demander l'avis d'Alexandre** avant toute décision de goût ou de contenu (style, couleurs, textes, règles d'un jeu, comportement de Pingou) et dès qu'un choix est ambigu. Proposer 2–3 options concrètes avec une recommandation, plutôt qu'une question ouverte. Montrer des captures d'écran.
3. Les décisions techniques internes à ton dossier, tu les prends seul.
4. Avant de livrer : `npm run build` passe sans erreur, et tu as **regardé le résultat** (captures mobile 390×844 et ordinateur 1280×800).
   **Captures : utilise `npm run capture`** (voir `docs/qa/capture.md`, ex. `npm run capture -- --jour=12 --heure=21:00 --case=12`). N'écris pas ton propre script de capture ; s'il manque une option, demande-la à la Qualité par une issue.
5. **Pull request** vers `main` avec : ce qui change, captures, ce qui reste à faire. Le chef de projet relit et fusionne.
6. Messages de commit en français, à l'impératif présent.
7. Tenir à jour la section « Journal » de ton brief (`docs/agents/<equipe>.md`) : décisions prises avec Alexandre, et où tu en es.
8. **Liens de session privés** : n'écris **jamais** de lien de session (`claude.ai/code/session_…`) ni de ligne `Claude-Session:` dans un commit, une PR, une issue ou un commentaire (décision d'Alexandre, 26 nov). Garde seulement `Co-Authored-By`.
9. **N'utilise jamais `git stash`** : la pile est partagée entre toutes les copies de travail du dépôt. Fais un commit temporaire sur ta branche à la place.
10. **Parler au chef de projet = ouvrir une issue GitHub.** C'est le seul canal : les équipes ne se voient pas entre elles.
11. **Questions pour Alexandre** quand il n'est pas dans ta conversation (équipes en arrière-plan) : commente le ticket **#59 « Questions pour Alexandre »**, avec 2–3 options et ta recommandation. Dans une session directe avec lui, pose-lui la question directement.

## Parler au chef de projet
Pour tout ce qui sort de ton dossier — changement de contrat dans `src/core/contracts.ts`, besoin qu'une autre
équipe livre quelque chose, fichier à modifier qui ne t'appartient pas, arbitrage, ordre des priorités —
**ouvre une issue GitHub** sur le dépôt. Le chef y répond, dit qui fait quoi et à qui il confie le fichier ;
la discussion continue en commentaires sous la même issue. Avant de demander, **va d'abord relire les issues
ouvertes** : la réponse qui te concerne est peut-être déjà là, y compris dans l'issue d'une autre équipe.

Une issue utile tient en trois points : où tu en es, ce qui te bloque précisément, et 2–3 options avec ta
recommandation. N'attends pas la réponse les bras croisés : fais tout ce qui ne dépend pas de l'arbitrage,
et reviens lire l'issue ensuite. Ne touche jamais au dossier d'une autre équipe avant que le chef te l'ait
confié par écrit dans l'issue.

## Économiser le contexte (et la limite d'utilisation)
- **Tout ce qui compte vit dans le dépôt**, pas dans la conversation : ce fichier, ton brief et son **Journal**, les issues, les PR. Une session neuve doit pouvoir reprendre ton travail en lisant ces fichiers.
- **À la fin de chaque tâche** (PR ouverte), **obligatoirement** : 1) mets à jour ton Journal (où tu en es, décisions d'Alexandre, prochaine étape, tout ce dont une session neuve aurait besoin) ; 2) commite-le ; 3) termine ton message par cette ligne, seule et en gras : **« ✅ Journal à jour — tu peux taper `/clear` maintenant. »** Ne la dis jamais si le journal n'est pas commité. Une nouvelle tâche = une conversation propre, qui repart de ce fichier et de ton Journal.
- Si une tâche devient longue (beaucoup d'échanges, de captures ou de gros fichiers lus), arrête-toi à une étape propre, mets le Journal à jour, et dis : **« 📦 Point d'étape enregistré — tu peux taper `/clear`, je reprendrai depuis mon Journal. »**
- Au milieu d'une longue tâche, s'il le faut, propose `/compact` plutôt que de traîner tout l'historique.
- **Lis le moins possible** : cherche (`grep`) avant d'ouvrir un fichier, n'ouvre que les lignes utiles, ne recopie pas de longs résultats de commandes, ne refais pas de captures inutiles.

## Lancer et tester
```bash
npm install
npm run dev            # http://localhost:5173/?jour=12 pour simuler un jour
npm run build
```

## Le planning des 24 jours
Voir `src/data/planning.ts` et `docs/cahier-des-charges.md`.
