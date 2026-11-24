-- Tests des règles d'accès (à lancer via supabase/tests/run_sql_tests.sh, sur un Postgres local jetable).
\set ON_ERROR_STOP on
\set QUIET on

-- Deux comptes + profils + un intrus sans profil
insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'alexandre@example.com'),
  ('00000000-0000-0000-0000-00000000000f', 'flavie@example.com'),
  ('00000000-0000-0000-0000-0000000000ee', 'intrus@example.com');
insert into public.profiles values
  ('00000000-0000-0000-0000-00000000000a', 'alexandre'),
  ('00000000-0000-0000-0000-00000000000f', 'flavie');

create schema t;
create function t.ok(cond boolean, msg text) returns text language plpgsql as $$
begin
  if cond is not true then raise exception 'ÉCHEC : %', msg; end if;
  return 'ok  ' || msg;
end $$;
grant usage on schema t to authenticated, anon;
grant execute on function t.ok(boolean, text) to authenticated, anon;

-- ---------- Calcul du jour (ouverture à 7 h, heure de Paris) ----------
select t.ok(public.advent_day_at('2026-12-10 06:59:00 Europe/Paris') = 9,  '10 déc. 6 h 59 → encore le 9');
select t.ok(public.advent_day_at('2026-12-10 07:00:00 Europe/Paris') = 10, '10 déc. 7 h 00 → le 10');
select t.ok(public.advent_day_at('2026-12-01 06:30:00 Europe/Paris') = 0,  '1er déc. 6 h 30 → rien d''ouvert');
select t.ok(public.advent_day_at('2026-12-01 07:00:00 Europe/Paris') = 1,  '1er déc. 7 h → case 1');
select t.ok(public.advent_day_at('2026-12-24 06:00:00 Europe/Paris') = 23, '24 déc. 6 h → encore le 23');
select t.ok(public.advent_day_at('2026-12-31 12:00:00 Europe/Paris') = 24, 'après Noël → 24');
select t.ok(public.advent_day_at('2027-01-01 03:00:00 Europe/Paris') = 24, '1er janv. 3 h → 24');
select t.ok(public.advent_day_at('2026-11-30 22:00:00 Europe/Paris') = 0,  'novembre → 0');
select t.ok(public.advent_day_at('2026-12-10 06:30:00+00') = 10, '6 h 30 UTC = 7 h 30 Paris → le 10');

-- On simule le 10 décembre
update public.app_settings set day_override = 10;

-- ---------- Flavie prépare les cases 8 et 12 pour Alexandre ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000f', false);
select t.ok(public.my_who() = 'flavie', 'my_who() = flavie');
select t.ok(public.advent_today() = 10, 'advent_today() suit day_override');
insert into public.prepared_content (day, from_who, to_who, message, photos)
  values (8, 'flavie', 'alexandre', 'case 8', array['flavie/a.jpg']),
         (12, 'flavie', 'alexandre', 'case 12 secrète', array['flavie/b.jpg']);
insert into storage.objects (bucket_id, name) values ('photos', 'flavie/a.jpg'), ('photos', 'flavie/b.jpg');
select t.ok((select count(*) from public.prepared_content where from_who = 'flavie') = 2, 'l''autrice relit ses cases (même futures)');
update public.prepared_content set message = 'case 12 modifiée' where day = 12 and from_who = 'flavie';
select t.ok((select message from public.prepared_content where day = 12) = 'case 12 modifiée', 'l''autrice modifie sa case future');
do $$ begin
  insert into public.prepared_content (day, from_who, to_who, message) values (16, 'alexandre', 'flavie', 'usurpation');
  raise exception 'ÉCHEC : Flavie a écrit au nom d''Alexandre';
exception when insufficient_privilege then null; end $$;
select t.ok(true, 'impossible d''écrire au nom de l''autre');
do $$ begin
  insert into storage.objects (bucket_id, name) values ('photos', 'alexandre/pirate.jpg');
  raise exception 'ÉCHEC : upload dans le dossier de l''autre';
exception when insufficient_privilege then null; end $$;
select t.ok(true, 'upload refusé hors de son dossier');
do $$ begin
  insert into public.progress (who, day) values ('flavie', 11);
  raise exception 'ÉCHEC : case 11 ouverte le 10';
exception when insufficient_privilege then null; end $$;
select t.ok(true, 'impossible d''ouvrir une case future');
insert into public.progress (who, day) values ('flavie', 10);
do $$ begin
  insert into public.progress (who, day) values ('alexandre', 3);
  raise exception 'ÉCHEC : progression écrite pour l''autre';
exception when insufficient_privilege then null; end $$;
select t.ok(true, 'impossible d''écrire la progression de l''autre');
insert into public.game_state (day, key, value) values (2, 'score:flavie', '1840');
select t.ok((select updated_by from public.game_state where key = 'score:flavie') = 'flavie', 'game_state.updated_by forcé par le serveur');
reset role;

