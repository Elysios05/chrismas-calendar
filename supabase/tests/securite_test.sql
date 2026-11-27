-- Tests des correctifs de sécurité (0006_securite.sql, audit du 27 nov). Lancé après salons_test.sql, même base.
\set ON_ERROR_STOP on
\set QUIET on
update public.app_settings set salon_max_total = 1000, salon_creations_par_jour = 1000;

-- Salon de test avec ses comptes (adresses techniques <salon>-<place>@salons.invalid) ; invite = l'invitée a rejoint
create function t.salon(nom text, ip text, invite boolean) returns uuid language plpgsql as $$
declare s uuid; a uuid := gen_random_uuid(); f uuid := gen_random_uuid();
begin
  select salon_id into s from public.salon_create(t.cfg(nom, 'Autre'), ip);
  insert into auth.users (id, email, last_sign_in_at) values (a, s || '-alexandre@salons.invalid', now());
  perform public.salon_join(s, a, 'alexandre');
  if invite then
    insert into auth.users (id, email, last_sign_in_at) values (f, 'vraie.' || nom || '@example.com', now());
    perform public.salon_join(s, f, 'flavie');
  end if;
  insert into t.ids values (nom, s::text);
  return s;
end $$;
create function t.id(nom text) returns uuid language sql as $$ select v::uuid from t.ids where k = nom $$;
grant execute on function t.id(text) to authenticated, anon, service_role;
-- se connecter comme la personne <place> du salon <nom>
create function t.login(nom text, place text) returns text language sql security definer as $$
  select set_config('request.jwt.claim.sub', (select p.user_id::text from public.profiles p
                                              where p.salon_id = t.id(nom) and p.who = place), false)
$$;
grant execute on function t.login(text, text) to authenticated;
-- vieillit un salon (created_at protégé par salons_guard) et l'activité de ses membres
create function t.vieillir(nom text, age interval) returns void language plpgsql as $$
begin
  set local session_replication_role = replica;
  update public.salons set created_at = created_at - age, updated_at = updated_at - age where id = t.id(nom);
  set local session_replication_role = origin;
  update auth.users u set last_sign_in_at = u.last_sign_in_at - age
    from public.profiles p where p.user_id = u.id and p.salon_id = t.id(nom);
  update public.salon_creations set created_at = created_at - age where salon_id = t.id(nom);
end $$;

-- =====================================================================
-- SEC-01 — Limites de création
-- =====================================================================
set role service_role;
select t.ok((select count(*) from public.salon_create(t.cfg('Un', 'Deux'), 'ipS1')) = 1, '1re création depuis une IP');
select t.raises($$select public.salon_create(t.cfg('Un', 'Deux'), 'ipS1')$$, 'LIMITE_CREATION : un calendrier vient',
                '2e création dans l''heure refusée');
reset role;
update public.salon_creations set created_at = now() - interval '2 hours' where ip_hash = 'ipS1';
set role service_role;
select t.ok((select count(*) from public.salon_create(t.cfg('Un', 'Deux'), 'ipS1')) = 1, '2e création une heure plus tard');
reset role;
update public.salon_creations set created_at = now() - interval '3 hours' where ip_hash = 'ipS1';
set role service_role;
select t.raises($$select public.salon_create(t.cfg('Un', 'Deux'), 'ipS1')$$, 'LIMITE_CREATION : trop de calendriers créés depuis cet appareil aujourd',
                '3e création du jour refusée');
reset role;

