-- Tests des rappels (lancé après rls_test.sql, dans la même base : Flavie a déjà écrit les cases 8 et 12).
\set ON_ERROR_STOP on
\set QUIET on
grant usage on schema t to service_role;
grant execute on function t.ok(boolean, text) to service_role;

-- ---------- Abonnements ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000f', false);
select public.save_push_subscription('https://push.example/flavie-tel', 'cle', 'auth', 'iPhone');
select public.save_push_subscription('https://push.example/partage', 'cle', 'auth', 'tablette');
select t.ok((select count(*) from public.push_subscriptions) = 2, 'Flavie enregistre ses appareils');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select t.ok((select count(*) from public.push_subscriptions) = 0, 'Alexandre ne voit pas les appareils de Flavie');
do $$ begin
  insert into public.push_subscriptions (endpoint, who, p256dh, auth) values ('https://push.example/x', 'flavie', 'k', 'a');
  raise exception 'ÉCHEC : insertion directe au nom de Flavie';
exception when insufficient_privilege then null; end $$;
select t.ok(true, 'pas d''insertion directe dans push_subscriptions');
select public.save_push_subscription('https://push.example/alex-tel', 'cle', 'auth', 'Android');
select public.save_push_subscription('https://push.example/partage', 'cle2', 'auth2', 'tablette');
select t.ok((select count(*) from public.push_subscriptions) = 2, 'appareil partagé ré-attribué à Alexandre');
select public.delete_push_subscription('https://push.example/flavie-tel');  -- pas à lui : sans effet
do $$ begin
  perform * from public.reminder_targets(12);
  raise exception 'ÉCHEC : reminder_targets appelable depuis le site';
exception when insufficient_privilege then null; end $$;
select t.ok(true, 'reminder_targets réservée au serveur');
reset role;
select t.ok((select count(*) from public.push_subscriptions where who = 'flavie') = 1, 'delete_push_subscription ne touche pas aux appareils de l''autre');
set role anon;
do $$ begin
  perform public.save_push_subscription('https://push.example/pirate', 'k', 'a', null);
  raise exception 'ÉCHEC : un anonyme s''abonne';
exception when insufficient_privilege then null; end $$;
select t.ok(true, 'anonyme : abonnement refusé');
reset role;

-- ---------- Qui prévenir ? ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.prepared_content (day, from_who, to_who, message) values (16, 'alexandre', 'flavie', '   ');
reset role;
set role service_role;
select t.ok((select array_agg(distinct who order by who) from public.reminder_targets(12)) = array['alexandre'],
            'case 12 : seul Alexandre (Flavie a déjà écrit la sienne)');
select t.ok((select count(*) from public.reminder_targets(12)) = 2, 'case 12 : tous les appareils d''Alexandre');
select t.ok((select array_agg(distinct who order by who) from public.reminder_targets(16)) = array['alexandre', 'flavie'],
            'case 16 : un message vide compte comme une case vide');
select t.ok((select count(*) from public.reminder_targets(5)) = 0, 'jour 5 : pas une case préparée');
insert into public.reminder_log (day, who) values (16, 'alexandre');
select t.ok((select array_agg(distinct who) from public.reminder_targets(16)) = array['flavie'], 'pas de second rappel le même soir');
select t.ok((select count(distinct who) from public.reminder_targets(16, true)) = 2, 'force : on renvoie quand même');
select t.ok((select count(*) from public.reminder_targets()) = 0, 'hors décembre / hors heure : personne');
reset role;

\echo 'Tous les tests des rappels sont passés.'
