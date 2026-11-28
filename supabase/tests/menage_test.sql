-- Tests du ménage de fin de saison (0007_menage_31_janvier.sql). Lancé en DERNIER, après securite_test.sql,
-- même base : le ménage simulé au 31 janvier efface tous les salons de test non protégés.
\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = error;   -- pas de pg_net en local : l'avertissement « photos non supprimées » est attendu
update public.app_settings set salon_max_total = 1000, salon_creations_par_jour = 1000;

select t.salon('fsSansPhoto', 'ipF1', true);
select t.salon('fsPhoto', 'ipF2', true);
select t.salon('fsGarde', 'ipF3', true);
select t.salon('fsGardeInactif', 'ipF4', false);
select t.salon('fsSuivant', 'ipF5', false);
update public.salons set garder = true where id in (t.id('fsGarde'), t.id('fsGardeInactif'));
insert into storage.objects (bucket_id, name, metadata)
values ('photos', t.id('fsPhoto') || '/alexandre/souvenir.jpg', '{"size": 1000}');
-- salon créé pour la saison suivante (après le 31 janvier 2027)
set session_replication_role = replica;
update public.salons set created_at = '2027-02-15 10:00 Europe/Paris', updated_at = '2027-02-15 10:00 Europe/Paris'
where id = t.id('fsSuivant');
set session_replication_role = origin;

-- =====================================================================
-- Colonne « garder »
-- =====================================================================
select t.ok((select not garder from public.salons where id = t.id('fsSansPhoto')), 'garder : faux par défaut');
select t.login('fsSansPhoto', 'alexandre');
set role authenticated;
select t.raises($$update public.salons set garder = true$$, 'permission denied', 'un membre ne peut pas marquer son salon « garder »');
reset role;

-- purge des inactifs : un salon « garder » n'est jamais proposé
select t.vieillir('fsGardeInactif', interval '10 days');
set role service_role;
select t.ok(not exists (select 1 from public.salons_inactifs() i where i.salon_id = t.id('fsGardeInactif')),
            'purge des inactifs : salon « garder » épargné');
reset role;
set session_replication_role = replica;   -- sans salons_guard (qui rafraîchit updated_at)
update public.salons set garder = false where id = t.id('fsGardeInactif');
set session_replication_role = origin;
set role service_role;
select t.ok(exists (select 1 from public.salons_inactifs() i where i.salon_id = t.id('fsGardeInactif')),
            'purge des inactifs : le même salon sans « garder » serait purgé');
reset role;
update public.salons set garder = true where id = t.id('fsGardeInactif');

-- =====================================================================
-- Date du ménage (calculée, jamais en dur)
-- =====================================================================
set role service_role;
select t.ok(public.date_fin_saison('2026-12-01 12:00 Europe/Paris') = '2027-01-31 00:00 Europe/Paris', 'date : 1er déc. 2026 → 31 janv. 2027');
select t.ok(public.date_fin_saison('2027-01-20 12:00 Europe/Paris') = '2027-01-31 00:00 Europe/Paris', 'date : en janvier → même saison');
select t.ok(public.date_fin_saison('2026-11-15 12:00 Europe/Paris') = '2026-01-31 00:00 Europe/Paris', 'date : en novembre → saison précédente');
select t.ok(public.date_fin_saison('2027-12-05 12:00 Europe/Paris') = '2028-01-31 00:00 Europe/Paris', 'date : saison suivante → 31 janv. 2028');

-- =====================================================================
-- Avant le 31 janvier : rien
-- =====================================================================
select t.ok(public.menage_fin_saison() = 0, 'aujourd''hui (novembre 2026) : rien n''est effacé');
select t.ok(public.menage_fin_saison('2026-12-24 20:00 Europe/Paris') = 0, 'à Noël : rien n''est effacé');
select t.ok(public.menage_fin_saison('2027-01-30 23:59 Europe/Paris') = 0, '30 janvier 23 h 59 : rien n''est effacé');
select t.ok(not exists (select 1 from public.salons_fin_saison('2027-01-30 23:59 Europe/Paris')), 'aperçu vide avant la date');
select t.ok((select (public.menage_quotidien() ->> 'fin_saison')::int) = 0, 'menage_quotidien : fin_saison = 0 en novembre');
reset role;
select t.ok((select count(*) from public.salons where id in (t.id('fsSansPhoto'), t.id('fsPhoto'))) = 2, 'salons intacts avant la date');

