-- =====================================================================
-- Rappels la veille d'une case préparée encore vide (notifications push)
-- À exécuter après 0001_init.sql : SQL Editor → coller → Run. Ré-exécutable.
-- La planification (pg_cron) est dans supabase/cron_rappel.sql, à lancer APRÈS
-- avoir déployé l'Edge Function rappel-veille (voir docs/supabase.md, étape 10).
-- =====================================================================

-- Heure du rappel (heure de Paris), modifiable comme les autres réglages
alter table public.app_settings add column if not exists reminder_hour int not null default 20
  check (reminder_hour between 0 and 23);

-- ---------------------------------------------------------------------
-- Abonnements push : un par appareil (navigateur)
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  endpoint     text primary key check (endpoint like 'https://%'),
  who          text not null check (who in ('alexandre', 'flavie')),
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Journal des rappels envoyés (évite les doublons si la tâche est relancée)
create table if not exists public.reminder_log (
  day     int  not null check (day between 1 and 24),
  who     text not null check (who in ('alexandre', 'flavie')),
  sent_at timestamptz not null default now(),
  devices int not null default 0,
  primary key (day, who)
);

alter table public.push_subscriptions enable row level security;
alter table public.reminder_log       enable row level security;
revoke all on public.push_subscriptions, public.reminder_log from anon;

-- Chacun ne voit que ses propres appareils ; l'écriture passe par les fonctions ci-dessous
drop policy if exists push_read_own on public.push_subscriptions;
create policy push_read_own on public.push_subscriptions for select to authenticated
  using (who = public.my_who());
drop policy if exists push_delete_own on public.push_subscriptions;
create policy push_delete_own on public.push_subscriptions for delete to authenticated
  using (who = public.my_who());
-- reminder_log : aucune politique → illisible depuis le site (seule l'Edge Function, en service_role, y accède)

-- Enregistre (ou ré-attribue) l'abonnement de CET appareil à la personne connectée.
-- Si Flavie se connecte sur un téléphone d'abord utilisé par Alexandre, l'appareil passe à Flavie.
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare me text := public.my_who();
begin
  if me is null then raise exception 'Pas connecté' using errcode = '42501'; end if;
  insert into public.push_subscriptions (endpoint, who, p256dh, auth, user_agent)
  values (p_endpoint, me, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set who = excluded.who, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, last_seen_at = now();
end $$;

create or replace function public.delete_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and who = public.my_who()
$$;

revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
revoke execute on function public.delete_push_subscription(text) from public, anon;
grant  execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant  execute on function public.delete_push_subscription(text) to authenticated;

-- ---------------------------------------------------------------------
-- Qui faut-il prévenir maintenant ? (appelée par l'Edge Function, en service_role)
--   - seulement à l'heure du rappel (heure de Paris), sauf p_force ;
--   - « demain » = la case qui s'ouvrira au prochain 7 h ; ce doit être une case préparée ;
--   - auteurs dont la case pour l'autre est vide (pas de ligne, ou ni texte ni photo) ;
--   - pas déjà prévenus pour ce jour (reminder_log), sauf p_force.
-- p_day permet de tester un jour précis.
-- ---------------------------------------------------------------------
create or replace function public.reminder_targets(p_day int default null, p_force boolean default false)
returns table (day int, who text, endpoint text, p256dh text, auth text)
language plpgsql stable security definer set search_path = public as $$
declare
  cfg record;
  paris_hour int;
  tomorrow int;
begin
  select coalesce(s.timezone, 'Europe/Paris') as tz, coalesce(s.reminder_hour, 20) as h into cfg
  from (select 1) one left join public.app_settings s on s.id = 1;
  paris_hour := extract(hour from now() at time zone cfg.tz)::int;

  if p_day is not null then
    tomorrow := p_day;
  else
    if not p_force and paris_hour <> cfg.h then return; end if;  -- pas l'heure (gère heure d'été/hiver)
    tomorrow := public.advent_day_at(now() + interval '1 day');
    if tomorrow <> public.advent_today() + 1 then return; end if; -- ex. le 24 au soir : pas de « demain »
  end if;
  if tomorrow not in (4, 8, 12, 16, 20, 24) then return; end if;

  return query
  select tomorrow, a.who, s.endpoint, s.p256dh, s.auth
  from (values ('alexandre'), ('flavie')) as a(who)
  join public.push_subscriptions s on s.who = a.who
  where not exists (
          select 1 from public.prepared_content p
          where p.day = tomorrow and p.from_who = a.who
            and (btrim(p.message) <> '' or cardinality(p.photos) > 0))
    and (p_force or not exists (select 1 from public.reminder_log l where l.day = tomorrow and l.who = a.who));
end $$;

revoke execute on function public.reminder_targets(int, boolean) from public, anon, authenticated;
grant execute on function public.reminder_targets(int, boolean) to service_role;
