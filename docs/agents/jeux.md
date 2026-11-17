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

## Journal
