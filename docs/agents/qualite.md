# Équipe Qualité

**Mission** : vérifier que tout marche vraiment, sur téléphone et sur ordinateur, sans avoir écrit le code testé.
**Dossiers** : `tests/`, `docs/qa/`.

## À faire
1. Script de captures automatiques (Playwright) : mobile 390×844 et ordinateur 1280×800, à plusieurs jours (`?jour=N`) et en mode nuit.
2. Tests de bout en bout : ouvrir une case, finir un jeu, préparer une case, jeu en direct à deux onglets (mode démo).
3. Relire chaque pull request : build, captures avant/après, performance (images/s), console sans erreur.
4. Rapport dans la pull request + `docs/qa/` ; signaler au chef de projet ce qui bloque.

## Journal

### 18 novembre 2026
- Outils en place (branche `qualite/socle`) : `npm run qa:captures`, `qa:e2e`, `qa:perf`, `qa:tout`. Chrome du système et WebGL SwiftShader ; Fredoka servie localement via `@fontsource/fredoka` ; heure forcée avec `page.clock` (12 h jour, 21 h nuit).
- Les cadeaux du canvas sont visés via le crochet des outils de dév PixiJS (`__PIXI_APP_INIT__`). Demande faite à l'équipe Monde d'exposer une API de test stable (voir le rapport).
- Premier rapport : `docs/qa/rapport-2026-11-18.md` (état de `origin/main` au commit 6a8adb5). 0 erreur console, e2e 14/14. Points principaux : App.tsx n'intègre pas encore les lots, état de démo codé en dur (B1), deux workflows Pages concurrents (B2), fin du monde visible (B3), reconstruction complète de la scène à chaque changement (F1).
- À faire : e2e connexion, jeux, case préparée, direct à deux onglets dès l'intégration dans App.tsx ; relire chaque PR avec captures avant/après.
