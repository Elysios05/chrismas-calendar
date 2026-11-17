-- =====================================================================
-- Relance de 22 h 30 (heure de Paris) si la case préparée du lendemain est TOUJOURS vide.
-- À exécuter après 0002_rappels.sql : SQL Editor → coller → Run. Ré-exécutable.
-- Puis relancer supabase/cron_rappel.sql (il planifie aussi la relance).
-- =====================================================================

-- Réglages : heure du premier rappel (minute) et de la relance (null = pas de relance)
alter table public.app_settings add column if not exists reminder_minute int not null default 0
  check (reminder_minute between 0 and 59);
alter table public.app_settings add column if not exists followup_time time default '22:30';

-- Journal : un rappel et une relance par (jour, personne), comptés séparément
alter table public.reminder_log add column if not exists kind text not null default 'rappel'
  check (kind in ('rappel', 'relance'));
do $$ begin
  if (select count(*) from information_schema.key_column_usage
      where table_schema = 'public' and table_name = 'reminder_log' and constraint_name = 'reminder_log_pkey') = 2 then
    alter table public.reminder_log drop constraint reminder_log_pkey;
    alter table public.reminder_log add primary key (day, who, kind);
  end if;
end $$;

-- Quel envoi correspond à cet instant ? 'rappel', 'relance' ou null.
-- Tolérance de ±10 min autour de l'heure réglée (la tâche pg_cron peut démarrer avec un peu de retard).
-- La tâche tourne deux fois (heure d'hiver / d'été en UTC) : une seule tombe à la bonne heure de Paris.
create or replace function public.reminder_kind_at(at_time timestamptz) returns text
language sql stable security definer set search_path = public as $$
  with cfg as (
    select coalesce(s.timezone, 'Europe/Paris') as tz,
           make_time(coalesce(s.reminder_hour, 20), coalesce(s.reminder_minute, 0), 0) as rappel,
           s.followup_time as relance
    from (select 1) one left join public.app_settings s on s.id = 1
  ), t as (
    select (at_time at time zone cfg.tz)::time as local, cfg.rappel, cfg.relance from cfg
  )
  select case
    when abs(extract(epoch from (t.local - t.rappel))) <= 600 then 'rappel'
    when t.relance is not null and abs(extract(epoch from (t.local - t.relance))) <= 600 then 'relance'
  end
  from t
$$;
revoke execute on function public.reminder_kind_at(timestamptz) from public, anon;
grant execute on function public.reminder_kind_at(timestamptz) to authenticated, service_role;

-- Nouvelle version de reminder_targets, avec le type d'envoi
--   p_day  : jour à traiter (tests, sans contrôle de l'heure) ; sinon « demain », et seulement à l'heure d'un envoi
--   p_kind : 'rappel' ou 'relance' (tests) ; sinon déduit de l'heure de Paris
--   p_force: ignore l'heure et le journal
drop function if exists public.reminder_targets(int, boolean);
drop function if exists public.reminder_targets(int, boolean, text);
create function public.reminder_targets(p_day int default null, p_force boolean default false, p_kind text default null)
returns table (day int, who text, kind text, endpoint text, p256dh text, auth text)
language plpgsql stable security definer set search_path = public as $$
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

  if p_day is not null then
    tomorrow := p_day;
  else
    tomorrow := public.advent_day_at(now() + interval '1 day');
    if tomorrow <> public.advent_today() + 1 then return; end if; -- ex. le 24 au soir : pas de « demain »
  end if;
  if tomorrow not in (4, 8, 12, 16, 20, 24) then return; end if;

  return query
  select tomorrow, a.who, k, s.endpoint, s.p256dh, s.auth
  from (values ('alexandre'), ('flavie')) as a(who)
  join public.push_subscriptions s on s.who = a.who
  where not exists (
          select 1 from public.prepared_content p
          where p.day = tomorrow and p.from_who = a.who
            and (btrim(p.message) <> '' or cardinality(p.photos) > 0))
    and (p_force or not exists (
          select 1 from public.reminder_log l where l.day = tomorrow and l.who = a.who and l.kind = k));
end $$;

revoke execute on function public.reminder_targets(int, boolean, text) from public, anon, authenticated;
grant execute on function public.reminder_targets(int, boolean, text) to service_role;
