-- =====================================================================
-- Salons : un calendrier par couple, tous dans le même projet Supabase (docs/salons.md).
-- À exécuter après 0003_relance.sql : SQL Editor → coller → Run. Ré-exécutable.
--
-- Principe : chaque compte appartient à UN salon (profiles.salon_id) et y occupe une PLACE
-- ('alexandre' = créateur, 'flavie' = invité·e). Toutes les données portent un salon_id, et les
-- règles d'accès (RLS) ne laissent voir que celles de SON salon. my_salon() remplit salon_id tout seul.
--
-- Si des comptes existaient déjà (avant les salons), ils sont rangés dans un « salon principal »
-- (Alexandre et Flavie) : rien n'est perdu.
--
-- Création d'un salon et première connexion de l'invité·e : par l'Edge Function « salons »
-- (supabase/functions/salons), qui crée les comptes. Ces fonctions-là sont réservées au serveur.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Réglages : garde-fous (modifiables dans Table Editor → app_settings)
-- ---------------------------------------------------------------------
alter table public.app_settings add column if not exists salon_photo_max int not null default 150
  check (salon_photo_max between 0 and 10000);                -- photos par salon
alter table public.app_settings add column if not exists salon_creations_par_heure int not null default 5
  check (salon_creations_par_heure >= 0);                    -- par appareil (adresse IP) et par heure
