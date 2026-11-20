# Chef de projet — passage de relais

> **Session neuve ? Lis ce fichier en entier, puis `CLAUDE.md`, `docs/cahier-des-charges.md` et les issues ouvertes.**
> Tout ce qu'il faut pour reprendre est ici. Mets-le à jour à chaque décision.

**Rôle** : découper le travail, garder la cohérence entre équipes, relire et fusionner les PR, arbitrer, être le seul
canal entre Alexandre et les équipes en arrière-plan. **Dossiers** : `src/core/` (contrats), `src/App.tsx`
(assemblage), `CLAUDE.md`, `docs/`. Échéance : **tout en ligne le 30 novembre au soir**.

## Organisation
- **En direct avec Alexandre** (ses propres sessions Claude Code, sur son ordinateur) : **Monde**, **Interface**, **Jeux**.
  Ils parlent au chef **uniquement par issues GitHub** (préfixe `**Équipe X**`).
- **En arrière-plan, lancées par le chef** : **Backend**, **Audio**, **Qualité**. Chacune a sa copie de travail :
  `/home/claude/wt-backend`, `/home/claude/wt-audio`, `/home/claude/wt-qualite` (worktrees du dépôt principal
  `/home/claude/chrismas-calendar`, `npm install` séparé dans chacune). Le lancement d'agents avec isolation
  automatique est refusé : passer par ces worktrees.
- **Lancer une équipe** : outil Agent avec `subagent_type` = `backend` / `audio` / `qualite` (définis dans `.claude/agents/`),
  une **nouvelle** instance par lot (contexte propre), consigne courte : worktree, branche depuis `origin/main`,
  commit en français avec les deux lignes de fin, push, PR via l'API REST, rapport en quelques lignes.
- Leurs questions pour Alexandre arrivent dans leurs rapports : les lui poser avec **AskUserQuestion**, préfixées `[@equipe]`.
- **Limite d'utilisation de 5 h** partagée : les agents s'arrêtent avec « You've hit your 5-hour limit · resets HH:MM ».
  Leur travail est conservé ; les relancer après l'heure indiquée.

