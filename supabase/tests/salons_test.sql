-- Tests des salons (0004_salons.sql). Lancé après rls_test.sql et rappels_test.sql, dans la même base :
-- le salon principal (L) contient déjà Alexandre et Flavie, leurs cases 8, 12 et 16, et leurs appareils.
\set ON_ERROR_STOP on
\set QUIET on
grant usage on schema t to service_role;

create function t.cfg(a text, f text) returns jsonb language sql as $$
  select jsonb_build_object('joueurs', jsonb_build_object(
    'alexandre', jsonb_build_object('prenom', a, 'couleurs', '{"coat":1,"hat":2,"pompom":3,"hair":4,"longHair":false}'::jsonb),
    'flavie',    jsonb_build_object('prenom', f, 'couleurs', '{"coat":5,"hat":6,"pompom":7,"hair":8,"longHair":true}'::jsonb)),
    'contenu', '{"1": {"questions": [{"q": "Notre film ?"}]}}'::jsonb)
$$;
grant execute on function t.cfg(text, text) to service_role, authenticated, anon;
-- attend une erreur dont le message commence par `prefix`
create function t.raises(sql text, prefix text, msg text) returns text language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if sqlerrm like prefix || '%' then return t.ok(true, msg); end if;
    raise exception 'ÉCHEC : % (erreur inattendue : %)', msg, sqlerrm;
  end;
  raise exception 'ÉCHEC : % (aucune erreur)', msg;
end $$;
grant execute on function t.raises(text, text, text) to service_role, authenticated, anon;
create table t.ids (k text primary key, v text);
grant all on t.ids to service_role, authenticated, anon;

update public.app_settings set day_override = 12;

-- ---------- Création (serveur seulement) ----------
set role anon;
select t.raises($$select public.salon_create(t.cfg('Léo', 'Inès'), 'ip')$$, 'permission denied', 'anonyme : salon_create interdit');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select t.raises($$select public.salon_create(t.cfg('Léo', 'Inès'), 'ip')$$, 'permission denied', 'connecté : salon_create interdit');
select t.raises($$insert into public.salons (config) values (t.cfg('Léo', 'Inès'))$$, 'permission denied', 'pas de création directe dans salons');
reset role;

set role service_role;
select t.raises($$select public.salon_create(t.cfg('  ', 'Inès'), 'ipA')$$, 'CONFIG_INVALIDE', 'prénom vide refusé');
select t.raises($$select public.salon_create(t.cfg(repeat('x', 31), 'Inès'), 'ipA')$$, 'CONFIG_INVALIDE', 'prénom trop long refusé');
select t.raises($$select public.salon_create(jsonb_set(t.cfg('Léo', 'Inès'), '{joueurs,flavie,couleurs,coat}', '"rouge"'), 'ipA')$$,
                'CONFIG_INVALIDE', 'couleur invalide refusée');
select t.raises($$select public.salon_create(jsonb_set(t.cfg('Léo', 'Inès'), '{contenu,25}', '{}'), 'ipA')$$,
                'CONFIG_INVALIDE', 'jour de contenu 25 refusé');
select t.raises($$select public.salon_create(jsonb_set(t.cfg('Léo', 'Inès'), '{contenu,2}', to_jsonb(repeat('x', 210000))), 'ipA')$$,
                'CONFIG_INVALIDE', 'config de plus de 200 Ko refusée');
insert into t.ids select 'B', salon_id::text from public.salon_create(t.cfg('Léo', 'Inès'), 'ipA');
insert into t.ids select 'tokB', token from public.salon_invitations where salon_id = (select v::uuid from t.ids where k = 'B');
select t.ok((select count(*) from t.ids) = 2, 'salon B créé avec son jeton d''invitation');
select t.ok(char_length((select v from t.ids where k = 'tokB')) = 64, 'jeton de 64 caractères');
reset role;
select t.ok((select count(*) from public.salon_creations where salon_id is not null) = 1, 'création inscrite au journal (aucune trace des refus)');