-- =====================================================================
-- 31 janvier, 4 h 17 (heure de Paris) : ménage
-- =====================================================================
create temp table comptes as select p.salon_id, p.user_id from public.profiles p
  where p.salon_id in (t.id('fsSansPhoto'), t.id('fsPhoto'));
set role service_role;
select t.ok((select count(*) from public.salons_fin_saison('2027-01-31 04:17 Europe/Paris')
             where salon_id in (t.id('fsGarde'), t.id('fsGardeInactif'), t.id('fsSuivant'), public.legacy_salon_id())) = 0,
            'aperçu : ni « garder », ni salon principal, ni saison suivante');
select t.ok(public.menage_fin_saison('2027-01-31 04:17 Europe/Paris') >= 1, '31 janvier : des salons sont effacés');
reset role;
select t.ok(not exists (select 1 from public.salons where id = t.id('fsSansPhoto')), 'salon sans photo : supprimé');
select t.ok((select count(*) from comptes where salon_id = t.id('fsSansPhoto')) = 2
            and not exists (select 1 from auth.users u join comptes c on c.user_id = u.id where c.salon_id = t.id('fsSansPhoto')),
            'comptes du salon sans photo : supprimés');
select t.ok(not exists (select 1 from public.progress where salon_id = t.id('fsSansPhoto'))
            and not exists (select 1 from public.profiles where salon_id = t.id('fsSansPhoto')), 'données du salon : parties avec lui');
select t.ok(exists (select 1 from public.salons where id = t.id('fsPhoto'))
            and (select count(*) from public.profiles where salon_id = t.id('fsPhoto')) = 2,
            'salon avec photos : gardé tant que ses photos ne sont pas effacées (Edge Function)');
select t.ok(exists (select 1 from public.salons where id = t.id('fsGarde'))
            and (select count(*) from public.profiles where salon_id = t.id('fsGarde')) = 2, 'salon « garder » : intact, comptes compris');
select t.ok(exists (select 1 from public.salons where id = t.id('fsGardeInactif')), 'salon « garder » inactif : intact');
select t.ok(exists (select 1 from public.salons where id = public.legacy_salon_id()), 'salon principal : intact');
select t.ok(exists (select 1 from public.salons where id = t.id('fsSuivant')), 'salon de la saison suivante : intact');
select t.ok(not exists (select 1 from public.salons s
                        where s.id <> public.legacy_salon_id() and not s.garder and s.id <> t.id('fsSuivant')
                          and not exists (select 1 from storage.objects o where o.name like s.id::text || '/%')),
            'il ne reste que les salons protégés et ceux qui ont encore des photos');

-- l'Edge Function a vidé le dossier (simulé) : la nuit suivante, la base termine
delete from storage.objects o where o.bucket_id = 'photos' and exists (
  select 1 from public.salons_fin_saison('2027-02-01 04:17 Europe/Paris') f where o.name like f.salon_id::text || '/%');
set role service_role;
select t.ok(public.menage_fin_saison('2027-02-01 04:17 Europe/Paris') >= 1, '1er février : le salon dont les photos sont parties est effacé');
reset role;
select t.ok(not exists (select 1 from public.salons where id = t.id('fsPhoto'))
            and not exists (select 1 from auth.users u join comptes c on c.user_id = u.id), 'tous les comptes concernés : supprimés');
set role service_role;
select t.ok(public.menage_fin_saison('2027-11-20 04:17 Europe/Paris') = 0, 'novembre suivant : les nouveaux salons ne sont pas touchés');
select t.ok(public.menage_fin_saison('2028-01-31 04:17 Europe/Paris') = 1, '31 janvier 2028 : le salon de la saison suivante est effacé');
reset role;
select t.ok((select count(*) from public.salons) = 3, 'restent : salon principal et salons « garder »');

-- =====================================================================
-- Droits : serveur seulement
-- =====================================================================
set role authenticated;
select t.raises($$select public.menage_fin_saison()$$, 'permission denied', 'connecté : ménage interdit');
select t.raises($$select * from public.salons_fin_saison()$$, 'permission denied', 'connecté : aperçu interdit');
select t.raises($$select public.demander_menage_photos()$$, 'permission denied', 'connecté : appel des photos interdit');
reset role;
set role anon;
select t.raises($$select public.menage_fin_saison()$$, 'permission denied', 'anonyme : ménage interdit');
select t.raises($$select public.date_fin_saison()$$, 'permission denied', 'anonyme : date interdite');
reset role;

update public.app_settings set salon_max_total = 50, salon_creations_par_jour = 50;
\echo 'Tous les tests du ménage de fin de saison sont passés.'
