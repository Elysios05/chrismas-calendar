# Équipe Backend (Supabase) et déploiement

**Mission** : comptes, sécurité, données, photos, temps réel — et un **mode démo** qui fait tourner tout le site sans backend.
**Dossiers** : `src/backend/`, `supabase/` (migrations SQL), `.github/`.

## À faire (par priorité)
1. **`DemoBackend`** qui implémente `BackendApi` (`src/core/contracts.ts`) en mémoire + localStorage, avec une salle temps réel simulée
   (BroadcastChannel entre deux onglets) pour que les jeux en direct se testent sans Supabase.
2. **`SupabaseBackend`** : choisi automatiquement si `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` sont définies.
3. **Schéma + règles RLS** : progression, cases préparées (illisibles par le destinataire avant le jour J, date côté serveur),
   état des jeux, stockage des photos (bucket privé, URLs signées). Migrations versionnées dans `supabase/migrations/`.
4. **Temps réel** (Supabase Realtime : broadcast + presence) pour `joinRoom`.
5. **Guide pas à pas** dans `docs/supabase.md` pour Alexandre (création du projet, des 2 comptes, des variables).
6. Workflow GitHub Pages, variables d'environnement en secrets.

## Questions à poser à Alexandre
Fuseau horaire de référence pour l'ouverture (Paris ?), qui crée les comptes, taille maximale des photos.

## Journal

