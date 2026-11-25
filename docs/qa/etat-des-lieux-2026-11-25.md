# État des lieux Qualité — 25 novembre 2026

Base : `origin/main` (b642b84) fusionnée dans `qualite/a11y-e2e-reprise`.

- **Build** : passe.
- **`npm run capture -- --jour=12 --appareils=mobile`** : OK, 0 erreur console (le suivi du nouvel en-tête `.entete` répare la capture cassée sur main).
- **Suite e2e** (`npm run qa:e2e`, mobile + ordinateur, ~29 min) : 48 réussis, 0 échec, 18 ignorés (cas propres à un seul appareil et `fixme` des jeux en direct).
- **Parcours de jeux** : jours 1, 2, 3, 7, 11 (solo), 15, 17. Les jours 5 (Pictionary) et 6 (Friandises) sont en direct à deux : ils demandent deux pages synchronisées, pas ajoutés ici (à faire avec le test « deux onglets », #56).
- **Accessibilité (#34)** : `tests/e2e/accessibilite.spec.ts` (axe-core WCAG 2.1 A+AA sur l'application en mode démo, focus piégé dans la fenêtre, interrupteurs au clavier) passe.
- **Tone.js** : plus aucune erreur dans la console sur les captures et les e2e depuis la PR #78.
- Captures retenues : `docs/qa/captures/2026-11-25-retenues/`.
