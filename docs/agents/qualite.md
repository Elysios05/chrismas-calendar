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

### 19 novembre 2026 (branche `qualite/e2e-integre`)
- Rebase sur `origin/main` (167f210). E2E adaptés au parcours réel : 42 réussis, 0 échec ; `test.fail` retirés. Audit axe-core (#34) : 0 violation sur 6 écrans. Captures 2026-11-19 et rapport `docs/qa/rapport-2026-11-19.md`.
- `attendreScene` échoue explicitement si la carte n'apparaît pas après connexion.
- Reste : exceptions Tone.js revues dans les captures (ticket Audio) ; test « jeu en direct à deux onglets » en `fixme` tant qu'aucun jeu en direct n'existe (#56) ; deux onglets : fermer le premier avant d'ouvrir le second (SwiftShader).
- Durées : e2e ~29 min, captures ~40 min ; lancer en arrière-plan (nohup).

### 19 novembre 2026 (branche `qualite/capture-commune`)
- Décision d'Alexandre : une seule commande de capture pour toutes les équipes. Ajout de `npm run capture` (`tests/qa/capture.mjs`), doc dans `docs/qa/capture.md`.
- Ajouts à `commun.mjs` : `buildRecent`, `avancerCamera` (ticker avancé à la main, rendu coupé), `renduActif`. `ouvrirDemo` utilise maintenant l'URL absolue `BASE`.
- Constat : la fermeture de la bulle de Pingou ne marche pas avec le rendu coupé (elle doit se faire rendu actif, ~12 s) ; l'ouverture d'une case est en revanche bien plus rapide rendu coupé.
- Durées : capture simple ~27 s, avec `--case` ~50 s par appareil.


### 25 novembre 2026 (branche `qualite/a11y-e2e-reprise`)
- Reprise après interruption. `origin/main` fusionnée (salons #85, jeux 5-6 #83, en-tête #82, télésiège #80) sans conflit. `npm run capture` réparé (suit `.entete`) ; serveur de capture propre à chaque copie de travail (port).
- e2e : 48 réussis, 0 échec, 18 ignorés. Parcours jeux : jours 2, 3, 7, 11, 15, 17. État des lieux : `docs/qa/etat-des-lieux-2026-11-25.md`.
- Prochaine étape : parcours des jours 5 et 6 (direct à deux pages) et du test deux onglets (#56) ; axe-core (#34) couvert.

### 26 novembre 2026 (branche `qualite/e2e-salons`)
- **e2e des salons** (`tests/e2e/salons.spec.ts`) : création Sam & Camille → lien d'invitation affiché → l'invité·e l'ouvre dans un autre onglet, choisit son mot de passe, arrive sur la carte → prénoms du salon dans l'en-tête, la bulle de Pingou et les réglages, jamais « Alexandre »/« Flavie » (texte affiché + `title`/`aria-label`) → lien déjà servi et lien inconnu (« Ce lien ne marche plus ») → « Les questions des jeux » seulement chez le créateur, carte « surprise » chez l'invité·e.
- **Atteindre l'assistant de création en démo** : impossible dans l'appli (le salon démo existe toujours). On utilise `maquettes.html?vue=creer` de l'Interface sur un serveur de dév (port `QA_PORT_DEV`, 4181, lancé par `playwright.config.ts`), puis la vraie appli sur le même serveur (même origine = même stockage de démo). Ce test est donc le seul à tourner sur le serveur de dév.
- **`npm run capture -- --prenoms=Sam,Camille`** : écrit la config du salon `demo` dans le registre local avant le chargement ; la capture échoue si « Alexandre »/« Flavie » reste dans le texte visible. Voir `docs/qa/capture.md`.
- **Jeux 9 (dessin) et 10 (flocons)** ajoutés à `jeux.spec.ts`. Le jour 10 tolère UNE erreur connue (issue #109, scène Pixi détruite pendant son tick) : retirer `tolere` quand c'est corrigé.
- **Balayage « Alexandre/Flavie » en dur** : issues #110 (titre de page + manifeste, chef) et #111 (lettre d'exemple du salon démo, Backend). Le reste (Pingou, jeux, souvenirs, rappels) passe par les prénoms du salon ; les valeurs par défaut et `src/data/salons/` sont voulues.
- Constat : le lien d'invitation déjà servi dit « Ce lien a déjà servi, {prénom} » (et non « Ce lien ne marche plus », réservé aux liens inconnus).
- Prochaine étape : parcours à deux pages (jours 5, 6, 11 en direct) et « deux salons ne se voient pas » (e2e, cf. `docs/salons.md`).

### 26 novembre 2026, suite (reprise après réécriture de l'historique)
- **Crochet `__PIXI_APP_INIT__` corrigé** (`commun.mjs`) : on garde l'application du monde, jamais celle d'un jeu (piste des Jeux, #109).
- **Erreur `reading 'clear'`** : toujours là après #112 (jeu 10, fermeture du sapin 21), corrigée par #121. Tolérance retirée ; les parcours 10 et 21 passent sans erreur console.
- **Nouveaux parcours** dans `jeux.spec.ts` : jour 13 (solo : boule validée, décor, souvenir ; l'horloge de la page étant figée, le test la fait avancer à la main pour le compte à rebours), jour 21 (6 décos posées en solo, l'étoile attend l'autre ; le direct à deux n'est pas atteignable en démo), jour 22 (tri sans trier jusqu'à la fin). Le bonhomme (13) enregistre `13:journal`, pas de « meilleur score ».
- **#113 reproduit** (habitant posé devant un cadeau : le toucher va à l'habitant, la case ne s'ouvre pas) ; commentaire sur l'issue, e2e à ajouter quand le Monde corrige.
- Piège : après fermeture d'un jeu, le ticker du monde peut ne plus avancer (`attendreImages` bloque) ; ne pas rouvrir une case dans le même test.
- Prochaine étape : parcours à deux pages (jours 5, 6, 11, 13, 21 en direct) et « deux salons ne se voient pas ».