## Système de travail (décidé le 19 nov)
- Chef **léger** : fusionne, arbitre, lance les équipes en arrière-plan. Repartir d'une session chef neuve (lire ce fichier + `historique-chef-de-projet.md` dans le projet claude.ai) plutôt que de traîner un long historique.
- Questions des équipes à Alexandre : ticket unique **#59 « Questions pour Alexandre »** ; le chef ne relaie dans sa conversation que l'important.
- Chaque session termine chaque tâche par « ✅ Journal à jour — tu peux taper `/clear` maintenant. » (règle dans `CLAUDE.md`).
- **Modèle par tâche** pour les équipes en arrière-plan (paramètre `model` de l'outil Agent) : `opus` pour le visuel, les jeux, l'architecture et les correctifs délicats ; `sonnet` pour les tests, la documentation, les petits correctifs bien cernés, les scripts ; `haiku` pour les vérifications triviales.

## Procédures
- **GitHub** : `gh` marche en **REST** (`gh api repos/Elysios05/chrismas-calendar/...`) ; GraphQL et `gh pr/issue` sont bloqués.
  Clone superficiel : `git fetch --depth=80 origin +<branche>:refs/remotes/origin/<branche>` avant de fusionner
  (le **`+` est obligatoire** : sans lui, une branche rebasée et poussée en force n'est pas mise à jour, sans erreur visible ;
  vérifier que `git rev-parse origin/<branche>` = `head.sha` de la PR — incident du 19 nov sur #69).
- **Fusionner une PR** : `git pull --depth=50 origin main`, `git merge --no-ff origin/<branche>`, `npx tsc -b`, `npm run build`,
  test rapide si ça touche l'assemblage, `git -c push.negotiate=true push origin main`. GitHub marque la PR fusionnée
  toute seule ; si sa base n'est pas `main` (PR empilée), commenter puis fermer.
  Conflits fréquents : `src/index.css` (garder les deux côtés), journaux `docs/agents/*.md` (garder la version de l'équipe).
- **Surveillance** : `send_later` toutes les **15 min** (choix d'Alexandre) ; date de la dernière vérification dans
  `/home/claude/.last-gh-check` ; lister `issues?state=all&since=…` et `issues/comments?since=…` en ignorant les
  commentaires qui commencent par `**Chef de projet**`. Rien de nouveau → ne rien dire à Alexandre.
- **Commits** : signés `Claude <noreply@anthropic.com>`, message en français, deux lignes de fin
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` et `Claude-Session: https://claude.ai/code/session_015RYyqMthd65N9EWeRX49J2`.
- **Test d'assemblage** : `npx vite preview --port 4173` puis Playwright Python avec `/usr/bin/google-chrome`
  (`--use-gl=swiftshader --enable-unsafe-swiftshader`) : `?jour=N&demo-reset&heure=HH:MM`, bouton « Alexandre »,
  mot de passe quelconque, Entrée, puis `dispatchEvent(new CustomEvent('node-tap', {detail: N}))`.

## Ce que fait `App.tsx` (assemblé par le chef)
`createBackend()` → `LoginScreen` → `Calendar` : scène PixiJS (`Scene`), progression des deux joueurs, états des cases,
toucher une case → (si pas encore ouverte) `walkTo` → `playOpen` → son `open` → `DayWindow` avec le jeu chargé
par `chargerJeu(jour)` ; au retour, Pingou commente la course. Lumière continue `lightAt(heure)` → `scene.setLight`
(`?heure=` pour simuler), `data-nuit` sur `<html>`, bouton ☀️/🌙 qui force. Son : `sound` (`src/audio`), zone, météo,
vent. HUD : badge joueur, ✏️ prochaine case préparée (`PreparedEditor`), 📍 aujourd'hui, 📜 souvenirs (à partir du 24),
⚙️ `Settings`, `RaceIndicator`, bandeau `RappelVeille`, `FinalScreen` après la case 24, `?case=N` depuis une notification.

## Décisions d'Alexandre (à respecter)
- Terrain **continu** en facettes (pas d'îlots), 6 mondes, route qui descend ; style isométrique vectoriel plat.
- Mascotte **Pingou** (pingouin). Chacun **sa position** sur la route (petite course). Navigation au doigt / souris / flèches,
  **mur de brouillard** au-delà de la dernière case ouverte.
- Ouverture des cases à **7 h** (Paris), rattrapage possible. Cases préparées 4, 8, 12, 16, 20, 24 : **les deux** préparent
  (mot doux + photos), **figée** dès que l'autre l'a ouverte.
- **Vraies adresses e-mail** (en variables d'environnement, jamais dans le dépôt). Mot de passe oublié via **Brevo**,
  expéditeur : son Hotmail ; e-mail de Pingou validé tel quel.
- Rappel par **notification push à 20 h** + **relance 22 h 30** ; textes validés tels quels ; icône d'application **Pingou** (#18).
- Photos compressées à **2000 px**. Démo publique dans **/demo/**, version privée à la racine. Un seul workflow (`deploy.yml`).
- Musique : **airs de Noël du domaine public** par monde ; volume musique **50 %**, effets **60 %** ; bruitages d'ambiance ;
  pas de chanson protégée.
- Fin du monde : **scène finale** (traîneau qui décolle le 24). Nom du monde : **pastille crème permanente**.
- **Une seule équipe Jeux** (pas de deuxième). Souvenirs : **page HTML imprimable en PDF**.
- Allumage progressif des fenêtres : **pas pour le 30**.
- **Outil de capture commun** (19 nov, 20 h 53) : la Qualité ajoute `npm run capture` (sur `tests/qa/commun.mjs`, connexion démo, mobile + ordinateur) ; ensuite règle dans `CLAUDE.md` « n'écris pas ton propre script de capture ». Pas de mise en commun du reste du code (doublons négligeables). Scripts Python du Backend laissés tels quels.
- Économie : sessions qui se vident (`/clear` après chaque tâche, voir `CLAUDE.md`), surveillance toutes les 15 min.

## Où on en est (19 nov, 14 h)
- Fait et fusionné : monde complet (6 mondes, météo par jour, crépuscule, ouverture animée, navigation, perfs),
  connexion, fenêtres des cases, éditeur de case préparée, rappels (côté serveur, non testés en vrai), réglages, course,
  écran du 24, souvenirs, hors ligne, outillage temps réel (`joinLive`), audio complet (ambiances, jingles, 30+ effets),
  jeux **1 quiz, 2 luge, 7 rébus, 15 pendu, 17 mots croisés**, outils Qualité (captures, e2e, perf).
- **Reste le plus risqué** : 13 jeux (10, 22 à score ; 5, 6, 11, 13, 18, 21 en direct ; 3, 19 photo ; 9 dessin ; 14, 23 synchro).
  Si retard le 24–25 nov, proposer à Alexandre de simplifier certains jeux.
- **Jamais testé en vrai** : Supabase (Alexandre doit créer le projet en suivant `docs/supabase.md`), notifications, sur vrai téléphone.
- Priorités Monde : voir #29 (dernier commentaire). Interface : #51 (en-tête). Qualité : #34 + lot `qualite/e2e-integre` en cours.
- Lot en cours : Backend `backend/souvenirs-pdf` (bouton « Enregistrer en PDF »).

## Équipes en arrière-plan : état au passage de relais (19 nov, 14 h 30)
L'ancien chef ne peut pas transmettre ses agents (ils sont rattachés à sa conversation). **Le nouveau chef relance
une instance neuve** par lot (outil Agent, `subagent_type` = `backend` / `audio` / `qualite`, `model` adapté), en
lui donnant le worktree, la branche et la consigne ci-dessous. Les worktrees `/home/claude/wt-*` existent dans
l'environnement cloud de l'ancien chef ; si le nouveau chef tourne ailleurs, recréer les worktrees
(`git worktree add ../wt-<équipe> <branche>` puis `npm install`).
- **Backend** — rien en cours. Tout est fusionné (dernier : PR #62, décors dans les souvenirs). Prochaines tâches
  possibles : rien d'urgent ; aider à brancher Supabase quand Alexandre créera le projet (`docs/supabase.md`).
- **Audio** — rien en cours. Tout est fusionné (PR #53 : jingles, musiques `duel`/`cosy`, 16 effets d'animaux et de
  personnages). « Saint Nicolas, patron des écoliers » non ajouté faute de partition fiable. Prochaine tâche possible :
  retours d'Alexandre à l'écoute des extraits du lot 3 (pas encore donnés).
- **Qualité** — **en cours, non terminé** : branche `qualite/e2e-integre` (poussée, commit e02b132 « travail en
  cours »), **pas encore de PR**. Contenu : tests adaptés au parcours réel (connexion → carte, quiz, luge, cases
  préparées, rappel, deux onglets), audit axe-core (#34), captures. À relancer avec cette consigne : rebase sur
  `origin/main`, finir les tests (faire échouer tout script qui ne voit pas la carte après connexion ; retirer les
  `test.fail` de la luge et du « 1er décembre » qui doivent passer), relancer captures et rapport, ouvrir la PR,
  un ticket par bug trouvé. Modèle conseillé : `sonnet`.
- **PR ouverte au moment du relais** : #63 (`interface/journal`) à relire et fusionner.
- La surveillance des tickets de l'ancien chef est **arrêtée** (« arrête » d'Alexandre, 19 nov 14 h 19).

## Échéancier
| Date | Jalon |
|---|---|
| 22 nov | Jeux à score (10, 22) + 2 jeux en direct ; en-tête refait ; mouvement dans le décor |
| 25 nov | Tous les jeux jouables en démo |
| 27 nov | Supabase créé et branché par Alexandre (guide), tests à deux sur vrais téléphones |
| 29 nov | Contenu réel (questions, souvenirs) remplacé par Alexandre, corrections |
| 30 nov | Mise en ligne finale |

## Journal
- 17 nov : terrain continu retenu ; organisation en 6 équipes ; backend démo + Supabase ; audio ; assemblage d'`App.tsx`.
- 18 nov : rappels push, relance, éditeur, réglages, course, souvenirs, hors ligne, temps réel ; incident `git stash` (règle ajoutée).
- 20 nov (nuit) : PR #69 (e2e), #70 (`npm run capture`, règle ajoutée dans `CLAUDE.md`), #71 (aurores, traîneau, cadeaux) fusionnées ; Audio lancé sur #68 (`audio/tone-exceptions`).
- 19 nov (soir) : Qualité relancée (`qualite/e2e-integre`) ; PR #63, #64, #65 fusionnées ; hauteur de page : on garde le `resize` (#9) ; outil de capture commun décidé.
- 19 nov : ouverture animée + crépuscule branchés, navigation au doigt fusionnée, passage de relais écrit.