-- Limites : 5 par appareil et par heure, puis par jour pour tout le site
set role service_role;
select public.salon_create(t.cfg('X', 'Y'), 'ipA') from generate_series(1, 4);
select t.raises($$select public.salon_create(t.cfg('X', 'Y'), 'ipA')$$, 'LIMITE_CREATION', '6e salon dans l''heure depuis le même appareil refusé');
select t.ok((select count(*) from public.salon_create(t.cfg('X', 'Y'), 'ipB')) = 1, 'un autre appareil peut encore créer');
reset role;
update public.app_settings set salon_creations_par_jour = 6;
set role service_role;
select t.raises($$select public.salon_create(t.cfg('X', 'Y'), 'ipC')$$, 'LIMITE_CREATION', 'plafond du jour pour tout le site');
reset role;
update public.app_settings set salon_creations_par_jour = 50;

-- Comptes du salon B (créés par l'Edge Function dans Auth, puis reliés)
insert into auth.users values
  ('00000000-0000-0000-0000-0000000000ba', 'alexandre-b@salons.invalid'),
  ('00000000-0000-0000-0000-0000000000bf', 'ines@example.com'),
  ('00000000-0000-0000-0000-0000000000c0', 'c@salons.invalid');
set role service_role;
select public.salon_join((select v::uuid from t.ids where k = 'B'), '00000000-0000-0000-0000-0000000000ba', 'alexandre');
select t.raises($$select public.salon_join((select v::uuid from t.ids where k = 'B'), '00000000-0000-0000-0000-0000000000c0', 'alexandre')$$,
                'INVITATION_UTILISEE', 'une place ne se prend qu''une fois');
reset role;

-- ---------- Visiteur : écran de connexion et lien d'invitation ----------
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select t.ok((select public.salon_public((select v::uuid from t.ids where k = 'B')) -> 'joueurs' -> 'flavie' ->> 'prenom') = 'Inès',
            'salon_public : prénoms lisibles sans connexion');
select t.ok(not (public.salon_public((select v::uuid from t.ids where k = 'B')) ? 'contenu')
            and not (public.salon_public((select v::uuid from t.ids where k = 'B')) ->> 'inviteArrive')::boolean,
            'salon_public : pas de contenu ; invitée pas encore arrivée');
select t.ok(public.salon_public(gen_random_uuid()) is null, 'salon inconnu → null');
select t.ok(public.salon_invitation_info((select v from t.ids where k = 'tokB')) ->> 'statut' = 'valide', 'jeton valide');
select t.ok(public.salon_invitation_info('n-importe-quoi') ->> 'statut' = 'invalide', 'jeton inconnu → invalide');
select t.ok(public.salon_login_email((select v::uuid from t.ids where k = 'B'), 'alexandre') = 'alexandre-b@salons.invalid',
            'adresse de connexion d''une place');
select t.ok(public.salon_login_email((select v::uuid from t.ids where k = 'B'), 'flavie') is null, 'place libre → pas d''adresse');
select t.raises($$select count(*) from public.salons$$, 'permission denied', 'anonyme : table salons fermée');
select t.raises($$select count(*) from public.salon_invitations$$, 'permission denied', 'anonyme : jetons illisibles');
reset role;

-- ---------- Lien d'invitation (créateur) ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ba', false);
select t.ok(public.salon_invitation() = (select v from t.ids where k = 'tokB'), 'créateur : lien en cours');
select t.raises($$select count(*) from public.salon_invitations$$, 'permission denied', 'connecté : jetons illisibles en direct');
insert into t.ids values ('tokB2', public.salon_invitation(true));
select t.ok((select v from t.ids where k = 'tokB2') <> (select v from t.ids where k = 'tokB'), 'nouveau lien fabriqué');
select t.ok(public.salon_invitation_info((select v from t.ids where k = 'tokB')) ->> 'statut' = 'invalide', 'ancien lien invalidé');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000f', false);
select t.raises($$select public.salon_invitation()$$, 'NON_AUTORISE', 'invitée d''un autre salon : pas de lien');
reset role;

