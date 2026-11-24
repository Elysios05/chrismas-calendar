-- =====================================================================
-- Chrismas Calendar — schéma initial et règles d'accès (RLS)
-- À exécuter UNE fois dans Supabase : SQL Editor → coller → Run.
-- Le script est ré-exécutable (create … if not exists / or replace / drop policy if exists).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Réglages (modifiables depuis Table Editor → app_settings)
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  id           int primary key default 1 check (id = 1),     -- une seule ligne
  timezone     text not null default 'Europe/Paris',          -- fuseau de référence
  open_hour    int  not null default 7 check (open_hour between 0 and 23), -- heure d'ouverture (7 = 7 h du matin)
  day_override int  check (day_override between 0 and 24)    -- pour tester : force « aujourd'hui » (null = vraie date)
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2. Profils : relie chaque compte Supabase à « alexandre » ou « flavie »
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  who     text not null unique check (who in ('alexandre', 'flavie'))
);

-- Qui suis-je ? (null si le compte n'a pas de profil → aucun accès)
create or replace function public.my_who() returns text
language sql stable security definer set search_path = public as $$
  select who from public.profiles where user_id = auth.uid()
$$;

create or replace function public.partner_of(w text) returns text
language sql immutable as $$
  select case w when 'alexandre' then 'flavie' when 'flavie' then 'alexandre' end
$$;

-- ---------------------------------------------------------------------
-- 3. « Aujourd'hui » calculé CÔTÉ SERVEUR
--    On recule de open_hour heures (avant 7 h, c'est encore la veille), puis :
--    décembre → jour du mois (max 24) ; janvier–juin → 24 (tout reste ouvert) ; sinon 0.
-- ---------------------------------------------------------------------
create or replace function public.advent_day_at(at_time timestamptz) returns int
language sql stable security definer set search_path = public as $$
  with cfg as (
    select coalesce(s.timezone, 'Europe/Paris') as tz, coalesce(s.open_hour, 7) as h
    from (select 1) one left join public.app_settings s on s.id = 1
  ), t as (
    select (at_time at time zone cfg.tz) - make_interval(hours => cfg.h) as local from cfg
  )
  select case
      when extract(month from t.local) = 12 then least(extract(day from t.local)::int, 24)
      when extract(month from t.local) <= 6 then 24
      else 0
    end
  from t
$$;

create or replace function public.advent_today() returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select day_override from public.app_settings where id = 1), public.advent_day_at(now()))
$$;

-- ---------------------------------------------------------------------
-- 4. Progression : une ligne par (personne, case ouverte)
-- ---------------------------------------------------------------------
create table if not exists public.progress (
  who          text not null check (who in ('alexandre', 'flavie')),
  day          int  not null check (day between 1 and 24),
  opened_at    timestamptz not null default now(),
  completed_at timestamptz,
  primary key (who, day)
);

-- ---------------------------------------------------------------------
-- 5. Cases préparées (4, 8, 12, 16, 20, 24) — une par auteur et par jour
--    photos = chemins dans le bucket « photos » (ex. 'flavie/1234.jpg')
-- ---------------------------------------------------------------------
create table if not exists public.prepared_content (
  day        int  not null check (day in (4, 8, 12, 16, 20, 24)),
  from_who   text not null check (from_who in ('alexandre', 'flavie')),
  to_who     text not null check (to_who in ('alexandre', 'flavie')),
  message    text not null default '' check (char_length(message) <= 20000),
  photos     text[] not null default '{}' check (cardinality(photos) <= 20),
  updated_at timestamptz not null default now(),
  primary key (day, from_who),
  unique (day, to_who),
  check (to_who = public.partner_of(from_who))
);

-- ---------------------------------------------------------------------
-- 6. État des jeux (scores, dessins, résultats…) : JSON libre
-- ---------------------------------------------------------------------
create table if not exists public.game_state (
  day        int  not null check (day between 1 and 24),
  key        text not null check (char_length(key) between 1 and 200),
  value      jsonb,
  updated_by text default public.my_who(),
  updated_at timestamptz not null default now(),
  primary key (day, key)
);

-- Horodatage et auteur mis à jour automatiquement (impossible à falsifier depuis le client)
create or replace function public.touch_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_table_name = 'game_state' then new.updated_by := public.my_who(); end if;
  return new;
end $$;

drop trigger if exists prepared_touch on public.prepared_content;
create trigger prepared_touch before insert or update on public.prepared_content
  for each row execute function public.touch_row();
-- Case préparée FIGÉE dès que le destinataire l'a ouverte (ligne dans progress) :
-- plus aucune création, modification ni suppression par l'auteur. Erreur explicite « CASE_FIGEE ».
create or replace function public.prepared_frozen(p_day int, p_to text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.progress where who = p_to and day = p_day)
$$;

create or replace function public.prepared_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  if public.prepared_frozen(r.day, r.to_who)
     or (tg_op = 'UPDATE' and public.prepared_frozen(old.day, old.to_who)) then
    raise exception 'CASE_FIGEE : la case % a déjà été ouverte par %, elle ne peut plus être modifiée', r.day, r.to_who
      using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists prepared_guard on public.prepared_content;
create trigger prepared_guard before insert or update or delete on public.prepared_content
  for each row execute function public.prepared_guard();

drop trigger if exists game_state_touch on public.game_state;
create trigger game_state_touch before insert or update on public.game_state
  for each row execute function public.touch_row();

