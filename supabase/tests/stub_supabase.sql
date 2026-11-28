-- Imitation MINIMALE des schémas fournis par Supabase (auth, storage, realtime),
-- pour tester la migration et les règles RLS sur un Postgres local. Ne pas exécuter sur Supabase !
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (id uuid primary key, email text unique, last_sign_in_at timestamptz);
create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz default now(), updated_at timestamptz default now(), refreshed_at timestamp);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;

create schema storage;
create table storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (id serial primary key, bucket_id text, name text, metadata jsonb);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant usage on sequence storage.objects_id_seq to anon, authenticated;

create schema realtime;
create table realtime.messages (id serial primary key, topic text, payload jsonb);
create function realtime.topic() returns text language sql stable as $$
  select current_setting('realtime.topic', true)
$$;
alter table realtime.messages enable row level security;
grant usage on schema realtime to anon, authenticated;
grant select, insert on realtime.messages to anon, authenticated;
grant usage on sequence realtime.messages_id_seq to anon, authenticated;

-- Droits par défaut que Supabase donne sur le schéma public
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
set client_min_messages = error;
create publication supabase_realtime;  -- comme sur Supabase (vide au départ)