-- ---------- Première connexion de l'invitée (serveur) ----------
set role service_role;
select t.ok(public.salon_claim_invitation((select v from t.ids where k = 'tokB2')) = (select v::uuid from t.ids where k = 'B'),
            'jeton réservé → salon B');
select t.raises($$select public.salon_claim_invitation((select v from t.ids where k = 'tokB2'))$$, 'INVITATION_UTILISEE', 'jeton à usage unique');
select t.raises($$select public.salon_claim_invitation((select v from t.ids where k = 'tokB'))$$, 'INVITATION_INVALIDE', 'jeton remplacé refusé');
select public.salon_release_invitation((select v from t.ids where k = 'tokB2'));   -- la création du compte a échoué
select t.ok(public.salon_claim_invitation((select v from t.ids where k = 'tokB2')) is not null, 'jeton relâché après un échec, réutilisable');
select public.salon_join((select v::uuid from t.ids where k = 'B'), '00000000-0000-0000-0000-0000000000bf', 'flavie');
select t.ok(public.salon_invitation_info((select v from t.ids where k = 'tokB2')) ->> 'statut' = 'utilisee', 'jeton consommé → utilisée');
reset role;
select t.ok((select used_by from public.salon_invitations where token = (select v from t.ids where k = 'tokB2'))
            = '00000000-0000-0000-0000-0000000000bf', 'jeton relié au compte de l''invitée');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ba', false);
select t.raises($$select public.salon_invitation(true)$$, 'INVITATION_UTILISEE', 'plus de lien une fois l''invitée arrivée');
reset role;

-- ---------- Isolation des salons ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000bf', false);
select t.ok(public.my_who() = 'flavie' and public.my_salon() = (select v::uuid from t.ids where k = 'B'), 'Inès : place flavie du salon B');
select t.ok((select count(*) from public.prepared_content) = 0, 'B ne voit aucune case du salon principal');
select t.ok((select count(*) from public.progress) = 0 and (select count(*) from public.game_state) = 0,
            'B ne voit ni progression ni état de jeu du salon principal');
select t.ok((select count(*) from public.profiles) = 2 and (select count(*) from public.salons) = 1, 'B ne voit que ses deux profils et son salon');
select t.ok((select config -> 'contenu' -> '1' -> 'questions' -> 0 ->> 'q' from public.salons) = 'Notre film ?', 'membre : contenu des jeux lisible');
select t.ok((select count(*) from public.push_subscriptions) = 0, 'B ne voit pas les appareils du salon principal');
insert into public.progress (who, day) values ('flavie', 2);                         -- salon_id rempli tout seul
insert into public.game_state (day, key, value) values (2, 'score:flavie', '99');     -- même clé que le salon principal
select t.ok((select value::int from public.game_state where key = 'score:flavie') = 99, 'même clé de jeu, salons séparés');
select t.raises($$insert into public.progress (salon_id, who, day) values (public.legacy_salon_id(), 'flavie', 3)$$,
                'new row violates', 'écrire dans un autre salon refusé');
update public.salons set config = t.cfg('Léo', 'Inès-Marie');
select t.ok((select config -> 'joueurs' -> 'flavie' ->> 'prenom' from public.salons) = 'Inès-Marie', 'membre : config modifiable');
select t.raises($$update public.salons set config = t.cfg('', 'Inès')$$, 'CONFIG_INVALIDE', 'config invalide refusée à la modification');
select t.raises($$update public.salons set day_override = 24$$, 'permission denied', 'day_override non modifiable depuis le site');
update public.salons set config = t.cfg('Pirate', 'Pirate') where id = public.legacy_salon_id();
reset role;
select t.ok((select config -> 'joueurs' -> 'alexandre' ->> 'prenom' from public.salons where id = public.legacy_salon_id()) = 'Alexandre',
            'config d''un autre salon intouchable');
select t.ok((select value::int from public.game_state where key = 'score:flavie' and salon_id = public.legacy_salon_id()) = 1840,
            'état de jeu du salon principal intact');

