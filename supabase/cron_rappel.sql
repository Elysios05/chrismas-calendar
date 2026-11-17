-- =====================================================================
-- Planification du rappel de 20 h et de la relance de 22 h 30 (heure de Paris) — à lancer APRÈS :
--   1) les migrations 0002_rappels.sql et 0003_relance.sql ;
--   2) le déploiement de l'Edge Function « rappel-veille » (avec « Verify JWT » désactivé) ;
--   3) l'ajout du secret CRON_SECRET dans les secrets des Edge Functions.
-- Remplace les deux valeurs ENTRE CHEVRONS ci-dessous, puis Run. Ré-exécutable (les secrets déjà
-- enregistrés sont gardés : pour en changer un, Project Settings → Vault).
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Secrets rangés dans le coffre (Vault) de Supabase, pas en clair dans la tâche
select vault.create_secret('<https://ton-projet.supabase.co>', 'project_url')
where not exists (select 1 from vault.secrets where name = 'project_url');
select vault.create_secret('<le-même-CRON_SECRET-que-dans-les-Edge-Functions>', 'rappel_cron_secret')
where not exists (select 1 from vault.secrets where name = 'rappel_cron_secret');

-- Une seule requête pour les deux envois : c'est la base (reminder_kind_at) qui décide, selon l'heure
-- de Paris, s'il s'agit du rappel, de la relance, ou de rien du tout.
create or replace function public.call_rappel_veille() returns bigint
language sql security definer set search_path = public as $fn$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/rappel-veille',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'rappel_cron_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  )
$fn$;
revoke execute on function public.call_rappel_veille() from public, anon, authenticated;

-- Deux créneaux UTC par envoi (heure d'hiver / d'été) : un seul tombe à la bonne heure de Paris.
--   rappel  20 h 00 Paris = 19 h 00 UTC (hiver) ou 18 h 00 UTC (été)
--   relance 22 h 30 Paris = 21 h 30 UTC (hiver) ou 20 h 30 UTC (été)
-- Si tu changes app_settings.reminder_hour / followup_time, change aussi ces horaires.
select cron.unschedule(jobname) from cron.job where jobname in ('rappel-veille', 'relance-veille');
select cron.schedule('rappel-veille',  '0 18,19 * * *',  'select public.call_rappel_veille()');
select cron.schedule('relance-veille', '30 20,21 * * *', 'select public.call_rappel_veille()');

-- Vérifier : select * from cron.job;  Historique : select * from cron.job_run_details order by start_time desc limit 10;
