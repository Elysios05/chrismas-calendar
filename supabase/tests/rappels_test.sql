-- Tests des rappels (lancé après rls_test.sql, dans la même base : Flavie a déjà écrit les cases 8 et 12).
\set ON_ERROR_STOP on
\set QUIET on
grant usage on schema t to service_role;
grant execute on function t.ok(boolean, text) to service_role;

-- ---------- Abonnements ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000f', false);
select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/flavie-tel', 'cle', 'auth', 'iPhone');
select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/partage', 'cle', 'auth', 'tablette');
select t.ok((select count(*) from public.push_subscriptions) = 2, 'Flavie enregistre ses appareils');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select t.ok((select count(*) from public.push_subscriptions) = 0, 'Alexandre ne voit pas les appareils de Flavie');
do $$ begin
  insert into public.push_subscriptions (endpoint, who, p256dh, auth) values ('https://fcm.googleapis.com/fcm/send/x', 'flavie', 'k', 'a');
  raise exception 'ÉCHEC : insertion directe au nom de Flavie';
exception when insufficient_privilege then null; end $$;
select t.ok(true, 'pas d''insertion directe dans push_subscriptions');
select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/alex-tel', 'cle', 'auth', 'Android');
select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/partage', 'cle2', 'auth2', 'tablette');
select t.ok((select count(*) from public.push_subscriptions) = 2, 'appareil partagé ré-attribué à Alexandre');
select public.delete_push_subscription('https://fcm.googleapis.com/fcm/send/flavie-tel');  -- pas à lui : sans effet
do $$ begin
  perform * from public.reminder_targets(12);
  raise exception 'ÉCHEC : reminder_targets appelable depuis le site';
exception when insufficient_privilege then null; end $$;
select t.ok(true, 'reminder_targets réservée au serveur');
reset role;
select t.ok((select count(*) from public.push_subscriptions where who = 'flavie') = 1, 'delete_push_subscription ne touche pas aux appareils de l''autre');
set role anon;
do $$ begin
  perform public.save_push_subscription('https://fcm.googleapis.com/fcm/send/pirate', 'k', 'a', null);
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
insert into public.reminder_log (salon_id, day, who) values (public.legacy_salon_id(), 16, 'alexandre');
select t.ok((select array_agg(distinct who) from public.reminder_targets(16)) = array['flavie'], 'pas de second rappel le même soir');
select t.ok((select count(distinct who) from public.reminder_targets(16, true)) = 2, 'force : on renvoie quand même');
select t.ok((select count(*) from public.reminder_targets()) = 0, 'hors décembre / hors heure : personne');
reset role;

-- ---------- Relance de 22 h 30 (0003_relance.sql) ----------
select t.ok(public.reminder_kind_at('2026-12-15 20:00:00 Europe/Paris') = 'rappel',  '20 h 00 Paris → rappel');
select t.ok(public.reminder_kind_at('2026-12-15 19:00:00+00') = 'rappel',            'hiver : 19 h UTC → rappel');
select t.ok(public.reminder_kind_at('2026-12-15 18:00:00+00') is null,               'hiver : 18 h UTC → rien');
select t.ok(public.reminder_kind_at('2026-12-15 21:30:00+00') = 'relance',           'hiver : 21 h 30 UTC → relance (22 h 30 Paris)');
select t.ok(public.reminder_kind_at('2026-12-15 20:30:00+00') is null,               'hiver : 20 h 30 UTC → rien');
select t.ok(public.reminder_kind_at('2026-07-15 20:30:00+00') = 'relance',           'été : 20 h 30 UTC → relance (22 h 30 Paris)');
select t.ok(public.reminder_kind_at('2026-07-15 18:00:00+00') = 'rappel',            'été : 18 h UTC → rappel');
select t.ok(public.reminder_kind_at('2026-12-15 22:38:00 Europe/Paris') = 'relance', 'cron en retard de 8 min : toujours la relance');
select t.ok(public.reminder_kind_at('2026-12-15 22:45:00 Europe/Paris') is null,     'hors tolérance (15 min) → rien');
update public.app_settings set followup_time = null;
select t.ok(public.reminder_kind_at('2026-12-15 22:30:00 Europe/Paris') is null,     'followup_time = null → pas de relance');
update public.app_settings set followup_time = '22:30';

set role service_role;
-- Le 16 : le rappel d'Alexandre est déjà au journal (plus haut) ; la relance est comptée à part
select t.ok((select array_agg(distinct who order by who) from public.reminder_targets(16, false, 'relance')) = array['alexandre', 'flavie'],
            'relance : journal distinct du premier rappel');
select t.ok((select bool_and(kind = 'relance') from public.reminder_targets(16, false, 'relance')), 'les lignes portent kind = relance');
insert into public.reminder_log (salon_id, day, who, kind) values (public.legacy_salon_id(), 16, 'flavie', 'relance');
select t.ok((select array_agg(distinct who) from public.reminder_targets(16, false, 'relance')) = array['alexandre'], 'pas de seconde relance');
select t.ok((select array_agg(distinct who) from public.reminder_targets(16, false, 'rappel')) = array['flavie'], 'le rappel de Flavie reste dû');
reset role;
-- Alexandre remplit sa case 16 entre 20 h et 22 h 30 : plus de relance pour lui
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update public.prepared_content set message = 'Coucou !' where day = 16 and from_who = 'alexandre';
reset role;
set role service_role;
select t.ok((select count(*) from public.reminder_targets(16, false, 'relance')) = 0, 'case remplie entre-temps → pas de relance');
do $$ begin
  perform * from public.reminder_targets(16, false, 'n_importe');
  raise exception 'ÉCHEC : type inconnu accepté';
exception when raise_exception then
  if sqlerrm like 'ÉCHEC%' then raise; end if;
end $$;
select t.ok(true, 'type d''envoi inconnu refusé');
reset role;

\echo 'Tous les tests des rappels sont passés.'