-- Cases préparées et cases figées : par salon
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ba', false);
insert into public.prepared_content (day, from_who, to_who, message) values (8, 'alexandre', 'flavie', 'pour Inès');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select t.ok((select count(*) from public.prepared_content where message = 'pour Inès') = 0, 'case de B invisible pour le salon principal');
reset role;
-- Dans le salon principal, Alexandre a ouvert la case 8 : ça ne fige pas la case 8 du salon B
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ba', false);
update public.prepared_content set message = 'pour Inès v2' where day = 8;
select t.ok((select message from public.prepared_content where day = 8) = 'pour Inès v2', 'ouverture dans un autre salon : case non figée');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000bf', false);
insert into public.progress (who, day) values ('flavie', 8);
select t.ok((select message from public.prepared_content where day = 8) = 'pour Inès v2', 'Inès lit sa case 8 le jour J');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ba', false);
update public.prepared_content set message = 'trop tard' where day = 8;
select t.raises($$insert into public.prepared_content (day, from_who, to_who, message) values (8, 'alexandre', 'flavie', 'trop tard')
                  on conflict (salon_id, day, from_who) do update set message = excluded.message$$, 'CASE_FIGEE', 'case figée dans son salon');
select t.ok((select message from public.prepared_content where day = 8) = 'pour Inès v2', 'case figée : inchangée');
reset role;

-- ---------- Jour simulé par salon ----------
update public.salons set day_override = 3 where id = (select v::uuid from t.ids where k = 'B');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000bf', false);
select t.ok(public.advent_today() = 3, 'salon B : jour simulé à 3');
select t.raises($$insert into public.progress (who, day) values ('flavie', 5)$$, 'new row violates', 'salon B : case 5 fermée le 3');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select t.ok(public.advent_today() = 12, 'salon principal : toujours le 12');
reset role;
update public.salons set day_override = null where id = (select v::uuid from t.ids where k = 'B');

-- ---------- Photos : dossier du salon et quota ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ba', false);
select set_config('t.b', (select v from t.ids where k = 'B'), false);
insert into storage.objects (bucket_id, name) values ('photos', current_setting('t.b') || '/alexandre/1.jpg');
select t.ok((select count(*) from storage.objects) = 1, 'photo dans <salon>/<place>/ : envoyée et relue');
select t.raises($$insert into storage.objects (bucket_id, name) values ('photos', 'alexandre/vieux-chemin.jpg')$$,
                'new row violates', 'ancien chemin réservé au salon principal');
select t.raises($$insert into storage.objects (bucket_id, name) values ('photos', public.legacy_salon_id()::text || '/alexandre/x.jpg')$$,
                'new row violates', 'dossier d''un autre salon refusé');
select t.raises($$insert into storage.objects (bucket_id, name) values ('photos', current_setting('t.b') || '/flavie/x.jpg')$$,
                'new row violates', 'dossier de l''autre place refusé');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select t.ok((select count(*) from storage.objects where name like current_setting('t.b') || '/%') = 0, 'photos de B invisibles pour le salon principal');
reset role;
update public.app_settings set salon_photo_max = 2;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ba', false);
insert into storage.objects (bucket_id, name) values ('photos', current_setting('t.b') || '/alexandre/2.jpg');
select t.raises($$insert into storage.objects (bucket_id, name) values ('photos', current_setting('t.b') || '/alexandre/3.jpg')$$,
                'new row violates', 'quota de photos du salon atteint');
reset role;
update public.app_settings set salon_photo_max = 150;

-- ---------- Temps réel ----------
insert into realtime.messages (topic, payload) values ('room:' || (select v from t.ids where k = 'B') || ':jour-5', '{}');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000bf', false);
select set_config('realtime.topic', 'room:' || (select v from t.ids where k = 'B') || ':jour-5', false);
select t.ok((select count(*) from realtime.messages) >= 1, 'B : sa salle temps réel est ouverte');
select set_config('realtime.topic', 'room:' || public.legacy_salon_id()::text || ':jour-5', false);
select t.ok((select count(*) from realtime.messages) = 0, 'B : salle du salon principal fermée');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000f', false);
select set_config('realtime.topic', 'room:' || (select v from t.ids where k = 'B') || ':jour-5', false);
select t.ok((select count(*) from realtime.messages) = 0, 'salon principal : salle de B fermée');
reset role;

