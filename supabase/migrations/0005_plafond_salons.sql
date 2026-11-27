-- =====================================================================
-- 0005 — Plafond global de salons (décision d'Alexandre, 27 nov : ouverture gratuite avec dons, ~50 couples
-- sur l'offre gratuite de Supabase). Modifiable : Table Editor → app_settings → salon_max_total.
-- Au-delà, la création renvoie LIMITE_CREATION avec un message qui commence par « Complet » : l'Interface
-- affiche alors l'écran « Complet pour cette année ».
-- =====================================================================
alter table public.app_settings add column if not exists salon_max_total int not null default 50
  check (salon_max_total >= 0);

create or replace function public.salon_create(p_config jsonb, p_ip_hash text)
returns table (salon_id uuid, token text)
language plpgsql volatile security definer set search_path = public as $$
#variable_conflict use_column
declare cfg record; s uuid; tok text;
begin
  select coalesce(a.salon_creations_par_heure, 5) as per_ip, coalesce(a.salon_creations_par_jour, 50) as per_day,
         coalesce(a.salon_max_total, 50) as max_total
    into cfg from (select 1) one left join public.app_settings a on a.id = 1;
  if (select count(*) from public.salons) >= cfg.max_total then
    raise exception 'LIMITE_CREATION : complet pour cette année, tous les calendriers ont trouvé preneur';
  end if;
  if (select count(*) from public.salon_creations c
      where c.ip_hash = p_ip_hash and c.created_at > now() - interval '1 hour') >= cfg.per_ip then
    raise exception 'LIMITE_CREATION : trop de calendriers créés depuis cet appareil, réessaie dans une heure';
  end if;
  if (select count(*) from public.salon_creations c where c.created_at > now() - interval '1 day') >= cfg.per_day then
    raise exception 'LIMITE_CREATION : beaucoup de calendriers ont été créés aujourd''hui, réessaie demain';
  end if;
  insert into public.salons (config) values (p_config) returning id into s;
  tok := public.new_salon_token();
  insert into public.salon_invitations (token, salon_id) values (tok, s);
  insert into public.salon_creations (ip_hash, salon_id) values (coalesce(p_ip_hash, '?'), s);
  return query select s, tok;
end $$;
revoke execute on function public.salon_create(jsonb, text) from public, anon, authenticated;
grant execute on function public.salon_create(jsonb, text) to service_role;
