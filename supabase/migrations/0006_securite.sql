-- =====================================================================
-- 0006 — Correctifs de l'audit de sécurité du 27 nov 2026 (docs/securite/audit-2026-11-27.md).
-- À exécuter après 0005. Ré-exécutable. Chaque bloc renvoie à l'identifiant du constat (SEC-xx).
--
-- Tous les seuils sont dans app_settings (Table Editor → app_settings) et se règlent sans code.
-- Les erreurs gardent la forme « CODE : message » lue par l'Edge Function « salons » et par le site.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Réglages (garde-fous)
-- ---------------------------------------------------------------------
alter table public.app_settings add column if not exists salon_creations_par_ip_jour int not null default 2
  check (salon_creations_par_ip_jour >= 0);                -- SEC-01 : salons créés par adresse IP et par jour
alter table public.app_settings add column if not exists salon_essais_par_heure int not null default 10
  check (salon_essais_par_heure >= 0);                     -- SEC-01/05/12 : essais (réussis ou non) par IP et par heure
alter table public.app_settings add column if not exists salon_inactif_heures int not null default 48
  check (salon_inactif_heures >= 24);                      -- SEC-01 : purge des salons sans activité
alter table public.app_settings add column if not exists salon_game_rows_max int not null default 1000
  check (salon_game_rows_max between 0 and 100000);        -- SEC-02 : lignes de game_state par salon
alter table public.app_settings add column if not exists salon_game_octets_max bigint not null default 5242880
  check (salon_game_octets_max >= 0);                      -- SEC-02 : 5 Mo de données de jeu par salon
alter table public.app_settings add column if not exists salon_photo_octets_max bigint not null default 41943040
  check (salon_photo_octets_max >= 0);                     -- SEC-03 : 40 Mo de photos par salon
alter table public.app_settings add column if not exists photos_octets_total_max bigint not null default 943718400
  check (photos_octets_total_max >= 0);                    -- SEC-03 : 900 Mo pour tout le site (offre gratuite : 1 Go)
alter table public.app_settings add column if not exists push_appareils_max int not null default 5
  check (push_appareils_max between 1 and 50);             -- SEC-04 : appareils par personne
alter table public.app_settings add column if not exists salon_invitation_jours int not null default 30
  check (salon_invitation_jours >= 1);                     -- SEC-16 : durée de vie d'un lien d'invitation

-- SEC-01 : une création par adresse IP et par heure (5 avant). On ne touche pas à une valeur réglée à la main.
update public.app_settings set salon_creations_par_heure = 1 where id = 1 and salon_creations_par_heure = 5;
alter table public.app_settings alter column salon_creations_par_heure set default 1;

