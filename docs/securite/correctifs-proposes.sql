-- =====================================================================
-- Correctifs SQL PROPOSÉS par l'équipe Sécurité (audit du 27 nov 2026, docs/securite/audit-2026-11-27.md)
-- NON APPLIQUÉS. À relire par l'équipe Backend, à tester avec supabase/tests (run_sql_tests.sh),
-- puis à intégrer dans une migration 0006 si validés. Chaque bloc renvoie à l'ID du constat.
-- =====================================================================

-- ---------------------------------------------------------------------
-- SEC-02 — game_state : taille d'une valeur et nombre de lignes par salon
-- (valeurs à ajuster par les Jeux : un dessin en data:URL peut peser ~100–300 Ko)
-- ---------------------------------------------------------------------
alter table public.app_settings add column if not exists salon_game_rows_max int not null default 2000
  check (salon_game_rows_max between 0 and 100000);

alter table public.game_state drop constraint if exists game_state_value_size;
alter table public.game_state add constraint game_state_value_size
  check (value is null or octet_length(value::text) <= 512 * 1024) not valid;   -- 512 Ko par valeur
alter table public.game_state validate constraint game_state_value_size;

create or replace function public.game_state_quota() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.game_state g where g.salon_id = new.salon_id)
     >= (select coalesce(salon_game_rows_max, 2000) from public.app_settings where id = 1) then
    raise exception 'QUOTA_JEUX : trop de données de jeu pour ce calendrier' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists game_state_quota on public.game_state;
create trigger game_state_quota before insert on public.game_state
  for each row execute function public.game_state_quota();

-- Facultatif (SEC-09 bis) : pas d'écriture de jeu pour une case pas encore ouverte
-- drop policy if exists game_insert on public.game_state;
-- create policy game_insert on public.game_state for insert to authenticated
--   with check (salon_id = public.my_salon() and day <= public.advent_today());

-- ---------------------------------------------------------------------
-- SEC-03 — Photos : taille par fichier et volume total par salon (en octets)
-- Le site compresse déjà à 2000 px / 5 Mo max (src/backend/config.ts) : 5 Mo suffisent.
-- ---------------------------------------------------------------------
update storage.buckets set file_size_limit = 5 * 1024 * 1024 where id = 'photos';

alter table public.app_settings add column if not exists salon_photo_octets_max bigint not null default 100 * 1024 * 1024
  check (salon_photo_octets_max >= 0);   -- 100 Mo par salon → 50 salons ≈ 5 Go max : à ajuster à l'offre (1 Go gratuit)

create or replace function public.salon_photo_quota_ok() returns boolean
language sql stable security definer set search_path = public, storage as $$
  with mine as (
    select o.metadata from storage.objects o
    where o.bucket_id = 'photos' and (o.name like public.my_salon()::text || '/%'
      or (public.my_salon() = public.legacy_salon_id() and split_part(o.name, '/', 1) in ('alexandre', 'flavie')))
  )
  select (select count(*) from mine) < (select coalesce(salon_photo_max, 150) from public.app_settings where id = 1)
     and (select coalesce(sum((metadata ->> 'size')::bigint), 0) from mine)
         < (select coalesce(salon_photo_octets_max, 104857600) from public.app_settings where id = 1)
$$;
-- Remarque : la taille (metadata.size) n'est connue qu'après l'envoi ; ce contrôle borne le volume à
-- « quota + 1 fichier », ce qui suffit avec file_size_limit = 5 Mo.

