-- =====================================================================
-- 0007 — Ménage de fin de saison (décision d'Alexandre, 28 nov 2026, option A).
-- La page Confidentialité promet : données gardées AU PLUS TARD jusqu'au 31 janvier qui suit la saison.
-- À exécuter après 0006. Ré-exécutable.
--
-- • salons.garder : un salon marqué « garder » n'est JAMAIS effacé automatiquement (ni par ce ménage, ni par
--   purge_salons_inactifs). Se pose à la main dans le SQL Editor :
--       update public.salons set garder = true where id = '<id du salon>';
--   (aucun identifiant de salon réel ne doit être écrit dans ce dépôt public).
-- • menage_fin_saison() : à partir du 31 janvier (0 h, heure de Paris) qui suit le 1er décembre de la saison,
--   supprime tous les salons créés avant cette date, sauf ceux marqués « garder » et le salon principal :
--   photos (bucket « photos »), comptes (auth.users), puis le salon (le reste part en cascade).
--   Appelée chaque nuit par menage_quotidien() (pg_cron « menage-salons », 3 h 17 UTC).
--
-- Photos : Supabase interdit de supprimer des fichiers en SQL (DELETE sur storage.objects refusé, et il
-- laisserait les fichiers orphelins dans le stockage). Elles passent donc par l'API Storage, dans l'Edge Function
-- « salons » (action « fin-saison »), que la base appelle via pg_net avec les secrets du coffre déjà créés pour
-- les rappels (project_url, rappel_cron_secret = secret CRON_SECRET des Edge Functions). Concrètement :
--   1) les salons SANS photo sont supprimés directement en SQL ;
--   2) s'il reste des salons AVEC photos, la base appelle l'Edge Function, qui vide leurs dossiers puis appelle
--      supprimer_salon pour chacun ;
--   3) si l'appel échoue (fonction pas déployée, secret absent…), le ménage réessaie la nuit suivante : un salon
--      qui a encore des photos n'est jamais supprimé en SQL, pour ne pas laisser de fichiers orphelins.
-- Aperçu sans rien supprimer : select * from public.salons_fin_saison();
-- =====================================================================

alter table public.salons add column if not exists garder boolean not null default false;

-- ---------------------------------------------------------------------
-- Date du ménage : 31 janvier, 0 h (fuseau du site), qui suit le 1er décembre de la saison en cours.
-- Saison = celle dont le 1er décembre est le plus récent (en décembre : cette année ; sinon : l'année d'avant).
-- p_maintenant : pour les tests seulement (date simulée).
-- ---------------------------------------------------------------------
create or replace function public.date_fin_saison(p_maintenant timestamptz default null) returns timestamptz
language plpgsql stable security definer set search_path = public as $$
declare tz text; maint timestamptz := coalesce(p_maintenant, now()); local timestamp; annee int;
begin
  select coalesce(a.timezone, 'Europe/Paris') into tz from (select 1) one left join public.app_settings a on a.id = 1;
  local := maint at time zone tz;
  annee := extract(year from local)::int - case when extract(month from local) = 12 then 0 else 1 end;
  return make_timestamptz(annee + 1, 1, 31, 0, 0, 0, tz);
end $$;

-- Salons à effacer maintenant (vide avant la date). Seuls les salons créés AVANT la date sont concernés :
-- un salon créé pour la saison suivante (ex. en novembre) n'est pas touché.
create or replace function public.salons_fin_saison(p_maintenant timestamptz default null)
returns table (salon_id uuid, cree_le timestamptz, a_des_photos boolean)
language plpgsql stable security definer set search_path = public, storage as $$
#variable_conflict use_column
declare fin timestamptz := public.date_fin_saison(p_maintenant);
begin
  if coalesce(p_maintenant, now()) < fin then return; end if;
  return query
  select s.id, s.created_at,
         exists (select 1 from storage.objects o where o.bucket_id = 'photos' and o.name like s.id::text || '/%')
  from public.salons s
  where s.id <> public.legacy_salon_id()
    and not s.garder
    and s.created_at < fin
  order by s.created_at;
end $$;

-- Demande à l'Edge Function « salons » de vider les photos des salons à effacer (puis de les supprimer).
-- Renvoie l'identifiant de la requête pg_net, ou null si pg_net / le coffre ne sont pas en place (tests locaux).
-- SQL dynamique : la fonction se crée même sans les schémas net et vault.
create or replace function public.demander_menage_photos() returns bigint
language plpgsql volatile security definer set search_path = public as $$
declare url text; secret text; req bigint;
begin
  if to_regnamespace('net') is null or to_regclass('vault.decrypted_secrets') is null then
    raise warning 'menage_fin_saison : pg_net ou le coffre (Vault) manque, photos non supprimées';
    return null;
  end if;
  execute $q$select max(decrypted_secret) filter (where name = 'project_url'),
                    max(decrypted_secret) filter (where name = 'rappel_cron_secret')
             from vault.decrypted_secrets where name in ('project_url', 'rappel_cron_secret')$q$
    into url, secret;
  if url is null or secret is null then
    raise warning 'menage_fin_saison : secrets project_url / rappel_cron_secret absents du coffre, photos non supprimées';
    return null;
  end if;
  execute $q$select net.http_post(url := $1, headers := $2, body := $3, timeout_milliseconds := 60000)$q$
    into req
    using url || '/functions/v1/salons',
          jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
          jsonb_build_object('action', 'fin-saison');
  return req;