### 17 novembre 2026 — socle backend (branche `backend/socle`)
**Fait**
- `src/backend/index.ts` : `await createBackend()` → `SupabaseBackend` si `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, sinon `DemoBackend`.
  Supabase est chargé en import dynamique (chunk séparé ~58 Ko gzip, absent du build démo).
- `src/backend/demo.ts` : tout dans le navigateur. `?jour=N`, `?moi=flavie` (personnage de l'onglet, session par onglet),
  `?demo-reset` (efface les données). Données d'exemple : progression, cases préparées 4/8/12 de chacun, scores.
  Salle temps réel via `BroadcastChannel` (présence par battements toutes les 1,5 s).
- `src/backend/supabase.ts` : auth e-mail/mot de passe (e-mails dans `config.ts`, surchargeables), identité lue dans `profiles`,
  photos dans le bucket privé `photos/<who>/<uuid>.jpg` (compressées à 2000 px), canaux Realtime **privés** `room:<id>`.
- `src/backend/config.ts` : toutes les constantes à valider (fuseau, heure d'ouverture, tailles photos, e-mails).
- `supabase/migrations/0001_init.sql` : tables + RLS + bucket + politiques Realtime ; date calculée par `advent_today()`
  (Europe/Paris, minuit, `app_settings.day_override` pour tester).
- Tests : `bash supabase/tests/run_sql_tests.sh` (Postgres local jetable, 26 vérifications RLS) ;
  `python3 src/backend/__tests__/demo_backend_test.py` (Chrome headless, 24 vérifications du DemoBackend).
- CI : `deploy.yml` construit la version privée à la racine et la démo dans `/demo/` ; `tests.yml` (build + RLS) sur les PR.
- Guide pour Alexandre : `docs/supabase.md`.

**Comportements à connaître (autres équipes)**
- `getPrepared(day, to)` renvoie `null` aussi bien si la case n'est pas encore ouverte pour le destinataire que si elle n'est pas écrite.
  L'auteur la lit toujours (utile pour le rappel de la veille).
- `markOpened`/`markCompleted` lèvent une erreur pour une case future (refus serveur).
- `uploadPhoto` renvoie une URL signée valable 60 jours (data URL en démo) ; `savePrepared` accepte ces URLs telles quelles.
- `game_state` : clés libres ; convention proposée `score:<who>`, `dessin:<who>`… La valeur doit être sérialisable en JSON.
- `joinRoom` : les messages ne sont pas renvoyés à l'expéditeur ; avant l'abonnement, les `send` sont mis en file d'attente.

**En attente d'Alexandre** : fuseau/heure d'ouverture, e-mails fictifs ou réels, taille max des photos, emplacement de la démo (`/demo/`).

### 17 novembre 2026 (suite) — réponses d'Alexandre intégrées
**Décisions d'Alexandre**
- Fuseau Europe/Paris pour tous ; **ouverture des cases à 7 h** (avant 7 h = la veille) : `OPEN_HOUR = 7`,
  `app_settings.open_hour = 7`, fonction pure `advent_day_at(ts)` testée (6 h 59 / 7 h 00, 1er décembre, après Noël).
- **Vraies adresses e-mail**, jamais en dur : `VITE_EMAIL_ALEXANDRE` / `VITE_EMAIL_FLAVIE` (secrets GitHub, `.env.local`).
  Le guide prévient qu'elles restent visibles dans le JavaScript publié.
- Photos compressées à 2000 px ; démo publique dans `/demo/`, version privée à la racine (inchangé).
- **Case préparée figée dès que le destinataire l'a ouverte** (ligne dans `progress`) : trigger `prepared_guard`
  (erreur `CASE_FIGEE`, traduite en « Cette case a déjà été ouverte… ») + RLS ; même règle en démo.

**Contrat (commit dbafe65)** : `getPrepared` → `PreparedResult` (`locked` / `empty` / `ready`), `onAuthChange(cb)` implémenté
dans les deux backends (pas d'appel immédiat : seulement aux changements).

**Hors contrat** : interface `PasswordRecovery` dans `src/backend/index.ts` (`resetPassword(who)`, `inPasswordRecovery()`,
`updatePassword(pw)`), avec le garde-type `hasPasswordRecovery(backend)`. Sans effet en démo.

**Tests** : 38 vérifications SQL, 31 vérifications navigateur sur le DemoBackend.

### 17 novembre 2026 (soir) — e-mails « mot de passe oublié » (branche `backend/emails`)
- Décision d'Alexandre : brancher un service d'e-mails gratuit. **Choix : Brevo**, le seul qui marche sans nom de domaine :
  Resend, sans domaine vérifié, n'envoie qu'à l'adresse du compte Resend. Brevo accepte un expéditeur Gmail/Hotmail vérifié par code.
- `docs/supabase.md` § 9 : compte Brevo, expéditeur, identifiants SMTP, saisie dans Supabase, modèle en français, adresse de retour, test, dépannage.
- `supabase/templates/reset-password.html` : e-mail « Reset password » signé Pingou, à coller dans le tableau de bord.
- Pas de `supabase/config.toml` : il ne sert qu'avec la CLI Supabase (`supabase config push`), que le projet n'utilise pas ;
  tout se règle dans le tableau de bord.
- À confirmer à l'inscription : les conditions actuelles de Brevo (expéditeur Gmail/Hotmail accepté ou non, délivrabilité).
  La vérification en ligne n'a pas pu être faite (limite d'outil atteinte).
- 17 nov (soir) : Alexandre valide Brevo avec son Hotmail actuel comme expéditeur, et l'e-mail de Pingou tel quel.

### 18 novembre 2026 — tickets #4 (rester connecté·e) et #5 (rappels), branche `backend/rappels`
- **#4** : `signIn(who, pw, { rester })`. Supabase : stockage de session commutable (localStorage si `rester`, sinon
  sessionStorage, retrouvé au rechargement). Démo : même logique avec la session d'onglet.
- **#5** (décision d'Alexandre : notification à 20 h, heure de Paris, la veille d'une case préparée vide) :
  - contrat : `ReminderStatus`, `reminderStatus?()` et `enableReminders?()` (**facultatives** pour l'instant, car les faux backends
    `src/games/dev/backendDemo.ts` et `src/ui/dev/fakeBackend.ts` ne les ont pas : à rendre obligatoires quand leurs équipes les auront ajoutées) ;
  - navigateur : `src/backend/push.ts`, `public/sw.js` (push → notification, clic → `./?case=N`), `public/manifest.webmanifest`,
    icônes `public/icons/` (sapin sur bleu nuit), balises dans `index.html` ;
  - serveur : `0002_rappels.sql` (`push_subscriptions`, `reminder_log`, `save/delete_push_subscription`, `reminder_targets`,
    `app_settings.reminder_hour = 20`), Edge Function `supabase/functions/rappel-veille`, planification `supabase/cron_rappel.sql`
    (18 h et 19 h UTC, la base ne répond qu'à 20 h Paris → heure d'été/hiver gérée) ;
  - démo : `unsupported`, ou état simulé avec `?rappels=off|active|denied|needs-install` ;
  - se déconnecter désabonne l'appareil.
- Tests : 52 vérifications SQL (`run_sql_tests.sh`), 38 sur le DemoBackend, 14 dans `pwa_test.py` (manifeste et service worker dans
  `/chrismas-calendar/`, push simulé par CDP, statuts off / needs-install), et `message_test.ts` (Node).
- À faire côté Interface : lire `?case=N` pour ouvrir la case depuis la notification ; bouton « Activer les rappels ».
- `.github/workflows/main.yml` (ajouté directement sur main) fait doublon avec `deploy.yml` : à trancher par le chef de projet.

### 18 novembre 2026 — relance de 22 h 30 (branche `backend/relance`)
- Décisions d'Alexandre : texte du rappel de 20 h **tel quel** ; **relance à 22 h 30** si la case est toujours vide ;
  icône Pingou demandée à l'équipe Monde (le sapin reste en attendant).
- `0003_relance.sql` :
  - `app_settings.reminder_minute` (0) et `followup_time` (22:30, `NULL` = pas de relance) ;
  - `reminder_log.kind` (`rappel` / `relance`), avec la clé `(day, who, kind)` ;
  - `reminder_kind_at(ts)` (tolérance ±10 min) ;
  - `reminder_targets(p_day, p_force, p_kind)`.
- `cron_rappel.sql` : deux tâches (`0 18,19` et `30 20,21` UTC) qui appellent `call_rappel_veille()` ; la base choisit le type.
- Texte de la relance (signé Pingou) : « 🐧 Toc toc… Pingou insiste (gentiment) — La case N est toujours vide, et X l'ouvre demain à 7 h !
  Il te reste ce soir : deux lignes et une photo, et je file me coucher 💤💌 » (variante pour le 24).
- Tests : 68 vérifications SQL (été/hiver, tolérance, journal distinct, case remplie entre-temps) + `message_test.ts`.
- 18 nov : relance de 22 h 30 validée telle quelle par Alexandre.

### 18 novembre 2026 — correctif #32 (branche `backend/correctif-32`)
- Démo : les exemples (progression, cases préparées, scores) sont recalculés selon le jour simulé et ne sont plus enregistrés.
  Seules les actions de l'utilisateur sont stockées (`cc-demo:data-v2`). Rien d'ouvert ni de joué à partir du jour simulé ;
  cases préparées d'exemple jusqu'au jour simulé inclus ; au jour 1, tout est neuf. La progression est aussi filtrée à `≤ ?jour`
  (revenir à un jour antérieur masque les cases ouvertes plus tard).
- Tests : 48 vérifications dans `demo_backend_test.py`.

### 19 novembre 2026 — lot 3 (branche `backend/lot-3`)
- **Jeux en direct** : `src/backend/realtime.ts` (`LiveGame` / `joinLive`).
  - Salle `room:jour-N`, présence, « prêt ? », départ synchronisé sur l'horloge d'Alexandre (décalage estimé par ping-pong).
  - État partagé (dernier écrit gagne) ; reprise via `getGameState(jour, "live:partie")`.
  - Mode d'emploi : `src/backend/README.md`. Test à deux pages, horloge de Flavie décalée de 5 s : `realtime_test.py` (19 vérifications).
- **Hors ligne** : `public/sw.js` garde la page (réseau d'abord, 3 s max), les scripts, les icônes et les polices, jamais les données Supabase.
  - Un cache par version (racine et `/demo/`). Enregistré au démarrage par `createBackend()`, en production seulement (`offline.ts`).
  - Testé serveur coupé dans `pwa_test.py` (22 vérifications).
- **Souvenirs** : `exportSouvenirs(backend)` / `downloadSouvenirs(backend)` (`src/backend/souvenirs.ts`).
  - Page HTML autonome avec les lettres des deux côtés et les photos intégrées, disponible à partir du 24.
- Incident : les remises `git stash` sont communes à toutes les `wt-*`, et un `stash pop` simultané a échangé mon travail avec celui
  de l'équipe Audio. Ma copie est réparée et les deux patchs sont dans `/home/claude/recuperation-stash/`. Signalé dans l'issue #52.
  **Ne plus utiliser `git stash`.**

### 19 novembre 2026 — souvenirs avec décors (branche `backend/souvenirs-decors`)
- Demande d'Alexandre : le PDF des souvenirs reprend le fond et les décors du calendrier, **générés par script à l'export**, rien de figé.
- `exportSouvenirs(backend, { decor })` et `downloadSouvenirs(backend, filename, { decor })` : `decor(jour)` renvoie une data URL (ou `null`).
  Sera branché par le chef sur `scene.snapshotAround` (ticket #61, équipe Monde). Absent, `null`, erreur ou URL non `data:image/` : mise en page d'avant.
- Rendu : bandeau `<img>` (vraie balise) avec voile clair en haut de chaque case ; page de garde avec le décor du jour 24 ; flocons et liseré à losanges en SVG.
  `print-color-adjust: exact` pour que le voile s'imprime ; `break-inside: avoid` sur les lettres.
- Test : `__tests__/souvenirs_decor_test.py` (8 vérifications, image factice en canvas, PDF A4 par Chrome headless).

### 24 novembre 2026 — préparation du 27 (branche `backend/preparation-supabase`)
**Relecture du guide contre le code** : variables (`VITE_SUPABASE_URL/ANON_KEY`, `VITE_EMAIL_*`, `VITE_VAPID_PUBLIC_KEY`), secrets
GitHub de `deploy.yml`, tables, bucket `photos`, secrets de l'Edge Function (`VAPID_*`, `CRON_SECRET`), clés Vault (`project_url`,
`rappel_cron_secret`), tâches pg_cron : tout correspond. Écarts corrigés :
- guide : manquait « Settings → Pages → Source : GitHub Actions » ; la remise à zéro oubliait `reminder_log` et `day_override`
  (et l'ordre `progress` d'abord, sinon les cases ouvertes en test restent figées) ; aide « Mot de passe incorrect » ;
  nouvelle **§ 11 : checklist de test à deux** (connexion, case préparée, jeux, rappels, remise à zéro).
- RLS : les photos d'une case **déjà ouverte** pouvaient encore être supprimées/remplacées par l'autrice (trou) →
  `photo_frozen()` + politiques `photos_update` / `photos_delete` (dans `0001_init.sql`, pas encore exécuté en vrai) ; 2 tests SQL ajoutés.
- Edge Function : un envoi de test (`day`/`force`) écrivait dans `reminder_log` et aurait bloqué le vrai rappel du jour → plus de journal pour un test.
**Vérifié** : build avec variables factices OK (chunk `supabase-*.js` produit) ; en navigateur, écran de connexion Supabase sans erreur
console hors réseau attendu ; 72 vérifications SQL. `npm run capture` réutilise un serveur déjà présent sur le port 4180 (autre copie) et
passe par la connexion démo : il ne peut pas valider le mode Supabase (vérifié avec un script jetable sur un autre port).
**Reste non testable sans vrai projet** : Edge Function sous Deno (`npm:web-push`), pg_cron/pg_net/Vault, Realtime privé, notifications sur
iOS. Le déploiement de la fonction sans `supabase/config.toml` (`functions deploy` seul) n'a pas pu être vérifié.
**Ticket Interface** : `LoginScreen.tsx` affiche « Mot de passe incorrect » pour toute erreur (réseau, profil non relié).