alter table public.app_settings add column if not exists salon_creations_par_jour int not null default 50
  check (salon_creations_par_jour >= 0);                     -- pour tout le site (protège l'offre gratuite)

-- ---------------------------------------------------------------------
-- 2. Tables des salons
-- ---------------------------------------------------------------------
create table if not exists public.salons (
  id           uuid primary key default gen_random_uuid(),
  config       jsonb not null,                                -- SalonConfig (src/core/contracts.ts)
  day_override int check (day_override between 0 and 24),    -- pour tester CE salon (null = vraie date)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Jetons d'invitation (usage unique). Un nouveau lien supprime les anciens jetons non utilisés.
create table if not exists public.salon_invitations (
  token      text primary key check (char_length(token) >= 32),
  salon_id   uuid not null references public.salons (id) on delete cascade,
  created_at timestamptz not null default now(),
  used_at    timestamptz,
  used_by    uuid
);
create index if not exists salon_invitations_salon on public.salon_invitations (salon_id);

-- Journal des créations (limite par appareil et par jour). L'adresse IP n'est gardée que hachée.
create table if not exists public.salon_creations (
  id         bigserial primary key,
  ip_hash    text not null,
  salon_id   uuid,
  created_at timestamptz not null default now()
);
create index if not exists salon_creations_recent on public.salon_creations (created_at);

-- Identifiant fixe du salon principal (comptes créés avant les salons)
create or replace function public.legacy_salon_id() returns uuid
language sql immutable as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;

-- Vérifie une configuration de salon (mêmes règles que checkSalonConfig, src/backend/config.ts)
create or replace function public.salon_config_check(c jsonb) returns void
language plpgsql immutable as $$
declare w text; col text; p text; k text; v jsonb;
begin
  if c is null or jsonb_typeof(c) <> 'object' or jsonb_typeof(c -> 'joueurs') is distinct from 'object' then
    raise exception 'CONFIG_INVALIDE : réglages du calendrier manquants';
  end if;
  if octet_length(c::text) > 204800 then
    raise exception 'CONFIG_INVALIDE : contenu trop volumineux (200 Ko maximum)';
  end if;
  foreach w in array array['alexandre', 'flavie'] loop
    p := btrim(coalesce(c -> 'joueurs' -> w ->> 'prenom', ''));
    if p = '' then raise exception 'CONFIG_INVALIDE : il manque un prénom'; end if;
    if char_length(p) > 30 then raise exception 'CONFIG_INVALIDE : prénom trop long (30 caractères maximum)'; end if;
    foreach col in array array['coat', 'hat', 'pompom', 'hair'] loop
      v := c -> 'joueurs' -> w -> 'couleurs' -> col;
      if jsonb_typeof(v) is distinct from 'number' or (v::text)::numeric not between 0 and 16777215
         or (v::text)::numeric <> floor((v::text)::numeric) then
        raise exception 'CONFIG_INVALIDE : couleurs du personnage invalides';
      end if;
    end loop;
    if jsonb_typeof(c -> 'joueurs' -> w -> 'couleurs' -> 'longHair') is distinct from 'boolean' then
      raise exception 'CONFIG_INVALIDE : couleurs du personnage invalides';
    end if;
  end loop;
  if c ? 'contenu' and jsonb_typeof(c -> 'contenu') <> 'object' then
    raise exception 'CONFIG_INVALIDE : contenu des jeux invalide';
  end if;
  for k in select jsonb_object_keys(coalesce(c -> 'contenu', '{}'::jsonb)) loop
    if k !~ '^([1-9]|1[0-9]|2[0-4])$' then raise exception 'CONFIG_INVALIDE : jour de jeu invalide : %', k; end if;
  end loop;
end $$;

create or replace function public.salons_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.salon_config_check(new.config);
  if not (new.config ? 'contenu') then new.config := new.config || '{"contenu": {}}'::jsonb; end if;
  if tg_op = 'UPDATE' then new.id := old.id; new.created_at := old.created_at; end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists salons_guard on public.salons;
create trigger salons_guard before insert or update on public.salons
  for each row execute function public.salons_guard();

-- Crée le salon principal si des données d'avant les salons existent
create or replace function public.ensure_legacy_salon() returns uuid
language plpgsql security definer set search_path = public as $$
begin
  insert into public.salons (id, config) values (public.legacy_salon_id(), jsonb_build_object(
    'joueurs', jsonb_build_object(
      'alexandre', jsonb_build_object('prenom', 'Alexandre', 'couleurs',
        jsonb_build_object('coat', 3108789, 'hat', 2047339, 'pompom', 16777215, 'hair', 4861471, 'longHair', false)),
      'flavie', jsonb_build_object('prenom', 'Flavie', 'couleurs',
        jsonb_build_object('coat', 14234955, 'hat', 16777215, 'pompom', 14234955, 'hair', 7027234, 'longHair', true))),
    'contenu', '{}'::jsonb))
  on conflict (id) do nothing;
  return public.legacy_salon_id();
end $$;

-- ---------------------------------------------------------------------
-- 3. Profils = appartenance à un salon + place
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists salon_id uuid references public.salons (id) on delete cascade;
do $$ begin
  if exists (select 1 from public.profiles where salon_id is null) then
    perform public.ensure_legacy_salon();
    update public.profiles set salon_id = public.legacy_salon_id() where salon_id is null;
  end if;
end $$;
alter table public.profiles alter column salon_id set not null;
alter table public.profiles drop constraint if exists profiles_who_key;   -- une place par salon, plus une seule au total
create unique index if not exists profiles_salon_who on public.profiles (salon_id, who);

-- Mon salon (null si le compte n'a pas de profil → aucun accès)
create or replace function public.my_salon() returns uuid
language sql stable security definer set search_path = public as $$
  select salon_id from public.profiles where user_id = auth.uid()
$$;

-- « Aujourd'hui » pour un salon : son day_override, sinon celui du site, sinon la vraie date
create or replace function public.salon_today(p_salon uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select day_override from public.salons where id = p_salon),
    (select day_override from public.app_settings where id = 1),
    public.advent_day_at(now()))
$$;
create or replace function public.advent_today() returns int
language sql stable security definer set search_path = public as $$
  select public.salon_today(public.my_salon())
$$;
grant execute on function public.advent_today() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. salon_id dans toutes les tables de données (+ clés primaires par salon)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  pk_cols text[];
  has_null boolean;
  spec record;
begin
  for spec in select * from (values
      ('progress',           array['salon_id', 'who', 'day'],             true),
      ('prepared_content',   array['salon_id', 'day', 'from_who'],        true),
      ('game_state',         array['salon_id', 'day', 'key'],             true),
      ('push_subscriptions', array['endpoint'],                           false),
      ('reminder_log',       array['salon_id', 'day', 'who', 'kind'],     false)
    ) as s(tbl, pk, unused)
  loop
    t := spec.tbl;
    execute format('alter table public.%I add column if not exists salon_id uuid references public.salons (id) on delete cascade', t);
    execute format('select exists (select 1 from public.%I where salon_id is null)', t) into has_null;
    if has_null then
      perform public.ensure_legacy_salon();
      execute format('update public.%I set salon_id = public.legacy_salon_id() where salon_id is null', t);
    end if;
    execute format('alter table public.%I alter column salon_id set not null', t);
    -- clé primaire : on la remplace si elle ne contient pas encore salon_id
    select array_agg(a.attname::text order by a.attnum) into pk_cols
    from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = format('public.%I', t)::regclass and c.contype = 'p';
    if spec.pk <> array['endpoint'] and not ('salon_id' = any (coalesce(pk_cols, '{}'))) then
      execute format('alter table public.%I drop constraint if exists %I', t, t || '_pkey');
      execute format('alter table public.%I add primary key (%s)', t, array_to_string(spec.pk, ', '));
    end if;
  end loop;
end $$;
-- Les écritures du site n'ont pas besoin de donner salon_id : c'est celui du compte connecté
alter table public.progress         alter column salon_id set default public.my_salon();
alter table public.prepared_content alter column salon_id set default public.my_salon();
alter table public.game_state       alter column salon_id set default public.my_salon();
alter table public.prepared_content drop constraint if exists prepared_content_day_to_who_key;
create unique index if not exists prepared_content_salon_day_to on public.prepared_content (salon_id, day, to_who);
create index if not exists push_subscriptions_salon on public.push_subscriptions (salon_id, who);

-- ---------------------------------------------------------------------
-- 5. Case préparée figée : par salon
-- ---------------------------------------------------------------------
create or replace function public.prepared_frozen_in(p_salon uuid, p_day int, p_to text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.progress where salon_id = p_salon and who = p_to and day = p_day)
$$;
-- Ancienne signature, gardée pour compatibilité : dans le salon de l'utilisateur connecté
create or replace function public.prepared_frozen(p_day int, p_to text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.prepared_frozen_in(public.my_salon(), p_day, p_to)
$$;

create or replace function public.prepared_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  if public.prepared_frozen_in(r.salon_id, r.day, r.to_who)
     or (tg_op = 'UPDATE' and public.prepared_frozen_in(old.salon_id, old.day, old.to_who)) then
    raise exception 'CASE_FIGEE : la case % a déjà été ouverte par %, elle ne peut plus être modifiée', r.day, r.to_who
      using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

-- =====================================================================
-- 6. RÈGLES D'ACCÈS (RLS) : chacun ne voit que SON salon
--    (mêmes noms de politiques que 0001 : elles sont remplacées)
-- =====================================================================
alter table public.salons            enable row level security;
alter table public.salon_invitations enable row level security;
alter table public.salon_creations   enable row level security;
revoke all on public.salons, public.salon_invitations, public.salon_creations from anon;
revoke all on public.salon_invitations, public.salon_creations from authenticated;   -- seulement via les fonctions
-- salons : les membres lisent et modifient la config ; rien d'autre (ni day_override, ni création, ni suppression)
revoke all on public.salons from authenticated;
grant select on public.salons to authenticated;
grant update (config) on public.salons to authenticated;

drop policy if exists salons_read on public.salons;
create policy salons_read on public.salons for select to authenticated using (id = public.my_salon());
drop policy if exists salons_update on public.salons;
create policy salons_update on public.salons for update to authenticated
  using (id = public.my_salon()) with check (id = public.my_salon());

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (salon_id = public.my_salon());

drop policy if exists progress_read on public.progress;
create policy progress_read on public.progress for select to authenticated
  using (salon_id = public.my_salon());
drop policy if exists progress_insert on public.progress;
create policy progress_insert on public.progress for insert to authenticated
  with check (salon_id = public.my_salon() and who = public.my_who() and day <= public.advent_today());
drop policy if exists progress_update on public.progress;
create policy progress_update on public.progress for update to authenticated
  using (salon_id = public.my_salon() and who = public.my_who())
  with check (salon_id = public.my_salon() and who = public.my_who() and day <= public.advent_today());

drop policy if exists prepared_read on public.prepared_content;
create policy prepared_read on public.prepared_content for select to authenticated
  using (salon_id = public.my_salon() and (
    from_who = public.my_who()
    or (to_who = public.my_who() and day <= public.advent_today())));
drop policy if exists prepared_insert on public.prepared_content;
create policy prepared_insert on public.prepared_content for insert to authenticated
  with check (salon_id = public.my_salon() and from_who = public.my_who() and to_who = public.partner_of(public.my_who())
              and not public.prepared_frozen_in(salon_id, day, to_who));
drop policy if exists prepared_update on public.prepared_content;
create policy prepared_update on public.prepared_content for update to authenticated
  using (salon_id = public.my_salon() and from_who = public.my_who() and not public.prepared_frozen_in(salon_id, day, to_who))
  with check (salon_id = public.my_salon() and from_who = public.my_who() and to_who = public.partner_of(public.my_who()));
drop policy if exists prepared_delete on public.prepared_content;
create policy prepared_delete on public.prepared_content for delete to authenticated
  using (salon_id = public.my_salon() and from_who = public.my_who() and not public.prepared_frozen_in(salon_id, day, to_who));

drop policy if exists game_read on public.game_state;
create policy game_read on public.game_state for select to authenticated
  using (salon_id = public.my_salon());
drop policy if exists game_insert on public.game_state;
create policy game_insert on public.game_state for insert to authenticated
  with check (salon_id = public.my_salon());
drop policy if exists game_update on public.game_state;
create policy game_update on public.game_state for update to authenticated
  using (salon_id = public.my_salon()) with check (salon_id = public.my_salon());

-- ---------------------------------------------------------------------
-- Rappels : abonnements par salon
-- ---------------------------------------------------------------------
drop policy if exists push_read_own on public.push_subscriptions;
create policy push_read_own on public.push_subscriptions for select to authenticated
  using (who = public.my_who() and salon_id = public.my_salon());
drop policy if exists push_delete_own on public.push_subscriptions;
create policy push_delete_own on public.push_subscriptions for delete to authenticated
  using (who = public.my_who() and salon_id = public.my_salon());

create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare me text := public.my_who(); s uuid := public.my_salon();
begin
  if me is null or s is null then raise exception 'Pas connecté' using errcode = '42501'; end if;
  insert into public.push_subscriptions (endpoint, who, salon_id, p256dh, auth, user_agent)
  values (p_endpoint, me, s, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set who = excluded.who, salon_id = excluded.salon_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, last_seen_at = now();
end $$;

create or replace function public.delete_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_subscriptions
  where endpoint = p_endpoint and who = public.my_who() and salon_id = public.my_salon()
$$;

-- Qui prévenir ? Comme avant, mais salon par salon, avec les prénoms pour le texte de la notification.
drop function if exists public.reminder_targets(int, boolean, text);
create function public.reminder_targets(p_day int default null, p_force boolean default false, p_kind text default null)
returns table (day int, who text, kind text, endpoint text, p256dh text, auth text,
               salon_id uuid, prenom text, prenom_autre text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  k text := p_kind;
  tomorrow int;
begin
  if k is null then
    k := public.reminder_kind_at(now());
    if k is null then
      if p_day is null and not p_force then return; end if;   -- pas l'heure
      k := 'rappel';                                           -- test (p_day / p_force) : rappel par défaut
    end if;
  end if;
  if k not in ('rappel', 'relance') then raise exception 'type d''envoi inconnu : %', k; end if;

  tomorrow := coalesce(p_day, public.advent_day_at(now() + interval '1 day'));
  if tomorrow not in (4, 8, 12, 16, 20, 24) then return; end if;

  return query
  select tomorrow, pr.who, k, s.endpoint, s.p256dh, s.auth, pr.salon_id,
         sa.config -> 'joueurs' -> pr.who ->> 'prenom',
         sa.config -> 'joueurs' -> public.partner_of(pr.who) ->> 'prenom'
  from public.profiles pr
  join public.salons sa on sa.id = pr.salon_id
  join public.push_subscriptions s on s.salon_id = pr.salon_id and s.who = pr.who
  -- « demain » doit bien être le lendemain dans CE salon (ex. le 24 au soir : pas de « demain »)
  where (p_day is not null or public.salon_today(pr.salon_id) + 1 = tomorrow)
    and not exists (
          select 1 from public.prepared_content p
          where p.salon_id = pr.salon_id and p.day = tomorrow and p.from_who = pr.who
            and (btrim(p.message) <> '' or cardinality(p.photos) > 0))
    and (p_force or not exists (
          select 1 from public.reminder_log l
          where l.salon_id = pr.salon_id and l.day = tomorrow and l.who = pr.who and l.kind = k));
end $$;
revoke execute on function public.reminder_targets(int, boolean, text) from public, anon, authenticated;
grant execute on function public.reminder_targets(int, boolean, text) to service_role;

-- =====================================================================
-- 7. Photos : rangées par salon, <salon>/<place>/<fichier> ; quota par salon
--    (les anciennes photos <place>/<fichier> appartiennent au salon principal)
-- =====================================================================
create or replace function public.photo_owner_ok(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_who() is not null and (
    (split_part(object_name, '/', 1) = public.my_salon()::text and split_part(object_name, '/', 2) = public.my_who())
    or (public.my_salon() = public.legacy_salon_id() and split_part(object_name, '/', 1) = public.my_who()))
$$;

create or replace function public.photo_readable(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_who() is not null and (
    public.photo_owner_ok(object_name)
    or exists (
      select 1 from public.prepared_content p
      where p.salon_id = public.my_salon()
        and p.to_who = public.my_who()
        and p.day <= public.advent_today()
        and object_name = any (p.photos)))
$$;

create or replace function public.photo_frozen(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.prepared_content p
    where object_name = any (p.photos) and public.prepared_frozen_in(p.salon_id, p.day, p.to_who))
$$;

-- Nombre de photos déjà envoyées dans mon salon, comparé au quota
create or replace function public.salon_photo_quota_ok() returns boolean
language sql stable security definer set search_path = public, storage as $$
  select (select count(*) from storage.objects o
          where o.bucket_id = 'photos' and (o.name like public.my_salon()::text || '/%'
            or (public.my_salon() = public.legacy_salon_id() and split_part(o.name, '/', 1) in ('alexandre', 'flavie'))))
       < (select coalesce(salon_photo_max, 150) from public.app_settings where id = 1)
$$;

drop policy if exists photos_read on storage.objects;
create policy photos_read on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.photo_readable(name));
drop policy if exists photos_insert on storage.objects;
create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.photo_owner_ok(name) and public.salon_photo_quota_ok());
drop policy if exists photos_update on storage.objects;
create policy photos_update on storage.objects for update to authenticated
  using (bucket_id = 'photos' and public.photo_owner_ok(name) and not public.photo_frozen(name))
  with check (bucket_id = 'photos' and public.photo_owner_ok(name));
drop policy if exists photos_delete on storage.objects;
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.photo_owner_ok(name) and not public.photo_frozen(name));

-- =====================================================================
-- 8. Temps réel : salles « room:<salon>:… » réservées aux membres du salon
-- =====================================================================
drop policy if exists rooms_read on realtime.messages;
create policy rooms_read on realtime.messages for select to authenticated
  using (public.my_salon() is not null and realtime.topic() like 'room:' || public.my_salon()::text || ':%');
drop policy if exists rooms_write on realtime.messages;
create policy rooms_write on realtime.messages for insert to authenticated
  with check (public.my_salon() is not null and realtime.topic() like 'room:' || public.my_salon()::text || ':%');

-- Réglages du salon modifiés par l'autre personne : prévenus en direct (postgres_changes, filtré par la RLS)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'salons') then
    alter publication supabase_realtime add table public.salons;
  end if;
end $$;

-- =====================================================================
-- 9. Fonctions des salons
-- =====================================================================
-- Jeton aléatoire (2 × 122 bits)
create or replace function public.new_salon_token() returns text
language sql volatile as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
$$;

-- ----- Visiteurs (même non connectés) -----

-- Ce qu'on peut savoir d'un salon sans en être membre : prénoms et couleurs (écran de connexion). Pas le contenu.
create or replace function public.salon_public(p_salon uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', s.id,
    'joueurs', s.config -> 'joueurs',
    'inviteArrive', exists (select 1 from public.profiles p where p.salon_id = s.id and p.who = 'flavie'),
    'createdAt', s.created_at)
  from public.salons s where s.id = p_salon
$$;

-- Que dit ce lien d'invitation ? (sans le consommer)
create or replace function public.salon_invitation_info(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare inv record; arrived boolean;
begin
  select i.*, s.config into inv from public.salon_invitations i join public.salons s on s.id = i.salon_id
  where i.token = p_token;
  if not found then return jsonb_build_object('statut', 'invalide'); end if;
  arrived := exists (select 1 from public.profiles p where p.salon_id = inv.salon_id and p.who = 'flavie');
  return jsonb_build_object(
    'statut', case when inv.used_at is null and not arrived then 'valide' else 'utilisee' end,
    'jeton', p_token, 'salonId', inv.salon_id, 'joueurs', inv.config -> 'joueurs');
end $$;

-- Adresse e-mail de connexion d'une place (réelle si donnée à la création, sinon adresse technique)
create or replace function public.salon_login_email(p_salon uuid, p_place text) returns text
language sql stable security definer set search_path = public, auth as $$
  select u.email from public.profiles p join auth.users u on u.id = p.user_id
  where p.salon_id = p_salon and p.who = p_place
$$;

-- ----- Membres connectés -----

-- Lien d'invitation du salon (créateur seulement, tant que l'invité·e n'est pas arrivé·e)
create or replace function public.salon_invitation(p_nouveau boolean default false) returns text
language plpgsql volatile security definer set search_path = public as $$
declare s uuid := public.my_salon(); tok text;
begin
  if s is null or public.my_who() is distinct from 'alexandre' then
    raise exception 'NON_AUTORISE : seule la personne qui a créé le calendrier peut inviter' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where salon_id = s and who = 'flavie') then
    raise exception 'INVITATION_UTILISEE : l''autre personne a déjà rejoint le calendrier';
  end if;
  if not p_nouveau then
    select token into tok from public.salon_invitations
    where salon_id = s and used_at is null order by created_at desc limit 1;
    if tok is not null then return tok; end if;
  end if;
  delete from public.salon_invitations where salon_id = s and used_at is null;
  tok := public.new_salon_token();
  insert into public.salon_invitations (token, salon_id) values (tok, s);
  return tok;
end $$;

-- ----- Serveur seulement (Edge Function « salons », en service_role) -----

-- Crée un salon (config vérifiée par le déclencheur) et son premier jeton d'invitation, avec les limites.
create or replace function public.salon_create(p_config jsonb, p_ip_hash text)
returns table (salon_id uuid, token text)
language plpgsql volatile security definer set search_path = public as $$
#variable_conflict use_column
declare cfg record; s uuid; tok text;
begin
  select coalesce(a.salon_creations_par_heure, 5) as per_ip, coalesce(a.salon_creations_par_jour, 50) as per_day
    into cfg from (select 1) one left join public.app_settings a on a.id = 1;
  if (select count(*) from public.salon_creations c
      where c.ip_hash = p_ip_hash and c.created_at > now() - interval '1 hour') >= cfg.per_ip then
    raise exception 'LIMITE_CREATION : trop de calendriers créés depuis cet appareil, réessaie dans une heure';
  end if;
  if (select count(*) from public.salon_creations c where c.created_at > now() - interval '1 day') >= cfg.per_day then
    raise exception 'LIMITE_CREATION : beaucoup de calendriers ont été créés aujourd''hui, réessaie demain';
  end if;
  insert into public.salons (config) values (p_config) returning id into s;
  tok := public.new_salon_token();
  insert into public.salon_invitations (token, salon_id) values (tok, s);
  insert into public.salon_creations (ip_hash, salon_id) values (coalesce(p_ip_hash, '?'), s);
  return query select s, tok;
end $$;

-- Relie un compte (déjà créé dans Auth) à une place d'un salon
create or replace function public.salon_join(p_salon uuid, p_user uuid, p_place text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if p_place not in ('alexandre', 'flavie') then raise exception 'place inconnue : %', p_place; end if;
  if exists (select 1 from public.profiles where salon_id = p_salon and who = p_place) then
    raise exception 'INVITATION_UTILISEE : cette place est déjà prise';
  end if;
  insert into public.profiles (user_id, who, salon_id) values (p_user, p_place, p_salon);
  if p_place = 'flavie' then
    update public.salon_invitations set used_by = p_user where salon_id = p_salon and used_at is not null and used_by is null;
  end if;
end $$;

-- Réserve un jeton d'invitation (usage unique, sans course possible) et renvoie son salon
create or replace function public.salon_claim_invitation(p_token text) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare s uuid;
begin
  update public.salon_invitations set used_at = now()
  where token = p_token and used_at is null
    and not exists (select 1 from public.profiles p where p.salon_id = salon_invitations.salon_id and p.who = 'flavie')
  returning salon_id into s;
  if s is null then
    if exists (select 1 from public.salon_invitations where token = p_token) then
      raise exception 'INVITATION_UTILISEE : ce lien d''invitation a déjà servi';
    end if;
    raise exception 'INVITATION_INVALIDE : ce lien d''invitation n''est pas (ou plus) valable';
  end if;
  return s;
end $$;

-- Annule la réservation si la création du compte a échoué
create or replace function public.salon_release_invitation(p_token text) returns void
language sql volatile security definer set search_path = public as $$
  update public.salon_invitations set used_at = null where token = p_token and used_by is null
$$;

-- Ménage : salons jamais rejoints, sans progression ni photo, créés il y a plus de p_jours jours.
-- Supprime aussi les comptes de leurs membres. À lancer à la main (SQL Editor) : select public.purge_salons_vides();
create or replace function public.purge_salons_vides(p_jours int default 14) returns int
language plpgsql volatile security definer set search_path = public, auth, storage as $$
declare ids uuid[]; n int;
begin
  select array_agg(s.id) into ids from public.salons s
  where s.id <> public.legacy_salon_id()
    and s.created_at < now() - make_interval(days => p_jours)
    and not exists (select 1 from public.profiles p where p.salon_id = s.id and p.who = 'flavie')
    and not exists (select 1 from public.progress g where g.salon_id = s.id)
    and not exists (select 1 from storage.objects o where o.bucket_id = 'photos' and o.name like s.id::text || '/%');
  if ids is null then return 0; end if;
  delete from auth.users u using public.profiles p where p.user_id = u.id and p.salon_id = any (ids);
  delete from public.salons where id = any (ids);
  get diagnostics n = row_count;
  return n;
end $$;

-- Supprime un salon et les comptes de ses membres (ex. : le salon de test d'Alexandre).
-- SQL Editor : select public.supprimer_salon('<id du salon>');  — les photos se suppriment dans Storage (dossier <id>/).
create or replace function public.supprimer_salon(p_salon uuid) returns int
language plpgsql volatile security definer set search_path = public, auth as $$
declare n int;
begin
  delete from auth.users u using public.profiles p where p.user_id = u.id and p.salon_id = p_salon;
  delete from public.salons where id = p_salon;
  get diagnostics n = row_count;
  return n;
end $$;

-- Droits : tout est retiré, puis rendu au strict nécessaire
revoke execute on function
  public.salon_public(uuid), public.salon_invitation_info(text), public.salon_login_email(uuid, text),
  public.salon_invitation(boolean), public.salon_create(jsonb, text), public.salon_join(uuid, uuid, text),
  public.salon_claim_invitation(text), public.salon_release_invitation(text), public.purge_salons_vides(int),
  public.ensure_legacy_salon(), public.new_salon_token(), public.supprimer_salon(uuid)
  from public, anon, authenticated;
grant execute on function public.salon_public(uuid), public.salon_invitation_info(text), public.salon_login_email(uuid, text)
  to anon, authenticated;
grant execute on function public.salon_invitation(boolean) to authenticated;
grant execute on function
  public.salon_create(jsonb, text), public.salon_join(uuid, uuid, text),
  public.salon_claim_invitation(text), public.salon_release_invitation(text), public.purge_salons_vides(int),
  public.supprimer_salon(uuid)
  to service_role;
