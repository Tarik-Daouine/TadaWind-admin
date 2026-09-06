-- User-approved cap: EUR 10/month. FX must be explicitly configured before paid calls.
create table public.prospector_budget (
  id text primary key check(id='main'), monthly_limit_eur numeric not null check(monthly_limit_eur>0),
  eur_per_usd numeric check(eur_per_usd>0 and eur_per_usd<10)
);
insert into public.prospector_budget values('main',10,null);
create table public.prospector_ai_reservations (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default clock_timestamp(),
  reserved_eur numeric not null check(reserved_eur>0), actual_eur numeric check(actual_eur>=0),
  eur_per_usd numeric not null check(eur_per_usd>0), settled boolean not null default false
);
alter table public.prospector_budget enable row level security;
alter table public.prospector_ai_reservations enable row level security;
revoke all on public.prospector_budget,public.prospector_ai_reservations from public,anon,authenticated,service_role;
grant select on public.prospector_budget,public.prospector_ai_reservations to authenticated,service_role;
create policy prospector_budget_read on public.prospector_budget for select to authenticated using ((select auth.uid()) is not null);
create policy prospector_reservation_read on public.prospector_ai_reservations for select to authenticated using ((select auth.uid()) is not null);

create function public.prospector_reserve_ai(p_max_usd numeric) returns uuid
language plpgsql security definer set search_path='' as $$
declare config public.prospector_budget; spent numeric; result uuid;
begin
  perform public.prospector_require_worker();
  select * into strict config from public.prospector_budget where id='main' for update;
  if config.eur_per_usd is null then raise exception 'BUDGET_FX_NOT_CONFIGURED'; end if;
  if p_max_usd is null or p_max_usd<=0 or p_max_usd='NaN'::numeric or p_max_usd>10 then raise exception 'INVALID_BUDGET_RESERVATION'; end if;
  select coalesce(sum(coalesce(actual_eur,reserved_eur)),0) into spent from public.prospector_ai_reservations
    where created_at>=date_trunc('month',clock_timestamp() at time zone 'Europe/Paris') at time zone 'Europe/Paris';
  if spent+p_max_usd*config.eur_per_usd>config.monthly_limit_eur then raise exception 'MONTHLY_BUDGET_EXCEEDED'; end if;
  insert into public.prospector_ai_reservations(reserved_eur,eur_per_usd) values(p_max_usd*config.eur_per_usd,config.eur_per_usd) returning id into result;
  return result;
end $$;
create function public.prospector_settle_ai(p_id uuid,p_actual_usd numeric) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform public.prospector_require_worker();
  if p_actual_usd is null or p_actual_usd<0 or p_actual_usd='NaN'::numeric or p_actual_usd>10 then raise exception 'INVALID_BUDGET_SETTLEMENT'; end if;
  update public.prospector_ai_reservations set actual_eur=p_actual_usd*eur_per_usd,settled=true where id=p_id and not settled;
  if not found then raise exception 'BUDGET_RESERVATION_NOT_OPEN'; end if;
end $$;
revoke all on function public.prospector_reserve_ai(numeric),public.prospector_settle_ai(uuid,numeric) from public,anon,authenticated,service_role;
grant execute on function public.prospector_reserve_ai(numeric),public.prospector_settle_ai(uuid,numeric) to service_role;