-- =====================================================================
-- RÈGLES D'ACCÈS (RLS) — tout est fermé par défaut, on ouvre au strict nécessaire
-- =====================================================================
alter table public.app_settings     enable row level security;
alter table public.profiles         enable row level security;
alter table public.progress         enable row level security;
alter table public.prepared_content enable row level security;
alter table public.game_state       enable row level security;

-- On retire les droits implicites aux visiteurs non connectés
revoke all on public.app_settings, public.profiles, public.progress, public.prepared_content, public.game_state from anon;
-- La date du serveur n'est pas un secret : lisible même avant connexion (pour afficher la carte)
grant  execute on function public.advent_today() to anon, authenticated;

-- app_settings : lecture pour les deux comptes, écriture uniquement depuis le tableau de bord
drop policy if exists settings_read on public.app_settings;
create policy settings_read on public.app_settings for select to authenticated
  using (public.my_who() is not null);

-- profiles : chacun voit les deux profils ; aucune écriture depuis le site
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (public.my_who() is not null);

-- progress : on voit la progression des deux (petite course), on n'écrit que la sienne,
-- et seulement pour une case déjà ouverte selon la date du serveur
drop policy if exists progress_read on public.progress;
create policy progress_read on public.progress for select to authenticated
  using (public.my_who() is not null);
drop policy if exists progress_insert on public.progress;
create policy progress_insert on public.progress for insert to authenticated
  with check (who = public.my_who() and day <= public.advent_today());
drop policy if exists progress_update on public.progress;
create policy progress_update on public.progress for update to authenticated
  using (who = public.my_who())
  with check (who = public.my_who() and day <= public.advent_today());

-- prepared_content : POINT CRUCIAL
--   - l'auteur lit toujours la sienne, et la modifie tant que le destinataire ne l'a pas ouverte ;
--   - le destinataire ne la lit qu'à partir du jour J (date serveur), et ne peut jamais la modifier.
drop policy if exists prepared_read on public.prepared_content;
create policy prepared_read on public.prepared_content for select to authenticated
  using (
    from_who = public.my_who()
    or (to_who = public.my_who() and day <= public.advent_today())
  );
drop policy if exists prepared_insert on public.prepared_content;
create policy prepared_insert on public.prepared_content for insert to authenticated
  with check (from_who = public.my_who() and to_who = public.partner_of(public.my_who())
              and not public.prepared_frozen(day, to_who));
drop policy if exists prepared_update on public.prepared_content;
create policy prepared_update on public.prepared_content for update to authenticated
  using (from_who = public.my_who() and not public.prepared_frozen(day, to_who))
  with check (from_who = public.my_who() and to_who = public.partner_of(public.my_who()));
drop policy if exists prepared_delete on public.prepared_content;
create policy prepared_delete on public.prepared_content for delete to authenticated
  using (from_who = public.my_who() and not public.prepared_frozen(day, to_who));

-- game_state : partagé entre les deux comptes
drop policy if exists game_read on public.game_state;
create policy game_read on public.game_state for select to authenticated
  using (public.my_who() is not null);
drop policy if exists game_insert on public.game_state;
create policy game_insert on public.game_state for insert to authenticated
  with check (public.my_who() is not null);
drop policy if exists game_update on public.game_state;
create policy game_update on public.game_state for update to authenticated
  using (public.my_who() is not null) with check (public.my_who() is not null);

-- =====================================================================
-- STOCKAGE DES PHOTOS — bucket privé « photos », fichiers rangés par auteur : <who>/<fichier>
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760,  -- 10 Mo max par fichier (le site compresse avant)
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Une photo est lisible par :
--   - son auteur (dossier = son nom) ;
--   - le destinataire d'une case préparée qui la contient, à partir du jour J.
-- (Une photo envoyée par uploadPhoto est aussi partageable via l'URL signée renvoyée à l'auteur.)
create or replace function public.photo_readable(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_who() is not null and (
    split_part(object_name, '/', 1) = public.my_who()
    or exists (
      select 1 from public.prepared_content p
      where p.to_who = public.my_who()
        and p.day <= public.advent_today()
        and object_name = any (p.photos)
    )
  )
$$;

-- Une photo d'une case DÉJÀ OUVERTE par son destinataire ne peut plus être remplacée ni supprimée
-- (sinon l'auteur pourrait vider une case figée en effaçant les fichiers).
create or replace function public.photo_frozen(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.prepared_content p
    where object_name = any (p.photos) and public.prepared_frozen(p.day, p.to_who)
  )
$$;

drop policy if exists photos_read on storage.objects;
create policy photos_read on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.photo_readable(name));
drop policy if exists photos_insert on storage.objects;
create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and split_part(name, '/', 1) = public.my_who());
drop policy if exists photos_update on storage.objects;
create policy photos_update on storage.objects for update to authenticated
  using (bucket_id = 'photos' and split_part(name, '/', 1) = public.my_who() and not public.photo_frozen(name))
  with check (bucket_id = 'photos' and split_part(name, '/', 1) = public.my_who());
drop policy if exists photos_delete on storage.objects;
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and split_part(name, '/', 1) = public.my_who() and not public.photo_frozen(name));

-- =====================================================================
-- TEMPS RÉEL — canaux privés « room:… » réservés aux deux comptes
-- (broadcast + presence ; le site utilise des canaux privés)
-- =====================================================================
drop policy if exists rooms_read on realtime.messages;
create policy rooms_read on realtime.messages for select to authenticated
  using (public.my_who() is not null and realtime.topic() like 'room:%');
drop policy if exists rooms_write on realtime.messages;
create policy rooms_write on realtime.messages for insert to authenticated
  with check (public.my_who() is not null and realtime.topic() like 'room:%');
