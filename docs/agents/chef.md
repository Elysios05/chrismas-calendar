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
- Chef **léger** : fusionne, arbitre, lance les équipes en arrière-plan. Repartir d'une session chef neuve (lire ce fichier + `docs/agents/historique-chef.md`) plutôt que de traîner un long historique.
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
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` et `Claude-Session: <lien de ta session>`.
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
- **Salons (25 nov, 0 h 20)** : calendrier clé en main pour n'importe quel couple, création **ouverte à tous**, paramétrage complet (prénoms, couleurs, contenu perso des jeux), lien d'invitation (l'invité·e choisit juste son mot de passe), Flavie ne fait rien (Alexandre teste seul avec deux appareils). **Avant le 30.** Spécification : `docs/salons.md`, suivi : #84.
- **Outil de capture commun** (19 nov, 20 h 53) : la Qualité ajoute `npm run capture` (sur `tests/qa/commun.mjs`, connexion démo, mobile + ordinateur) ; ensuite règle dans `CLAUDE.md` « n'écris pas ton propre script de capture ». Pas de mise en commun du reste du code (doublons négligeables). Scripts Python du Backend laissés tels quels.
- Économie : sessions qui se vident (`/clear` après chaque tâche, voir `CLAUDE.md`), surveillance toutes les 15 min.

## Reprendre le projet depuis une session neuve (n'importe quel compte Claude)
Tout ce qu'il faut est dans le dépôt : rien n'est à aller chercher dans une conversation ou un projet claude.ai.
1. Cloner `Elysios05/chrismas-calendar` (accès en **écriture** nécessaire : le compte Claude doit avoir l'app GitHub
   autorisée sur ce dépôt privé). `npm install`.
2. Lire, dans l'ordre : ce fichier, `CLAUDE.md`, `docs/cahier-des-charges.md`, `docs/agents/historique-chef.md`
   (résumé des échanges avec Alexandre du 17 au 19 nov), puis les issues ouvertes (REST).
3. Les 6 équipes sont définies dans `.claude/agents/*.md` (types d'agents `monde`, `interface`, `jeux`, `backend`,
   `audio`, `qualite`). Le chef lance celles en arrière-plan avec l'outil Agent ; Alexandre peut aussi ouvrir une
   session directe par équipe (« Tu es l'équipe X, lis `docs/agents/x.md` »).
4. Recréer les worktrees au besoin : `git worktree add ../wt-<équipe> -b <équipe>/<tâche> origin/main` puis `npm install`.
5. Ligne `Claude-Session:` des commits : mettre celle de **ta** session.
6. Surveillance des tickets : seulement si Alexandre la demande (rythme à lui demander, 15 min par défaut).
Ce qui ne suit pas d'un compte à l'autre : les conversations, les agents en cours, les rappels programmés, la mémoire.

## Où on en est (24 nov)
- `main` à jour au 20 nov (dernier : PR #73). **Aucune PR ouverte.** Rien n'a avancé du 20 au 24 : limite
  d'utilisation hebdomadaire atteinte le 20.
- Fait : monde complet et vivant (6 mondes, animaux et personnages animés avec sons, aurores, fin de carte, cadeaux
  lisibles, icône Pingou), connexion, fenêtres des cases, éditeur de case préparée, rappels (non testés en vrai),
  réglages, course, écran du 24, souvenirs PDF, hors ligne, outillage temps réel (`joinLive`), audio complet,
  tests e2e (42 OK) + accessibilité, commande commune `npm run capture`.
- **Jeux faits : 1, 2, 7, 11, 15, 17.** **Restent 12** : 10, 22 (score) ; 5, 6, 13, 18, 21 (en direct) ; 3, 19
  (photo) ; 9 (dessin) ; 14, 23 (synchro). C'est le gros du travail restant.
- **En cours, non terminé** : Audio sur #68 (exceptions Tone.js), branche `audio/tone-exceptions`, dernier commit
  « travail en cours » **non vérifié** (build et captures à refaire) → relancer l'Audio (`opus`) avec : reprendre
  la branche, vérifier, finir, `npm run capture -- --jour=9 --appareils=mobile` sans erreur Tone, PR.
- Monde : #10, #12, #14, #23, #61 (+ #11/#42 en grande partie faits, à vérifier puis fermer). Interface : #51 (en-tête).
- **Jamais testé en vrai** : Supabase (Alexandre doit créer le projet en suivant `docs/supabase.md`), notifications,
  vrais téléphones.
- **Modèles : on garde le fonctionnement actuel** (choix par tâche, voir « Système de travail ») — décision d'Alexandre le 24 nov.
- **Coupes refusées par Alexandre le 24 nov : on ne coupe rien.** Les 12 jeux restants gardent leur forme prévue
  (pas de tour par tour à la place du direct) ; #61, #12, #10 restent à faire. Surveillance des tickets : seulement
  à sa demande. Estimation : ~40 tâches, ~50–100 $ au tarif API, environ une limite hebdomadaire.
- **Répartition confirmée le 24 nov** : Alexandre pilote lui-même **Monde, Jeux, Interface** ; le chef gère
  **Backend, Audio, Qualité** en arrière-plan et fait lui-même tout le git (fusions, push sur main ;
  autorisations dans `.claude/settings.json`).
- 24 nov (23 h 30) : PR #74 (Backend, préparation du 27 : guide, photos figées, rappels de test) **fusionnée**.
  En cours : Audio (`opus`) sur #68 ; Qualité (`sonnet`) `qualite/a11y-e2e-reprise` (#34, état des lieux, tests des jeux faits).
  Ticket #75 (Interface) : message d'erreur de connexion trop générique, à faire avant le 27.

## Échéancier
| Date | Jalon |
|---|---|
| ~~22 nov~~ (en retard) | Jeux à score (10, 22) + 2 jeux en direct ; en-tête refait ; mouvement dans le décor |
| 25 nov (en retard) | Tous les jeux jouables en démo |
| 27 nov | Supabase créé et branché par Alexandre (guide), tests à deux sur vrais téléphones |
| 29 nov | Contenu réel (questions, souvenirs) remplacé par Alexandre, corrections |
| 30 nov | Mise en ligne finale |

## Journal
- 25 nov (12 h 45) : PR #85 (contrat des salons + démo) fusionnée, annoncée sur #84 ; #59 → option A (mot de passe obligatoire à la 1re connexion). Backend (lot 2 Supabase, `opus`) et Qualité (sélecteurs `.entete`, `sonnet`) relancés après la limite des 5 h. Reste dans les briefs : `DayWindow` doit remplir `ctx.content` et `ctx.prenoms` (Interface).
- 25 nov (0 h 30) : décision « salons » (`docs/salons.md`, #84) ; Backend lancé sur le contrat `SalonApi` + DemoBackend.
- 24 nov (soir) : Alexandre refuse toutes les coupes ; Audio, Backend, Qualité lancés ; PR #74 fusionnée.
- 17 nov : terrain continu retenu ; organisation en 6 équipes ; backend démo + Supabase ; audio ; assemblage d'`App.tsx`.
- 18 nov : rappels push, relance, éditeur, réglages, course, souvenirs, hors ligne, temps réel ; incident `git stash` (règle ajoutée).
- 24 nov : point de reprise écrit (section « Reprendre le projet ») ; travail Audio #68 sauvegardé sur sa branche ; estimation du reste.
- 20 nov : #72 (cadeaux lisibles), #73 (icône) fusionnées ; limite hebdomadaire atteinte, Audio interrompu.
- 20 nov (nuit) : PR #69 (e2e), #70 (`npm run capture`, règle ajoutée dans `CLAUDE.md`), #71 (aurores, traîneau, cadeaux) fusionnées ; Audio lancé sur #68 (`audio/tone-exceptions`).
- 19 nov (soir) : Qualité relancée (`qualite/e2e-integre`) ; PR #63, #64, #65 fusionnées ; hauteur de page : on garde le `resize` (#9) ; outil de capture commun décidé.
- 19 nov : ouverture animée + crépuscule branchés, navigation au doigt fusionnée, passage de relais écrit.
