-- =====================================================================
-- Planification du rappel de 20 h (heure de Paris) — à lancer UNE fois, APRÈS :
--   1) la migration 0002_rappels.sql ;
--   2) le déploiement de l'Edge Function « rappel-veille » (avec « Verify JWT » désactivé) ;
--   3) l'ajout du secret CRON_SECRET dans les secrets des Edge Functions.
-- Remplace les deux valeurs ENTRE CHEVRONS ci-dessous, puis Run.
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Secrets rangés dans le coffre (Vault) de Supabase, pas en clair dans la tâche
select vault.create_secret('<https://ton-projet.supabase.co>', 'project_url')
where not exists (select 1 from vault.secrets where name = 'project_url');
select vault.create_secret('<le-même-CRON_SECRET-que-dans-les-Edge-Functions>', 'rappel_cron_secret')
where not exists (select 1 from vault.secrets where name = 'rappel_cron_secret');

-- 18 h et 19 h UTC = 20 h à Paris en heure d'été / d'hiver : la fonction SQL reminder_targets
-- ne répond qu'à l'heure de Paris réglée dans app_settings.reminder_hour (20 par défaut).
select cron.unschedule('rappel-veille') where exists (select 1 from cron.job where jobname = 'rappel-veille');
select cron.schedule('rappel-veille', '0 18,19 * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/rappel-veille',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'rappel_cron_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
$$);

-- Vérifier : select * from cron.job;  Historique : select * from cron.job_run_details order by start_time desc limit 10;
