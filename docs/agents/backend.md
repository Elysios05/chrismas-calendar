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

**Tests** : 35 vérifications SQL, 31 vérifications navigateur sur le DemoBackend.