-- ---------------------------------------------------------------------
-- SEC-04 — Abonnements push : 5 appareils max par personne, services push connus seulement
-- ---------------------------------------------------------------------
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare me text := public.my_who(); s uuid := public.my_salon(); host text;
begin
  if me is null or s is null then raise exception 'Pas connecté' using errcode = '42501'; end if;
  host := lower(substring(p_endpoint from '^https://([^/:?#]+)'));
  if host is null or char_length(p_endpoint) > 1000 or not (
       host = 'fcm.googleapis.com' or host = 'updates.push.services.mozilla.com'
    or host = 'web.push.apple.com' or host like '%.push.apple.com'
    or host like '%.notify.windows.com') then
    raise exception 'ABONNEMENT_INVALIDE : service de notification inconnu' using errcode = '22023';
  end if;
  if char_length(coalesce(p_p256dh, '')) > 200 or char_length(coalesce(p_auth, '')) > 100 then
    raise exception 'ABONNEMENT_INVALIDE : clés invalides' using errcode = '22023';
  end if;
  if (select count(*) from public.push_subscriptions
      where salon_id = s and who = me and endpoint <> p_endpoint) >= 5 then
    -- on retire le plus ancien plutôt que de refuser (changement de téléphone)
    delete from public.push_subscriptions where endpoint = (
      select endpoint from public.push_subscriptions where salon_id = s and who = me
      order by last_seen_at asc limit 1);
  end if;
  insert into public.push_subscriptions (endpoint, who, salon_id, p256dh, auth, user_agent)
  values (p_endpoint, me, s, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set who = excluded.who, salon_id = excluded.salon_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, last_seen_at = now();
end $$;
-- (Côté Edge Function rappel-veille : option { timeout: 5000 } dans sendNotification, envois en parallèle
--  limité, journal écrit salon par salon — voir le rapport.)

-- ---------------------------------------------------------------------
-- SEC-05 — salon_login_email : ne plus renvoyer une adresse RÉELLE à un visiteur anonyme
-- Option recommandée : la connexion passe par l'Edge Function « salons » (action "connexion") qui fait
-- elle-même signInWithPassword et renvoie la session ; salon_login_email devient réservée au serveur :
-- revoke execute on function public.salon_login_email(uuid, text) from anon, authenticated;
-- grant execute on function public.salon_login_email(uuid, text) to service_role;
-- Option intermédiaire (sans toucher au site) : comptes TOUJOURS créés avec l'adresse technique, et
-- l'adresse réelle rangée à part (profiles.email_secours, lisible seulement par le membre lui-même),
-- utilisée seulement pour « mot de passe oublié » via l'Edge Function.

-- ---------------------------------------------------------------------
-- SEC-10 — Une case préparée ne peut référencer que des photos de SON auteur, dans SON salon
-- ---------------------------------------------------------------------
create or replace function public.prepared_photos_ok(p_salon uuid, p_from text, p_photos text[]) returns boolean
language sql immutable as $$
  select coalesce(bool_and(
           p like p_salon::text || '/' || p_from || '/%'
           or (p_salon = '00000000-0000-0000-0000-000000000001'::uuid and p like p_from || '/%')), true)
  from unnest(p_photos) as p
$$;
alter table public.prepared_content drop constraint if exists prepared_photos_du_salon;
alter table public.prepared_content add constraint prepared_photos_du_salon
  check (public.prepared_photos_ok(salon_id, from_who, photos)) not valid;
-- Vérifier les lignes existantes avant : select * from public.prepared_content where not public.prepared_photos_ok(salon_id, from_who, photos);
-- puis : alter table public.prepared_content validate constraint prepared_photos_du_salon;

-- photo_frozen : seulement les cases du salon propriétaire du fichier
create or replace function public.photo_frozen(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.prepared_content p
    where object_name = any (p.photos)
      and (split_part(object_name, '/', 1) = p.salon_id::text or p.salon_id = public.legacy_salon_id())
      and public.prepared_frozen_in(p.salon_id, p.day, p.to_who))
$$;

-- ---------------------------------------------------------------------
-- SEC-11 — Droits minimaux
-- ---------------------------------------------------------------------
-- Fonctions internes (règles d'accès, déclencheurs) : inutile de les exposer dans /rest/v1/rpc.
-- ATTENTION : les politiques RLS appellent ces fonctions avec les droits de l'utilisateur ; elles doivent
-- rester exécutables par « authenticated ». On retire seulement « anon » (et public), sauf advent_today
-- et les trois fonctions publiques des salons.
revoke execute on function
  public.my_who(), public.my_salon(), public.salon_today(uuid), public.advent_day_at(timestamptz),
  public.prepared_frozen(int, text), public.prepared_frozen_in(uuid, int, text),
  public.photo_readable(text), public.photo_owner_ok(text), public.photo_frozen(text), public.salon_photo_quota_ok(),
  public.touch_row(), public.prepared_guard(), public.salons_guard(), public.rls_auto_enable()
  from public, anon;
-- advent_today() appelle salon_today() en SECURITY DEFINER : elle reste utilisable par anon.

-- Fonctions de déclencheur : jamais appelées directement
revoke execute on function public.touch_row(), public.prepared_guard(), public.salons_guard(), public.rls_auto_enable()
  from authenticated;

-- Privilèges de table inutiles (TRUNCATE n'est PAS soumis à la RLS)
revoke truncate, trigger, references on
  public.app_settings, public.game_state, public.prepared_content, public.profiles, public.progress,
  public.push_subscriptions, public.reminder_log
  from anon, authenticated;
revoke all on public.reminder_log, public.push_subscriptions from authenticated;
grant select, delete on public.push_subscriptions to authenticated;          -- politiques push_read_own / push_delete_own
revoke insert, update, delete on public.app_settings, public.profiles from authenticated;  -- lecture seule depuis le site

-- pg_net : personne d'autre que le serveur
revoke execute on all functions in schema net from anon, authenticated;
revoke usage on schema net from anon, authenticated;

-- search_path figé (avertissement du conseiller Supabase)
alter function public.partner_of(text) set search_path = public;
alter function public.legacy_salon_id() set search_path = public;
alter function public.salon_config_check(jsonb) set search_path = public;
alter function public.new_salon_token() set search_path = public;

-- ---------------------------------------------------------------------
-- SEC-01 — Création de salons : ne pas compter les échecs, limiter plus bas, purger les salons inactifs
-- (le vrai remède est un CAPTCHA vérifié dans l'Edge Function, voir le rapport)
-- ---------------------------------------------------------------------
update public.app_settings set salon_creations_par_heure = 2 where id = 1;
-- Dans salon_create : compter seulement les salons qui existent encore
--   … from public.salon_creations c join public.salons s on s.id = c.salon_id …
-- Purge élargie : salons sans aucune progression ni contenu préparé 3 jours après leur création,
-- même si l'invité·e les a rejoints (à planifier avec pg_cron, après relecture) :
-- select cron.schedule('purge-salons', '17 3 * * *', $$select public.purge_salons_vides(3)$$);

-- ---------------------------------------------------------------------
-- SEC-07 — RGPD : durée de conservation du journal des créations
-- ---------------------------------------------------------------------
-- select cron.schedule('purge-journal-creations', '23 4 * * *',
--   $$delete from public.salon_creations where created_at < now() - interval '30 days'$$);