-- Une création ratée (salon supprimé par l'Edge Function) ne compte pas
set role service_role;
create temp table rate as select salon_id from public.salon_create(t.cfg('Raté', 'X'), 'ipS2');
delete from public.salons where id = (select salon_id from rate);
select t.ok((select count(*) from public.salon_create(t.cfg('Réessai', 'X'), 'ipS2')) = 1, 'échec non compté : on peut recréer aussitôt');
reset role;
-- … mais les essais à répétition sont bornés (salon_essais_par_heure)
update public.app_settings set salon_essais_par_heure = 3;
set role service_role;
delete from public.salons where id in (select c.salon_id from public.salon_creations c where c.ip_hash = 'ipS2');
create temp table rate2 as select salon_id from public.salon_create(t.cfg('Raté', 'X'), 'ipS2');
delete from public.salons where id = (select salon_id from rate2);
select t.raises($$select public.salon_create(t.cfg('Raté', 'X'), 'ipS2')$$, 'LIMITE_CREATION : trop d''essais',
                'boucle d''échecs bornée');
reset role;
update public.app_settings set salon_essais_par_heure = 10;

-- Plafond global (0005)
update public.app_settings set salon_max_total = (select count(*) from public.salons);
set role service_role;
select t.raises($$select public.salon_create(t.cfg('Un', 'Deux'), 'ipS3')$$, 'LIMITE_CREATION : complet', 'plafond global : « Complet »');
reset role;
update public.app_settings set salon_max_total = 1000;

-- =====================================================================
-- SEC-01 — Purge des salons inactifs (prudente)
-- =====================================================================
select t.salon('vide', 'ipP1', false);         -- jamais rejoint, rien fait
select t.salon('rejoint', 'ipP2', true);       -- rejoint, rien fait
select t.salon('recent', 'ipP3', false);       -- créé il y a 1 h
select t.salon('session', 'ipP4', false);      -- vieux, mais site ouvert récemment (session rafraîchie)
select t.salon('config', 'ipP5', true);        -- réglages modifiés après la création
select t.salon('prepare', 'ipP6', true);       -- une case préparée
select t.salon('joue', 'ipP7', true);          -- une donnée de jeu
select t.salon('photo', 'ipP8', false);        -- une photo
select t.salon('rappels', 'ipP9', false);      -- un appareil abonné
select t.salon('ouvert', 'ipPA', true);        -- une case ouverte
select t.vieillir(n, interval '3 days') from unnest(array['vide', 'rejoint', 'session', 'config', 'prepare', 'joue',
  'photo', 'rappels', 'ouvert']) n;
select t.vieillir('recent', interval '1 hour');
insert into auth.sessions (user_id, updated_at, refreshed_at)
  select p.user_id, now() - interval '3 days', (now() - interval '2 hours') at time zone 'UTC'
  from public.profiles p where p.salon_id = t.id('session');
update public.salons set config = config where id = t.id('config');
insert into public.prepared_content (salon_id, day, from_who, to_who, message) values (t.id('prepare'), 4, 'alexandre', 'flavie', 'coucou');
insert into public.game_state (salon_id, day, key, value) values (t.id('joue'), 2, 'score:flavie', '3');
insert into storage.objects (bucket_id, name, metadata) values ('photos', t.id('photo') || '/alexandre/1.jpg', '{"size": 1000}');
insert into public.push_subscriptions (endpoint, who, salon_id, p256dh, auth)
  values ('https://fcm.googleapis.com/fcm/send/purge', 'alexandre', t.id('rappels'), 'k', 'a');
insert into public.progress (salon_id, who, day) values (t.id('ouvert'), 'flavie', 1);

select t.ok(exists (select 1 from public.salons_inactifs() i where i.salon_id = t.id('vide')),
            'aperçu : le salon vide et jamais rejoint est inactif');
select t.ok(not exists (select 1 from public.salons_inactifs(null, now()) i
                        where i.salon_id in (t.id('recent'), t.id('session'), t.id('config'), t.id('prepare'),
                                             t.id('joue'), t.id('photo'), t.id('rappels'), t.id('ouvert'))),
            'salons récents, revisités, personnalisés, préparés, joués, avec photo, rappels ou case ouverte : gardés');
-- Un salon rejoint mais vide n'est jamais purgé avant l'ouverture de la case 1 + 48 h
select t.ok(not exists (select 1 from public.salons_inactifs(null, '2026-11-29 12:00 Europe/Paris') i
                        where i.salon_id = t.id('rejoint')), 'rejoint et vide, avant décembre : gardé');
select t.ok(not exists (select 1 from public.salons_inactifs(null, '2026-12-02 12:00 Europe/Paris') i
                        where i.salon_id = t.id('rejoint')), 'rejoint et vide, 2 déc. (moins de 48 h après la case 1) : gardé');
-- La purge réelle (date du jour)
select t.ok(public.purge_salons_inactifs() >= 1, 'purge : au moins un salon supprimé');
select t.ok(not exists (select 1 from public.salons where id = t.id('vide'))
            and not exists (select 1 from auth.users where email = t.id('vide') || '-alexandre@salons.invalid'),
            'purge : salon vide et son compte supprimés');
select t.ok((select count(*) from public.salons where id in (t.id('recent'), t.id('session'), t.id('config'), t.id('prepare'),
              t.id('joue'), t.id('photo'), t.id('rappels'), t.id('ouvert'))) = 8
            and exists (select 1 from public.salons where id = public.legacy_salon_id()),
            'purge : salons utilisés et salon principal conservés');
select t.ok(exists (select 1 from public.salons where id = t.id('rejoint'))
            = (now() <= make_timestamptz(extract(year from now() at time zone 'Europe/Paris')::int, 12, 1, 7, 0, 0, 'Europe/Paris') + interval '48 hours'),
            'purge : salon rejoint gardé tant que la case 1 n''a pas 48 h');
-- Ménage quotidien : journal des créations gardé 30 jours
insert into public.salon_creations (ip_hash, salon_id, created_at) values ('vieux', null, now() - interval '40 days');
select t.ok((public.menage_quotidien() ->> 'journal_efface')::int >= 1, 'ménage quotidien lancé');
select t.ok(not exists (select 1 from public.salon_creations where ip_hash = 'vieux'), 'journal des créations purgé après 30 jours');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select t.raises($$select public.purge_salons_inactifs()$$, 'permission denied', 'purge réservée au serveur');
select t.raises($$select * from public.salons_inactifs()$$, 'permission denied', 'aperçu réservé au serveur');
select t.raises($$select public.menage_quotidien()$$, 'permission denied', 'ménage réservé au serveur');
reset role;

-- =====================================================================
-- SEC-05 — Adresse e-mail
-- =====================================================================
set role anon;
select t.ok(public.salon_connexion_info(t.id('config'), 'alexandre') = jsonb_build_object('existe', true,
              'email', t.id('config') || '-alexandre@salons.invalid'), 'adresse technique donnée (rien de personnel)');
select t.ok(public.salon_connexion_info(t.id('config'), 'flavie') = '{"existe": true, "email": null}',
            'adresse réelle jamais donnée à un visiteur');
select t.ok(public.salon_connexion_info(t.id('recent'), 'flavie') = '{"existe": false, "email": null}', 'place libre');
select t.ok(public.salon_login_email(t.id('config'), 'flavie') is null, 'ancienne fonction : adresse réelle masquée');
select t.raises($$select public.salon_login_email_serveur(t.id('config'), 'flavie')$$, 'permission denied',
                'adresse complète réservée au serveur');
reset role;
set role service_role;
select t.ok(public.salon_login_email_serveur(t.id('config'), 'flavie') = 'vraie.config@example.com', 'serveur : adresse réelle');
select public.salon_essai_rate('ipE', 'connexion') from generate_series(1, 10);
select t.raises($$select public.salon_essai_ok('ipE', 'connexion')$$, 'LIMITE_CREATION', '10 échecs de connexion : IP bloquée une heure');
select public.salon_essai_ok('ipE', 'oubli'), public.salon_essai_ok('ipF', 'connexion');
select t.ok(true, 'autre action ou autre IP : pas bloquées');
reset role;

-- =====================================================================
-- SEC-16 — Lien d'invitation : 30 jours
-- =====================================================================
insert into t.ids select 'tokR', token from public.salon_invitations where salon_id = t.id('recent');
update public.salon_invitations set created_at = now() - interval '31 days' where salon_id = t.id('recent');
select t.ok(public.salon_invitation_info((select v from t.ids where k = 'tokR')) ->> 'statut' = 'invalide', 'invitation expirée → invalide');
set role service_role;
select t.raises($$select public.salon_claim_invitation((select v from t.ids where k = 'tokR'))$$, 'INVITATION_INVALIDE',
                'invitation expirée : inutilisable');
reset role;
set role authenticated;
select t.login('recent', 'alexandre');
select t.ok(public.salon_invitation() <> (select v from t.ids where k = 'tokR'), 'le créateur reçoit un nouveau lien');
reset role;

-- =====================================================================
-- SEC-02 — Données de jeu
-- =====================================================================
update public.app_settings set salon_game_rows_max = 3, salon_game_octets_max = 1100000;
set role authenticated;
select t.login('joue', 'flavie');
select t.raises($$insert into public.game_state (day, key, value) values (2, 'gros', to_jsonb(repeat('x', 530000)))$$,
                'QUOTA_JEUX', 'valeur de plus de 512 Ko refusée');
insert into public.game_state (day, key, value) values (2, 'a', to_jsonb(repeat('x', 500000)));
insert into public.game_state (day, key, value) values (2, 'b', '1');
select t.raises($$insert into public.game_state (day, key, value) values (2, 'c', '1')$$, 'QUOTA_JEUX', '4e ligne refusée (quota de lignes)');
insert into public.game_state (day, key, value) values (2, 'b', '2') on conflict (salon_id, day, key) do update set value = excluded.value;
select t.ok((select value from public.game_state where key = 'b') = '2', 'quota atteint : mise à jour d''une clé existante permise');
reset role;
update public.app_settings set salon_game_rows_max = 1000, salon_game_octets_max = 1000;
set role authenticated;
select t.login('joue', 'flavie');
select t.raises($$update public.game_state set value = to_jsonb(repeat('z', 4000)) where key = 'b'$$, 'QUOTA_JEUX', 'volume du salon dépassé');
reset role;
update public.app_settings set salon_game_rows_max = 1000, salon_game_octets_max = 5242880;
-- même sans le déclencheur (accès direct au serveur), la contrainte de la table refuse
set session_replication_role = replica;
select t.raises(format($$insert into public.game_state (salon_id, day, key, value) values (%L, 3, 'triche', to_jsonb(repeat('x', 600000)))$$,
                       t.id('joue')), 'new row for relation', 'contrainte de taille posée sur la table');
set session_replication_role = origin;

-- =====================================================================
-- SEC-03 — Photos en octets
-- =====================================================================
select t.ok((select file_size_limit from storage.buckets where id = 'photos') = 5242880, 'bucket photos : 5 Mo par fichier');
update public.app_settings set salon_photo_octets_max = 3000;
set role authenticated;
select t.login('photo', 'alexandre');
insert into storage.objects (bucket_id, name, metadata) values ('photos', t.id('photo') || '/alexandre/2.jpg', '{"size": 2500}');
select t.raises($$insert into storage.objects (bucket_id, name, metadata) values ('photos', t.id('photo') || '/alexandre/3.jpg', '{"size": 10}')$$,
                'new row violates', 'volume de photos du salon atteint');
reset role;
update public.app_settings set salon_photo_octets_max = 41943040,
  photos_octets_total_max = (select sum((metadata ->> 'size')::bigint) from storage.objects where bucket_id = 'photos');
set role authenticated;
select t.login('rappels', 'alexandre');
select t.raises($$insert into storage.objects (bucket_id, name, metadata) values ('photos', t.id('rappels') || '/alexandre/1.jpg', '{"size": 10}')$$,
                'new row violates', 'stockage du site plein : envoi refusé pour tous');
reset role;
update public.app_settings set photos_octets_total_max = 943718400;

-- =====================================================================
-- SEC-10 — Photos d'une case : seulement celles de l'auteur, dans son salon
-- =====================================================================
set role authenticated;
select t.login('prepare', 'alexandre');
select t.raises(format($$insert into public.prepared_content (day, from_who, to_who, message, photos)
                         values (8, 'alexandre', 'flavie', 'x', array['%s/alexandre/1.jpg'])$$, t.id('photo')),
                'new row for relation', 'photo d''un autre salon refusée');
select t.raises(format($$insert into public.prepared_content (day, from_who, to_who, message, photos)
                         values (8, 'alexandre', 'flavie', 'x', array['%s/flavie/1.jpg'])$$, t.id('prepare')),
                'new row for relation', 'photo du partenaire refusée');
select t.raises($$insert into public.prepared_content (day, from_who, to_who, message, photos)
                  values (8, 'alexandre', 'flavie', 'x', array['https://pistage.example/x.png'])$$,
                'new row for relation', 'URL externe refusée');
insert into public.prepared_content (day, from_who, to_who, message, photos)
  values (8, 'alexandre', 'flavie', 'x', array[t.id('prepare') || '/alexandre/ok.jpg']);
select t.ok(true, 'photo de son propre dossier acceptée');
reset role;

-- =====================================================================
-- SEC-04 — Abonnements push
-- =====================================================================
set role authenticated;
select t.login('ouvert', 'flavie');
select t.raises($$select public.save_push_subscription('https://attaquant.example/x', 'k', 'a')$$, 'ABONNEMENT_INVALIDE',
                'service de notification inconnu refusé');
select t.raises($$select public.save_push_subscription('https://fcm.googleapis.com.attaquant.example/x', 'k', 'a')$$, 'ABONNEMENT_INVALIDE',
                'faux domaine refusé');
select t.raises($$select public.save_push_subscription('http://fcm.googleapis.com/x', 'k', 'a')$$, 'ABONNEMENT_INVALIDE', 'http refusé');
select public.save_push_subscription('https://web.push.apple.com/1', 'k', 'a');
select public.save_push_subscription('https://web.push.apple.com/2', 'k', 'a');
select public.save_push_subscription('https://web.push.apple.com/3', 'k', 'a');
select public.save_push_subscription('https://web.push.apple.com/4', 'k', 'a');
select public.save_push_subscription('https://web.push.apple.com/5', 'k', 'a');
select public.save_push_subscription('https://web.push.apple.com/6', 'k', 'a');
select public.save_push_subscription('https://web.push.apple.com/7', 'k', 'a');
select t.ok((select count(*) from public.push_subscriptions) = 5, '7 appareils enregistrés → 5 gardés');
select t.ok(not exists (select 1 from public.push_subscriptions where endpoint in ('https://web.push.apple.com/1', 'https://web.push.apple.com/2')),
            'les plus anciens sont remplacés');
select public.save_push_subscription('https://web.push.apple.com/7', 'k2', 'a2');
select t.ok((select count(*) from public.push_subscriptions) = 5, 'ré-enregistrer un appareil ne retire rien');
reset role;
select t.ok((select count(*) from public.push_subscriptions where salon_id = t.id('rappels')) = 1
            and (select count(*) from public.push_subscriptions where salon_id = public.legacy_salon_id()) >= 1,
            'les appareils des autres ne sont pas touchés');

-- =====================================================================
-- SEC-11 — Droits
-- =====================================================================
set role anon;
select t.raises($$select public.my_salon()$$, 'permission denied', 'anonyme : my_salon() fermée');
select t.raises($$select public.prepared_frozen_in(public.legacy_salon_id(), 8, 'alexandre')$$, 'permission denied',
                'anonyme : oracle « case ouverte ? » fermé');
select t.ok(public.advent_today() is not null, 'anonyme : advent_today() toujours ouverte');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select t.raises($$truncate public.game_state$$, 'permission denied', 'connecté : TRUNCATE interdit');
select t.raises($$select * from public.reminder_log$$, 'permission denied', 'connecté : journal des rappels fermé');
select t.raises($$select public.touch_row()$$, 'permission denied', 'connecté : fonction de déclencheur fermée');
select t.ok(public.my_who() = 'alexandre' and (select count(*) from public.progress) >= 0, 'connecté : règles d''accès inchangées');
reset role;

update public.app_settings set salon_max_total = 50, salon_creations_par_jour = 50;
\echo 'Tous les tests de sécurité sont passés.'