-- =====================================================================
-- SEC-01 — Création de salons
-- =====================================================================
-- Les créations ratées (compte impossible → salon supprimé par l'Edge Function) ne comptent pas dans les
-- limites : on ne compte que les salons qui existent encore. Les essais, eux, sont bornés (salon_essais_par_heure)
-- pour qu'on ne puisse pas boucler sur des échecs.
create index if not exists salon_creations_ip on public.salon_creations (ip_hash, created_at);

create or replace function public.salon_create(p_config jsonb, p_ip_hash text)
returns table (salon_id uuid, token text)
language plpgsql volatile security definer set search_path = public as $$
#variable_conflict use_column
declare cfg record; s uuid; tok text; ip text := coalesce(p_ip_hash, '?');
begin
  -- une création à la fois : pas de course entre deux envois simultanés (plafond, limites par IP)
  perform pg_advisory_xact_lock(hashtext('public.salon_create'));
  select coalesce(a.salon_creations_par_heure, 1) as per_ip, coalesce(a.salon_creations_par_ip_jour, 2) as per_ip_day,
         coalesce(a.salon_creations_par_jour, 50) as per_day, coalesce(a.salon_max_total, 50) as max_total,
         coalesce(a.salon_essais_par_heure, 10) as essais
    into cfg from (select 1) one left join public.app_settings a on a.id = 1;
  if (select count(*) from public.salons) >= cfg.max_total then
    raise exception 'LIMITE_CREATION : complet pour cette année, tous les calendriers ont trouvé preneur';
  end if;
  if (select count(*) from public.salon_creations c
      where c.ip_hash = ip and c.created_at > now() - interval '1 hour') >= cfg.essais then
    raise exception 'LIMITE_CREATION : trop d''essais depuis cet appareil, réessaie dans une heure';
  end if;
  if (select count(*) from public.salon_creations c join public.salons x on x.id = c.salon_id
      where c.ip_hash = ip and c.created_at > now() - interval '1 hour') >= cfg.per_ip then
    raise exception 'LIMITE_CREATION : un calendrier vient d''être créé depuis cet appareil, réessaie dans une heure';
  end if;
  if (select count(*) from public.salon_creations c join public.salons x on x.id = c.salon_id
      where c.ip_hash = ip and c.created_at > now() - interval '1 day') >= cfg.per_ip_day then
    raise exception 'LIMITE_CREATION : trop de calendriers créés depuis cet appareil aujourd''hui, réessaie demain';
  end if;
  if (select count(*) from public.salon_creations c join public.salons x on x.id = c.salon_id
      where c.created_at > now() - interval '1 day') >= cfg.per_day then
    raise exception 'LIMITE_CREATION : beaucoup de calendriers ont été créés aujourd''hui, réessaie demain';
  end if;
  insert into public.salons (config) values (p_config) returning id into s;
  tok := public.new_salon_token();
  insert into public.salon_invitations (token, salon_id) values (tok, s);
  insert into public.salon_creations (ip_hash, salon_id) values (ip, s);
  return query select s, tok;
end $$;
revoke execute on function public.salon_create(jsonb, text) from public, anon, authenticated;
grant execute on function public.salon_create(jsonb, text) to service_role;

-- ---------------------------------------------------------------------
-- Purge des salons sans activité réelle (pg_cron, chaque nuit). Prudente : un salon n'est supprimé que si
-- TOUT ceci est vrai :
--   • ce n'est pas le salon principal ;
--   • aucune case ouverte (progress), aucune case préparée, aucune donnée de jeu, aucune photo, aucun appareil
--     abonné aux rappels ;
--   • ses réglages n'ont jamais été modifiés après la création (personnaliser les jeux = préparer) ;
--   • personne n'y est venu depuis salon_inactif_heures (48 h) : ni création, ni connexion, ni session
--     rafraîchie (un site ouvert rafraîchit sa session toutes les heures) ;
--   • si l'invité·e a rejoint : on est aussi à plus de 48 h après l'ouverture de la case 1 (1er déc., 7 h),
--     car avant décembre il n'y a rien à jouer et un couple prêt peut simplement attendre.
-- Aperçu sans rien supprimer : select * from public.salons_inactifs();
-- ---------------------------------------------------------------------
-- p_maintenant : pour les tests seulement (date simulée).
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

create or replace function public.purge_salons_inactifs(p_heures int default null, p_maintenant timestamptz default null)
returns int
language plpgsql volatile security definer set search_path = public, auth as $$
declare ids uuid[]; n int;
begin
  select array_agg(i.salon_id) into ids from public.salons_inactifs(p_heures, p_maintenant) i;
  if ids is null then return 0; end if;
  delete from auth.users u using public.profiles p where p.user_id = u.id and p.salon_id = any (ids);
  delete from public.salons where id = any (ids);
  get diagnostics n = row_count;
  return n;
end $$;

-- =====================================================================
-- SEC-05 / SEC-12 — Essais de connexion, d'invitation et de « mot de passe oublié » par adresse IP
-- =====================================================================
create table if not exists public.salon_essais (
  id         bigserial primary key,
  ip_hash    text not null,
  action     text not null,
  created_at timestamptz not null default now()
);
create index if not exists salon_essais_ip on public.salon_essais (ip_hash, action, created_at);
alter table public.salon_essais enable row level security;
revoke all on public.salon_essais from public, anon, authenticated;

-- Refuse si cette adresse IP a déjà fait trop d'essais ratés de cette action dans l'heure (serveur seulement)
create or replace function public.salon_essai_ok(p_ip_hash text, p_action text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if (select count(*) from public.salon_essais e
      where e.ip_hash = coalesce(p_ip_hash, '?') and e.action = p_action and e.created_at > now() - interval '1 hour')
     >= (select coalesce(max(a.salon_essais_par_heure), 10) from public.app_settings a where a.id = 1) then
    raise exception 'LIMITE_CREATION : trop d''essais depuis cet appareil, réessaie dans une heure';
  end if;
end $$;
create or replace function public.salon_essai_rate(p_ip_hash text, p_action text) returns void
language sql volatile security definer set search_path = public as $$
  insert into public.salon_essais (ip_hash, action) values (coalesce(p_ip_hash, '?'), p_action)
$$;

-- =====================================================================
-- SEC-05 — L'adresse e-mail réelle n'est plus jamais donnée à un visiteur
-- =====================================================================
-- Ce que le site a besoin de savoir pour se connecter à une place :
--   existe : la place est-elle prise ?
--   email  : l'adresse technique <salon>-<place>@… (rien de personnel), ou null si le compte a une adresse
--            réelle : la connexion passe alors par l'Edge Function « salons » (action "connexion").
create or replace function public.salon_connexion_info(p_salon uuid, p_place text) returns jsonb
language sql stable security definer set search_path = public, auth as $$
  select jsonb_build_object(
    'existe', u.id is not null,
    'email', case when u.email like p_salon::text || '-' || p_place || '@%' then u.email end)
  from (select 1) one
  left join public.profiles p on p.salon_id = p_salon and p.who = p_place
  left join auth.users u on u.id = p.user_id
$$;

-- Ancienne fonction (sites pas encore mis à jour) : seulement l'adresse technique, jamais une adresse réelle
create or replace function public.salon_login_email(p_salon uuid, p_place text) returns text
language sql stable security definer set search_path = public, auth as $$
  select u.email from public.profiles p join auth.users u on u.id = p.user_id
  where p.salon_id = p_salon and p.who = p_place and u.email like p_salon::text || '-' || p_place || '@%'
$$;

-- Adresse de connexion complète (réelle ou technique) : serveur seulement
create or replace function public.salon_login_email_serveur(p_salon uuid, p_place text) returns text
language sql stable security definer set search_path = public, auth as $$
  select u.email from public.profiles p join auth.users u on u.id = p.user_id
  where p.salon_id = p_salon and p.who = p_place
$$;

-- Salon d'un compte (Edge Function, action "supprimer")
create or replace function public.salon_of_user(p_user uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select salon_id from public.profiles where user_id = p_user
$$;

-- =====================================================================
-- SEC-16 — Lien d'invitation valable salon_invitation_jours jours (30)
-- =====================================================================
create or replace function public.invitation_valide(p_created timestamptz) returns boolean
language sql stable security definer set search_path = public as $$
  select p_created > now() - make_interval(days => coalesce(
    (select salon_invitation_jours from public.app_settings where id = 1), 30))
$$;

create or replace function public.salon_invitation_info(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare inv record; arrived boolean;
begin
  select i.*, s.config into inv from public.salon_invitations i join public.salons s on s.id = i.salon_id
  where i.token = p_token;
  if not found then return jsonb_build_object('statut', 'invalide'); end if;
  arrived := exists (select 1 from public.profiles p where p.salon_id = inv.salon_id and p.who = 'flavie');
  if inv.used_at is null and not arrived and not public.invitation_valide(inv.created_at) then
    return jsonb_build_object('statut', 'invalide');
  end if;
  return jsonb_build_object(
    'statut', case when inv.used_at is null and not arrived then 'valide' else 'utilisee' end,
    'jeton', p_token, 'salonId', inv.salon_id, 'joueurs', inv.config -> 'joueurs');
end $$;

create or replace function public.salon_invitation(p_nouveau boolean default false) returns text
language plpgsql volatile security definer set search_path = public as $$
declare s uuid := public.my_salon(); tok text;
begin
  if s is null or public.my_who() is distinct from 'alexandre' then
    raise exception 'NON_AUTORISE : seule la personne qui a créé le calendrier peut inviter' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where salon_id = s and who = 'flavie') then
    raise exception 'INVITATION_UTILISEE : l''autre personne a déjà rejoint le calendrier';
  end if;
  if not p_nouveau then
    select token into tok from public.salon_invitations
    where salon_id = s and used_at is null and public.invitation_valide(created_at) order by created_at desc limit 1;
    if tok is not null then return tok; end if;
  end if;
  delete from public.salon_invitations where salon_id = s and used_at is null;
  tok := public.new_salon_token();
  insert into public.salon_invitations (token, salon_id) values (tok, s);
  return tok;
end $$;

create or replace function public.salon_claim_invitation(p_token text) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare s uuid;
begin
  update public.salon_invitations set used_at = now()
  where token = p_token and used_at is null and public.invitation_valide(created_at)
    and not exists (select 1 from public.profiles p where p.salon_id = salon_invitations.salon_id and p.who = 'flavie')
  returning salon_id into s;
  if s is null then
    if exists (select 1 from public.salon_invitations where token = p_token and used_at is not null) then
      raise exception 'INVITATION_UTILISEE : ce lien d''invitation a déjà servi';
    end if;
    raise exception 'INVITATION_INVALIDE : ce lien d''invitation n''est pas (ou plus) valable';
  end if;
  return s;
end $$;

-- =====================================================================
-- SEC-02 — game_state : 512 Ko par valeur, nombre de lignes et volume par salon
-- =====================================================================
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'game_state_value_size'
                 and conrelid = 'public.game_state'::regclass) then
    alter table public.game_state add constraint game_state_value_size
      check (value is null or octet_length(value::text) <= 524288) not valid;
  end if;
  begin
    alter table public.game_state validate constraint game_state_value_size;
  exception when check_violation then
    raise warning 'game_state : des valeurs existantes dépassent 512 Ko (gardées ; les nouvelles seront refusées)';
  end;
end $$;

create or replace function public.game_state_quota() returns trigger
language plpgsql security definer set search_path = public as $$
declare cfg record; n bigint; octets bigint;
begin
  if new.value is not null and octet_length(new.value::text) > 524288 then
    raise exception 'QUOTA_JEUX : donnée de jeu trop volumineuse (512 Ko maximum)' using errcode = 'P0001';
  end if;
  select coalesce(a.salon_game_rows_max, 1000) as rows_max, coalesce(a.salon_game_octets_max, 5242880) as octets_max
    into cfg from (select 1) one left join public.app_settings a on a.id = 1;
  -- les autres lignes du salon (celle qu'on remplace ne compte pas)
  select count(*), coalesce(sum(pg_column_size(g.value)), 0) into n, octets
  from public.game_state g
  where g.salon_id = new.salon_id
    and not (g.day = new.day and g.key = new.key)
    and (tg_op = 'INSERT' or not (g.day = old.day and g.key = old.key and g.salon_id = old.salon_id));
  if n >= cfg.rows_max then
    raise exception 'QUOTA_JEUX : trop de données de jeu pour ce calendrier' using errcode = 'P0001';
  end if;
  if octets + coalesce(pg_column_size(new.value), 0) > cfg.octets_max then
    raise exception 'QUOTA_JEUX : trop de données de jeu pour ce calendrier' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists game_state_quota on public.game_state;
create trigger game_state_quota before insert or update on public.game_state
  for each row execute function public.game_state_quota();

-- =====================================================================
-- SEC-03 — Photos : 5 Mo par fichier, volume par salon et pour tout le site (en octets)
-- (la taille d'un fichier n'est connue qu'après l'envoi : le volume peut dépasser d'au plus une photo)
-- =====================================================================
update storage.buckets set file_size_limit = 5242880
where id = 'photos' and (file_size_limit is null or file_size_limit > 5242880);

create or replace function public.salon_photo_quota_ok() returns boolean
language sql stable security definer set search_path = public, storage as $$
  with cfg as (
    select coalesce(a.salon_photo_max, 150) as nb_max, coalesce(a.salon_photo_octets_max, 41943040) as octets_max,
           coalesce(a.photos_octets_total_max, 943718400) as total_max
    from (select 1) one left join public.app_settings a on a.id = 1
  ), mine as (
    select o.metadata from storage.objects o
    where o.bucket_id = 'photos' and (o.name like public.my_salon()::text || '/%'
      or (public.my_salon() = public.legacy_salon_id() and split_part(o.name, '/', 1) in ('alexandre', 'flavie')))
  )
  select (select count(*) from mine) < cfg.nb_max
     and (select coalesce(sum(case when (metadata ->> 'size') ~ '^[0-9]+$' then (metadata ->> 'size')::bigint end), 0)
          from mine) < cfg.octets_max
     and (select coalesce(sum(case when (o.metadata ->> 'size') ~ '^[0-9]+$' then (o.metadata ->> 'size')::bigint end), 0)
          from storage.objects o where o.bucket_id = 'photos') < cfg.total_max
  from cfg
$$;

-- =====================================================================
-- SEC-10 — Une case préparée ne référence que des photos de SON auteur, dans SON salon
-- =====================================================================
create or replace function public.prepared_photos_ok(p_salon uuid, p_from text, p_photos text[]) returns boolean
language sql immutable set search_path = public as $$
  select coalesce(bool_and(
           (p like p_salon::text || '/' || p_from || '/%' and p !~ '(^|/)\.\.(/|$)')
           or (p_salon = '00000000-0000-0000-0000-000000000001'::uuid and p like p_from || '/%' and p !~ '(^|/)\.\.(/|$)')),
         true)
  from unnest(coalesce(p_photos, '{}'::text[])) as p
$$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'prepared_photos_du_salon'
                 and conrelid = 'public.prepared_content'::regclass) then
    alter table public.prepared_content add constraint prepared_photos_du_salon
      check (public.prepared_photos_ok(salon_id, from_who, photos)) not valid;
  end if;
  begin
    alter table public.prepared_content validate constraint prepared_photos_du_salon;
  exception when check_violation then
    raise warning 'prepared_content : des cases existantes ont des photos hors de leur dossier (gardées)';
  end;
end $$;

-- photo_frozen : seulement les cases du salon à qui appartient le fichier
create or replace function public.photo_frozen(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.prepared_content p
    where object_name = any (p.photos)
      and (split_part(object_name, '/', 1) = p.salon_id::text or p.salon_id = public.legacy_salon_id())
      and public.prepared_frozen_in(p.salon_id, p.day, p.to_who))
$$;

-- =====================================================================
-- SEC-04 — Abonnements push : services connus seulement, push_appareils_max (5) appareils par personne
-- Au-delà, le plus ancien appareil DE CETTE PERSONNE est remplacé : personne ne peut gêner les autres.
-- =====================================================================
create or replace function public.push_endpoint_ok(p_endpoint text) returns boolean
language sql immutable set search_path = public as $$
  select coalesce(char_length(p_endpoint) <= 1000 and (
       h = 'fcm.googleapis.com' or h = 'updates.push.services.mozilla.com'
    or h = 'web.push.apple.com' or h like '%.push.apple.com' or h like '%.notify.windows.com'), false)
  from (select lower(substring(p_endpoint from '^https://([^/:?#@]+)(/|$)')) as h) x
$$;

create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare me text := public.my_who(); s uuid := public.my_salon(); maxi int;
begin
  if me is null or s is null then raise exception 'Pas connecté' using errcode = '42501'; end if;
  if not public.push_endpoint_ok(p_endpoint) then
    raise exception 'ABONNEMENT_INVALIDE : service de notification inconnu' using errcode = '22023';
  end if;
  if char_length(coalesce(p_p256dh, '')) not between 1 and 200 or char_length(coalesce(p_auth, '')) not between 1 and 100 then
    raise exception 'ABONNEMENT_INVALIDE : clés invalides' using errcode = '22023';
  end if;
  select coalesce(max(push_appareils_max), 5) into maxi from public.app_settings where id = 1;
  -- on garde les (maxi - 1) plus récents de cette personne, puis on ajoute celui-ci
  delete from public.push_subscriptions d
  where d.salon_id = s and d.who = me and d.endpoint <> p_endpoint
    and d.endpoint not in (
      select k.endpoint from public.push_subscriptions k
      where k.salon_id = s and k.who = me and k.endpoint <> p_endpoint
      order by k.last_seen_at desc nulls last limit greatest(maxi - 1, 0));
  insert into public.push_subscriptions (endpoint, who, salon_id, p256dh, auth, user_agent)
  values (p_endpoint, me, s, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set who = excluded.who, salon_id = excluded.salon_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, last_seen_at = now();
end $$;

-- =====================================================================
-- SEC-07 / SEC-01 — Ménage quotidien : salons inactifs, journal des créations (30 jours), essais (2 jours)
-- =====================================================================
create or replace function public.menage_quotidien() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare salons int; journal int; essais int;
begin
  salons := public.purge_salons_inactifs();
  delete from public.salon_creations where created_at < now() - interval '30 days';
  get diagnostics journal = row_count;
  delete from public.salon_essais where created_at < now() - interval '2 days';
  get diagnostics essais = row_count;
  return jsonb_build_object('salons_supprimes', salons, 'journal_efface', journal, 'essais_effaces', essais);
end $$;

-- Planification (pg_cron) : chaque nuit à 3 h 17 UTC. Rien si pg_cron n'est pas installé (tests locaux).
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'menage-salons';
    perform cron.schedule('menage-salons', '17 3 * * *', 'select public.menage_quotidien()');
  end if;
end $$;

-- =====================================================================
-- SEC-11 — Droits minimaux
-- =====================================================================
-- Fonctions internes (règles d'accès, déclencheurs) : plus appelables sans compte via /rest/v1/rpc.
-- Les politiques RLS les appellent avec les droits de l'utilisateur connecté : elles restent à « authenticated ».
revoke execute on function
  public.my_who(), public.my_salon(), public.salon_today(uuid), public.advent_day_at(timestamptz),
  public.prepared_frozen(int, text), public.prepared_frozen_in(uuid, int, text),
  public.photo_readable(text), public.photo_owner_ok(text), public.photo_frozen(text), public.salon_photo_quota_ok(),
  public.partner_of(text), public.legacy_salon_id(), public.invitation_valide(timestamptz)
  from public, anon;
grant execute on function
  public.my_who(), public.my_salon(), public.salon_today(uuid), public.advent_day_at(timestamptz),
  public.prepared_frozen(int, text), public.prepared_frozen_in(uuid, int, text),
  public.photo_readable(text), public.photo_owner_ok(text), public.photo_frozen(text), public.salon_photo_quota_ok(),
  public.partner_of(text), public.legacy_salon_id(), public.invitation_valide(timestamptz),
  public.prepared_photos_ok(uuid, text, text[]), public.push_endpoint_ok(text)
  to authenticated, service_role;
revoke execute on function public.prepared_photos_ok(uuid, text, text[]), public.push_endpoint_ok(text) from public, anon;
grant execute on function public.advent_today() to anon, authenticated;

-- Déclencheurs : jamais appelés directement
revoke execute on function public.touch_row(), public.prepared_guard(), public.salons_guard(), public.game_state_quota()
  from public, anon, authenticated;
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;

-- Fonctions des salons : visiteurs (lecture d'un salon, d'une invitation, info de connexion), créateur, serveur
revoke execute on function
  public.salon_connexion_info(uuid, text), public.salon_login_email(uuid, text), public.salon_login_email_serveur(uuid, text),
  public.salon_of_user(uuid), public.salon_essai_ok(text, text), public.salon_essai_rate(text, text),
  public.salons_inactifs(int, timestamptz), public.purge_salons_inactifs(int, timestamptz), public.menage_quotidien(),
  public.ensure_legacy_salon(), public.new_salon_token()
  from public, anon, authenticated;
grant execute on function public.salon_connexion_info(uuid, text), public.salon_login_email(uuid, text)
  to anon, authenticated;
grant execute on function
  public.salon_connexion_info(uuid, text), public.salon_login_email(uuid, text), public.salon_login_email_serveur(uuid, text),
  public.salon_of_user(uuid), public.salon_essai_ok(text, text), public.salon_essai_rate(text, text),
  public.salons_inactifs(int, timestamptz), public.purge_salons_inactifs(int, timestamptz), public.menage_quotidien(),
  public.salon_claim_invitation(text), public.salon_invitation_info(text)
  to service_role;

-- Privilèges de table inutiles (TRUNCATE ignore la RLS)
revoke truncate, trigger, references on
  public.app_settings, public.game_state, public.prepared_content, public.profiles, public.progress,
  public.push_subscriptions, public.reminder_log, public.salons
  from anon, authenticated;
revoke insert, update, delete, select on public.reminder_log from anon, authenticated;
revoke insert, update on public.push_subscriptions from anon, authenticated;   -- save_push_subscription seulement
revoke select, delete on public.push_subscriptions from anon;
revoke insert, update, delete on public.app_settings, public.profiles from anon, authenticated;

-- pg_net : réservé au serveur
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'net') then
    execute 'revoke execute on all functions in schema net from public, anon, authenticated';
    execute 'revoke usage on schema net from public, anon, authenticated';
  end if;
end $$;

-- search_path figé (avertissement du conseiller Supabase)
alter function public.partner_of(text) set search_path = public;
alter function public.legacy_salon_id() set search_path = public;
alter function public.salon_config_check(jsonb) set search_path = public;
alter function public.new_salon_token() set search_path = public;
