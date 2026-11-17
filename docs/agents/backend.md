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