-- ---------- Alexandre, destinataire ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select t.ok((select count(*) from public.prepared_content where to_who = 'alexandre' and day = 8) = 1, 'case 8 lisible le 10');
select t.ok((select count(*) from public.prepared_content where to_who = 'alexandre' and day = 12) = 0, 'case 12 ILLISIBLE avant le jour J');
select t.ok((select count(*) from storage.objects where name = 'flavie/a.jpg') = 1, 'photo de la case 8 lisible');
select t.ok((select count(*) from storage.objects where name = 'flavie/b.jpg') = 0, 'photo de la case 12 illisible');
update public.prepared_content set message = 'piraté' where day = 8 and from_who = 'flavie';
reset role;
select t.ok((select message from public.prepared_content where day = 8) = 'case 8', 'le destinataire ne peut pas modifier');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select t.ok((select count(*) from public.progress where who = 'flavie') = 1, 'Alexandre voit la progression de Flavie');
select t.ok((select value::int from public.game_state where key = 'score:flavie') = 1840, 'état de jeu partagé');
insert into public.progress (who, day) values ('alexandre', 8);   -- Alexandre ouvre la case 8
reset role;

-- ---------- Case figée une fois ouverte par le destinataire ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000f', false);
do $$ begin
  insert into public.prepared_content (day, from_who, to_who, message) values (8, 'flavie', 'alexandre', 'trop tard')
    on conflict (day, from_who) do update set message = excluded.message;
  raise exception 'ÉCHEC : case 8 modifiée après ouverture';
exception when raise_exception then
  if sqlerrm not like 'CASE_FIGEE%' then raise; end if;
end $$;
select t.ok(true, 'upsert d''une case ouverte → erreur CASE_FIGEE');
do $$ begin
  delete from public.prepared_content where day = 8 and from_who = 'flavie';
end $$;
reset role;
select t.ok((select message from public.prepared_content where day = 8) = 'case 8', 'case ouverte ni modifiée ni supprimée');
-- Les photos d'une case ouverte sont elles aussi figées ; les autres restent supprimables
insert into storage.objects (bucket_id, name) values ('photos', 'flavie/tmp.jpg');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000f', false);
delete from storage.objects where name in ('flavie/a.jpg', 'flavie/tmp.jpg');
update storage.objects set name = name where name = 'flavie/a.jpg';
reset role;
select t.ok((select count(*) from storage.objects where name = 'flavie/a.jpg') = 1, 'photo d''une case ouverte : suppression refusée');
select t.ok((select count(*) from storage.objects where name = 'flavie/tmp.jpg') = 0, 'photo non utilisée : suppression permise');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000f', false);
insert into public.prepared_content (day, from_who, to_who, message) values (12, 'flavie', 'alexandre', 'case 12 v3')
  on conflict (day, from_who) do update set message = excluded.message;
select t.ok((select message from public.prepared_content where day = 12) = 'case 12 v3', 'case non ouverte toujours modifiable');
reset role;

-- Le 12 arrive
update public.app_settings set day_override = 12;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select t.ok((select count(*) from public.prepared_content where to_who = 'alexandre' and day = 12) = 1, 'case 12 lisible le jour J');
select t.ok((select count(*) from storage.objects where name = 'flavie/b.jpg') = 1, 'photo de la case 12 lisible le jour J');
reset role;

-- ---------- Intrus (compte sans profil) et visiteur anonyme ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ee', false);
select t.ok((select count(*) from public.prepared_content) = 0, 'intrus : aucune case');
select t.ok((select count(*) from public.progress) = 0, 'intrus : aucune progression');
select t.ok((select count(*) from public.game_state) = 0, 'intrus : aucun état de jeu');
select t.ok((select count(*) from storage.objects) = 0, 'intrus : aucune photo');
select set_config('realtime.topic', 'room:jour-5', false);
reset role;
insert into realtime.messages (topic, payload) values ('room:jour-5', '{}');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ee', false);
select t.ok((select count(*) from realtime.messages) = 0, 'intrus : salle temps réel fermée');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000f', false);
select t.ok((select count(*) from realtime.messages) = 1, 'Flavie : salle temps réel ouverte');
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  perform count(*) from public.prepared_content;
  raise exception 'ÉCHEC : un visiteur anonyme lit prepared_content';
exception when insufficient_privilege then null; end $$;
select t.ok(true, 'anonyme : tables fermées');
reset role;

-- ---------- advent_today sans override ----------
update public.app_settings set day_override = null;
select t.ok(public.advent_today() between 0 and 24, 'advent_today() sans override = ' || public.advent_today());

\echo 'Tous les tests SQL sont passés.'
