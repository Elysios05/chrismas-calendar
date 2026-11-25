-- Après 0004 sur une base qui avait déjà des données (voir legacy_seed.sql)
\set ON_ERROR_STOP on
\set QUIET on
create schema t;
create function t.ok(cond boolean, msg text) returns text language plpgsql as $$
begin
  if cond is not true then raise exception 'ÉCHEC : %', msg; end if;
  return 'ok  ' || msg;
end $$;
grant usage on schema t to authenticated;
grant execute on function t.ok(boolean, text) to authenticated;
select t.ok((select count(*) from public.salons) = 1
            and (select config -> 'joueurs' -> 'flavie' ->> 'prenom' from public.salons) = 'Flavie', 'migration : salon principal créé');
select t.ok((select count(*) from public.profiles where salon_id = public.legacy_salon_id()) = 2, 'migration : profils rangés dans le salon principal');
select t.ok((select count(*) from public.progress where salon_id = public.legacy_salon_id()) = 2
            and (select count(*) from public.prepared_content where salon_id = public.legacy_salon_id()) = 1
            and (select count(*) from public.game_state where salon_id = public.legacy_salon_id()) = 1
            and (select count(*) from public.push_subscriptions where salon_id = public.legacy_salon_id()) = 1
            and (select count(*) from public.reminder_log where salon_id = public.legacy_salon_id()) = 1,
            'migration : toutes les données gardées, dans le salon principal');
update public.app_settings set day_override = 5;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select t.ok((select message from public.prepared_content where day = 4) = 'avant', 'migration : Alexandre relit sa case 4');
select t.ok((select count(*) from storage.objects where name = 'flavie/p.jpg') = 1, 'migration : ancienne photo toujours lisible');
reset role;
\echo 'Tous les tests de migration sont passés.'