select t.ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'salons'),
            'réglages du salon diffusés en direct (publication Realtime)');

-- ---------- Rappels par salon, avec les prénoms ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000bf', false);
select public.save_push_subscription('https://push.example/ines', 'cle', 'auth', 'iPhone');
reset role;
select t.ok((select salon_id from public.push_subscriptions where endpoint = 'https://push.example/ines')
            = (select v::uuid from t.ids where k = 'B'), 'abonnement rangé dans le salon B');
set role service_role;
select t.ok((select prenom || '>' || prenom_autre from public.reminder_targets(16)
             where salon_id = (select v::uuid from t.ids where k = 'B')) = 'Inès-Marie>Léo',
            'rappel du salon B avec les prénoms du salon');
select t.ok((select count(*) from public.reminder_targets(16) where salon_id = public.legacy_salon_id()) >= 1
            and (select bool_and(prenom in ('Alexandre', 'Flavie')) from public.reminder_targets(16)
                 where salon_id = public.legacy_salon_id()), 'rappels du salon principal inchangés');
reset role;
insert into public.reminder_log (salon_id, day, who) values ((select v::uuid from t.ids where k = 'B'), 16, 'flavie');
set role service_role;
select t.ok((select count(*) from public.reminder_targets(16) where salon_id = (select v::uuid from t.ids where k = 'B')) = 0,
            'journal des rappels par salon');
select t.ok((select count(*) from public.reminder_targets(16) where salon_id = public.legacy_salon_id()) >= 1,
            'le journal de B n''empêche pas les rappels du salon principal');
reset role;

-- ---------- Ménage des salons vides ----------
set role service_role;
insert into t.ids select 'C', salon_id::text from public.salon_create(t.cfg('Vide', 'Personne'), 'ipD');
select public.salon_join((select v::uuid from t.ids where k = 'C'), '00000000-0000-0000-0000-0000000000c0', 'alexandre');
reset role;
-- le déclencheur salons_guard protège created_at : on le contourne pour vieillir les salons
set session_replication_role = replica;
update public.salons set created_at = now() - interval '30 days'
  where id in ((select v::uuid from t.ids where k = 'C'), (select v::uuid from t.ids where k = 'B'));
set session_replication_role = origin;
select t.ok(public.purge_salons_vides() >= 1, 'purge : salons vides supprimés');
select t.ok(not exists (select 1 from public.salons where id = (select v::uuid from t.ids where k = 'C'))
            and not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-0000000000c0'),
            'purge : salon C et son compte supprimés');
select t.ok(exists (select 1 from public.salons where id = (select v::uuid from t.ids where k = 'B'))
            and exists (select 1 from public.salons where id = public.legacy_salon_id()),
            'purge : salons utilisés conservés');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ba', false);
select t.raises($$select public.purge_salons_vides()$$, 'permission denied', 'purge réservée au serveur');
select t.raises($$select public.supprimer_salon((select v::uuid from t.ids where k = 'B'))$$, 'permission denied', 'suppression réservée au serveur');
reset role;
-- Suppression d'un salon (salon de test d'Alexandre) : salon, données et comptes
select t.ok(public.supprimer_salon((select v::uuid from t.ids where k = 'B')) = 1, 'salon B supprimé');
select t.ok(not exists (select 1 from auth.users where id in ('00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-0000000000bf'))
            and not exists (select 1 from public.progress where salon_id = (select v::uuid from t.ids where k = 'B'))
            and not exists (select 1 from public.push_subscriptions where endpoint = 'https://push.example/ines'),
            'comptes, progression et appareils du salon B supprimés');
select t.ok((select count(*) from public.profiles where salon_id = public.legacy_salon_id()) = 2, 'salon principal intact');

update public.app_settings set day_override = null;
\echo 'Tous les tests des salons sont passés.'