end $$;

-- Le ménage lui-même. Renvoie le nombre de salons supprimés par la base (0 avant la date).
create or replace function public.menage_fin_saison(p_maintenant timestamptz default null) returns int
language plpgsql volatile security definer set search_path = public as $$
declare r record; n int := 0; avec_photos int := 0;
begin
  for r in select * from public.salons_fin_saison(p_maintenant) loop
    if r.a_des_photos then
      avec_photos := avec_photos + 1;              -- l'Edge Function s'en charge (photos d'abord)
    else
      n := n + public.supprimer_salon(r.salon_id); -- comptes, puis salon (cascade)
    end if;
  end loop;
  if avec_photos > 0 then perform public.demander_menage_photos(); end if;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Purge des salons inactifs (0006) : identique, sauf qu'un salon marqué « garder » n'est jamais proposé.
-- ---------------------------------------------------------------------
create or replace function public.salons_inactifs(p_heures int default null, p_maintenant timestamptz default null)
returns table (salon_id uuid, cree_le timestamptz, derniere_activite timestamptz, rejoint boolean)
language plpgsql stable security definer set search_path = public, auth, storage as $$
#variable_conflict use_column
declare h int; debut timestamptz; tz text; oh int; maint timestamptz := coalesce(p_maintenant, now());
begin
  select coalesce(p_heures, a.salon_inactif_heures, 48), coalesce(a.timezone, 'Europe/Paris'), coalesce(a.open_hour, 7)
    into h, tz, oh from (select 1) one left join public.app_settings a on a.id = 1;
  h := greatest(h, 24);   -- jamais moins d'un jour, même par erreur
  debut := make_timestamptz(extract(year from maint at time zone tz)::int, 12, 1, oh, 0, 0, tz);
  return query
  with base as (
    select s.id, s.created_at,
           greatest(s.created_at, s.updated_at,
             (select max(greatest(u.last_sign_in_at, se.updated_at, se.refreshed_at at time zone 'UTC'))
              from public.profiles p join auth.users u on u.id = p.user_id
              left join auth.sessions se on se.user_id = u.id
              where p.salon_id = s.id)) as derniere,
           exists (select 1 from public.profiles p where p.salon_id = s.id and p.who = 'flavie') as rejoint
    from public.salons s
    where s.id <> public.legacy_salon_id()
      and not s.garder
      and s.updated_at <= s.created_at + interval '10 minutes'
      and not exists (select 1 from public.progress x where x.salon_id = s.id)
      and not exists (select 1 from public.prepared_content x where x.salon_id = s.id)
      and not exists (select 1 from public.game_state x where x.salon_id = s.id)
      and not exists (select 1 from public.push_subscriptions x where x.salon_id = s.id)
      and not exists (select 1 from storage.objects o where o.bucket_id = 'photos' and o.name like s.id::text || '/%')
  )
  select b.id, b.created_at, b.derniere, b.rejoint from base b
  where b.derniere < maint - make_interval(hours => h)
    and (not b.rejoint or maint > debut + make_interval(hours => h));
end $$;

-- ---------------------------------------------------------------------
-- Ménage quotidien (0006) + fin de saison. Même tâche pg_cron « menage-salons » (3 h 17 UTC) : rien à replanifier.
-- ---------------------------------------------------------------------
create or replace function public.menage_quotidien() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare salons int; fin_saison int; journal int; essais int;
begin
  salons := public.purge_salons_inactifs();
  fin_saison := public.menage_fin_saison();
  delete from public.salon_creations where created_at < now() - interval '30 days';
  get diagnostics journal = row_count;
  delete from public.salon_essais where created_at < now() - interval '2 days';
  get diagnostics essais = row_count;
  return jsonb_build_object('salons_supprimes', salons, 'fin_saison', fin_saison,
                            'journal_efface', journal, 'essais_effaces', essais);
end $$;

-- ---------------------------------------------------------------------
-- Droits : serveur seulement
-- ---------------------------------------------------------------------
revoke execute on function
  public.date_fin_saison(timestamptz), public.salons_fin_saison(timestamptz), public.demander_menage_photos(),
  public.menage_fin_saison(timestamptz), public.salons_inactifs(int, timestamptz), public.menage_quotidien()
  from public, anon, authenticated;
grant execute on function
  public.date_fin_saison(timestamptz), public.salons_fin_saison(timestamptz), public.demander_menage_photos(),
  public.menage_fin_saison(timestamptz), public.salons_inactifs(int, timestamptz), public.menage_quotidien()
  to service_role;
