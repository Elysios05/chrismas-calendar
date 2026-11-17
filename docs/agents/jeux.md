# Équipe Jeux

**Mission** : les activités des 24 cases, toutes conformes au contrat `GameModule` (`src/core/contracts.ts`).
**Dossiers** : `src/games/` (un sous-dossier par jeu), `src/data/` (contenu : questions, mots, souvenirs).

## Familles de jeux
- **Solo** : quiz (1), rébus emojis (7), pendu (15), mots croisés (17).
- **Score à battre** (PixiJS) : luge (2), attrape-flocons tempête (10), tri des cadeaux (22).
- **Différé** : défis photo croisés (3, 19), dessin à deviner (9).
- **En direct** (`backend.joinRoom`) : Pictionary (5), duel friandises (6), synchro quiz (11), bonhomme à deux (13),
  boules de neige (18), sapin à deux (21) — chacun avec **une version tour par tour** si l'autre n'est pas là.
- **Synchronisé** : biscuits + minuteur partagé (14), film lancé ensemble (23).

## À faire (par priorité)
1. **Cadre commun** : registre des jeux, chargement par jour, composants partagés (compte à rebours, score, écran de victoire).
2. Jeux solo → score à battre → différés → en direct (tester à deux onglets avec le mode démo).
3. Contenu d'exemple dans `src/data/` (facile à remplacer par Alexandre).

## Questions à poser à Alexandre
Règles et difficulté de chaque jeu, contenu à mettre (souvenirs, private jokes), durée des parties.

## Parler au chef de projet
**Par une issue GitHub, jamais autrement.** Tout ce qui sort de `src/games/` et `src/data/` passe par là :
contrat à changer, fichier d'une autre équipe à modifier, arbitrage, priorités. Le chef répond dans l'issue,
dit qui fait quoi et confie les fichiers par écrit ; la suite se discute en commentaires sous la même issue.
Avant de poser une question, relire les issues ouvertes (y compris celles des autres équipes : les réponses
du chef y annoncent souvent des changements de contrat qui nous concernent).

## Journal

### 17 novembre 2026 — cadre commun + jours 1 et 2 (branche `jeux/cadre-et-jours-1-2`)

**Décisions prises avec Alexandre :**
- **Quiz (jour 1)** : 10 questions à choix multiples, correction immédiate, pas de chrono.
  Les « bonnes » réponses ne sont pas écrites à l'avance : **chacun répond d'abord pour soi, puis devine l'autre**.
  Conséquence signalée à Alexandre et retenue : si l'autre n'a pas encore rempli ses réponses, pas de correction
  immédiate — Pingou annonce que le score arrivera plus tard. En mode démo, les réponses d'exemple de
  `src/data/games/quiz-jour1.ts` tiennent lieu de réponses de l'autre.
- **Luge (jour 2)** : descente longue (~2 min, 1900 m), pilotage **au glissement du doigt** (flèches ← → sur ordinateur).
  Ajouts décidés seul pour rendre la longueur supportable : 3 chocs permis, ligne d'arrivée avec bonus
  (300 + 200 par choc épargné), piste **tirée au sort à partir d'une graine** pour que les deux descendent
  exactement la même piste.

**Fait :**
- `src/games/registry.ts` : jour → jeu, chargé à la demande ; `contenuDuJour()` pour `GameContext.content`.
- `src/games/shared/` : cadre, barre de score, vies, points de progression, barre de progression, écrans de
  règles et de fin (`ui.tsx`), pont React↔`GameModule` (`monter.tsx`), base PixiJS + saisie (`scene.ts`),
  tirage reproductible (`alea.ts`), scores à battre via `BackendApi` (`scores.ts`), styles (`games.css`).
- `src/games/quiz/` et `src/games/luge/` (+ moteur PixiJS), contenu dans `src/data/games/`.
- `jeux.html` + `src/games/dev/` : atelier de test des jeux (hors site livré), avec un faux backend
  en localStorage en attendant `src/backend/`.

**Branchement du lanceur** : d'abord mis en attente (le 17 novembre, `src/backend/` et `src/audio/` n'existaient
pas et les bouchons auraient été du provisoire à jeter). Ces deux dossiers sont maintenant livrés, donc la
question est posée au chef dans l'issue #7 : qui appelle `<FenetreJeu />` et où (plutôt `src/ui/DayWindow.tsx`
que `src/App.tsx`), et qui fournit `backend` et `sound` à cet endroit. Le terrain est prêt côté jeux : `src/games/lanceur.tsx`
(`<FenetreJeu … />`, une ligne à poser dans la carte d'une case, qui gère chargement, contexte, fenêtre et
nettoyage) et la marche à suivre dans `src/games/README.md`. L'atelier de test passe par ce même lanceur.
À noter : `ctx.complete()` signifie « le joueur quitte le jeu » (la fenêtre se ferme), pas « la partie est finie ».

**Reste à faire :**
- Remplacer le faux backend d'atelier par le vrai mode démo quand `src/backend/` existe.
- Alexandre : remplacer les 10 questions d'exemple par les vraies.
- Suite : rébus (7), pendu (15), mots croisés (17), puis les scores à battre 10 et 22.
