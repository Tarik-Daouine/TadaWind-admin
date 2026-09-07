-- La commune manquante devient un job durable au lieu d'un rattrapage manuel.
-- Chemin rapide inchangé (completeLocations pendant la découverte) ; ce qui échoue
-- ou arrive plus tard est repris par la file, avec ses réessais et son backoff.

alter table public.prospects add column if not exists location_checked_at timestamptz;

alter table public.prospect_jobs drop constraint if exists prospect_jobs_type_check;
alter table public.prospect_jobs add constraint prospect_jobs_type_check
  check (type in ('discovery','enrich','analyze','score','strategize','copywrite','crm_next','manual_analyze','locate'));

create index if not exists prospects_location_pending_idx on public.prospects (discovered_at)
  where city is null and location_checked_at is null and lat is not null and lng is not null and deleted_at is null;

-- Balayage : commune vide, point exploitable, pas de réponse définitive déjà obtenue,
-- et pas de tentative récente (les pannes transitoires repassent, pas les cas définitifs).
create or replace function public.prospector_enqueue_locations(p_limit integer default 25) returns integer
language plpgsql security definer set search_path = '' as $$
declare queued integer := 0; target uuid;
begin
  if auth.role() is distinct from 'service_role' then perform public.prospector_require_user(); end if;
  if p_limit is null or p_limit not between 1 and 200 then raise exception 'INVALID_ENQUEUE_LIMIT'; end if;
  for target in
    select p.id from public.prospects p
    where nullif(trim(p.city),'') is null
      and p.location_checked_at is null
      and p.lat is not null and p.lng is not null
      and p.deleted_at is null
      and p.status not in ('excluded','archived','lost','won')
      and not exists (
        select 1 from public.prospect_jobs j
        where j.prospect_id = p.id and j.type = 'locate'
          and (j.status in ('queued','running') or j.updated_at > clock_timestamp() - interval '6 hours'))
    order by p.discovered_at limit p_limit
  loop
    insert into public.prospect_jobs(type,prospect_id,idempotency_key)
      values('locate',target,'locate:'||target||':'||floor(extract(epoch from clock_timestamp()))::bigint)
      on conflict do nothing;
    if found then queued := queued + 1; end if;
  end loop;
  return queued;
end $$;

-- Écrit la commune seulement si elle est encore vide et si le point n'a pas bougé :
-- une correction humaine ou un ré-enrichissement ne doivent jamais être écrasés.
create or replace function public.prospector_store_location(p_id uuid,p_city text,p_postal_code text,p_evidence jsonb) returns public.prospects
language plpgsql security definer set search_path = '' as $$
declare p public.prospects; result public.prospects;
begin
  perform public.prospector_require_worker();
  if coalesce(length(trim(p_city)),0) not between 1 and 200
    or jsonb_typeof(p_evidence) is distinct from 'object'
    or p_evidence->>'provider' is null
    or (p_evidence->>'code_insee') !~ '^[0-9A-Z]{5}$'
    or jsonb_typeof(p_evidence->'lat') is distinct from 'number'
    or jsonb_typeof(p_evidence->'lng') is distinct from 'number' then raise exception 'INVALID_LOCATION_RESULT'; end if;
  select * into strict p from public.prospects where id=p_id for update;
  if nullif(trim(p.city),'') is not null then raise exception 'LOCATION_ALREADY_SET'; end if;
  if p.lat is distinct from (p_evidence->>'lat')::double precision
    or p.lng is distinct from (p_evidence->>'lng')::double precision then raise exception 'LOCATION_COORDINATES_CHANGED'; end if;
  update public.prospects set city=trim(p_city),
    postal_code=coalesce(nullif(trim(postal_code),''), nullif(trim(p_postal_code),'')),
    location_checked_at=clock_timestamp()
    where id=p_id returning * into result;
  update public.prospect_sources set extracted=coalesce(extracted,'{}'::jsonb)||jsonb_build_object('location',p_evidence)
    where prospect_id=p_id and type='openstreetmap';
  insert into public.prospect_events(prospect_id,type,label,meta,actor)
    values(p_id,'location_resolved','Commune complétée : '||trim(p_city),p_evidence,'system');
  return result;
end $$;

-- Réponse définitive négative (hors France, en mer, limite ambiguë) : on l'horodate
-- pour ne plus jamais rappeler le service pour ce point.
create or replace function public.prospector_mark_location_unknown(p_id uuid,p_reason text) returns public.prospects
language plpgsql security definer set search_path = '' as $$
declare result public.prospects;
begin
  perform public.prospector_require_worker();
  update public.prospects set location_checked_at=clock_timestamp() where id=p_id returning * into result;
  if not found then raise exception 'PROSPECT_NOT_FOUND'; end if;
  insert into public.prospect_events(prospect_id,type,label,meta,actor)
    values(p_id,'location_unknown','Commune introuvable pour ce point',jsonb_build_object('reason',left(coalesce(p_reason,'unknown'),200)),'system');
  return result;
end $$;

-- Le worker se réapprovisionne tout seul quand il n'a plus rien à faire.
create or replace function public.prospector_claim_jobs(p_limit integer default 5, p_lease_seconds integer default 120)
returns setof public.prospect_jobs language plpgsql security definer set search_path = '' as $$
begin
  perform public.prospector_require_worker();
  if p_limit is null or p_limit not between 1 and 5 or p_lease_seconds is null or p_lease_seconds not between 30 and 300 then raise exception 'INVALID_CLAIM_LIMIT'; end if;
  update public.prospect_jobs j set status='error',error='PROSPECT_NOT_ANALYZABLE',claim_token=null,lease_until=null,updated_at=clock_timestamp()
    from public.prospects p where j.prospect_id=p.id and j.status in ('queued','running')
      and (p.is_client or p.deleted_at is not null or p.status in ('excluded','archived','lost') or public.prospector_is_blacklisted(p));
  update public.prospect_jobs set status=case when attempts>=max_attempts then 'error' else 'queued' end,
    error='LEASE_EXPIRED',claim_token=null,lease_until=null,run_after=clock_timestamp()+make_interval(mins=>attempts*2),updated_at=clock_timestamp()
    where status='running' and lease_until<clock_timestamp();
  -- Uniquement à vide : le rattrapage ne passe jamais devant du travail réel.
  if not exists(select 1 from public.prospect_jobs where status='queued' and run_after<=clock_timestamp()) then
    perform public.prospector_enqueue_locations(25);
  end if;
  return query with picked as (
    select j.id from public.prospect_jobs j where j.status='queued' and j.run_after<=clock_timestamp() and j.attempts<j.max_attempts
      and (j.type<>'discovery' or exists(select 1 from public.prospect_campaigns c where c.id=j.campaign_id and c.status='running'))
    order by j.run_after,j.created_at,j.id for update skip locked limit p_limit
  ) update public.prospect_jobs j set status='running',attempts=j.attempts+1,claim_token=gen_random_uuid(),
    lease_until=clock_timestamp()+make_interval(secs=>p_lease_seconds),updated_at=clock_timestamp()
    from picked where j.id=picked.id returning j.*;
end $$;

do $$ declare fn text; begin
  foreach fn in array array[
    'public.prospector_store_location(uuid,text,text,jsonb)',
    'public.prospector_mark_location_unknown(uuid,text)',
    'public.prospector_enqueue_locations(integer)',
    'public.prospector_claim_jobs(integer,integer)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
  execute 'grant execute on function public.prospector_enqueue_locations(integer) to authenticated';
end $$;

-- Erreurs de localisation : une panne du service se réessaie, une réponse
-- définitive ou une incohérence de données ne se réessaie pas.
create or replace function public.prospector_finish_job(p_id uuid, p_claim_token uuid, p_result jsonb default null, p_error text default null) returns public.prospect_jobs
language plpgsql security definer set search_path = '' as $$
declare result public.prospect_jobs; p public.prospects; terminal boolean;
begin
  perform public.prospector_require_worker();
  select * into strict result from public.prospect_jobs where id=p_id for update;
  if result.status<>'running' or result.claim_token is distinct from p_claim_token or result.lease_until<=clock_timestamp() then raise exception 'STALE_JOB_CLAIM'; end if;
  if result.prospect_id is not null then
    select * into p from public.prospects where id=result.prospect_id;
    if p.is_client or p.deleted_at is not null or p.status in ('excluded','archived','lost') or public.prospector_is_blacklisted(p) then p_error:='PROSPECT_NOT_ANALYZABLE'; end if;
  end if;
  terminal:=coalesce(p_error in (
    'PROSPECT_NOT_ANALYZABLE','NO_WEBSITE','INVALID_WEBSITE_URL','UNSAFE_WEBSITE_URL','UNSUPPORTED_CONTENT_TYPE',
    'EMPTY_ENRICHMENT_SOURCE','JOB_TYPE_NOT_IMPLEMENTED','DNS_VALIDATION_UNAVAILABLE',
    'CAMPAIGN_NOT_FOUND','SETTINGS_NOT_FOUND','REFERENCE_ADDRESS_NOT_FOUND','INVALID_DISCOVERY_CENTER',
    'INVALID_DISCOVERY_RADIUS','INVALID_DISCOVERY_CATEGORIES','INVALID_DISCOVERY_RESULT','INVALID_OVERPASS_RESPONSE',
    'MESSAGE_CONFLICT','LLM_NOT_CONFIGURED','LLM_INVALID_OUTPUT','LLM_TRUNCATED','LLM_REFUSAL','LLM_REQUEST_REJECTED',
    'NO_SOURCE_TO_ANALYZE','NO_AVAILABLE_CHANNEL','ANALYSIS_MISSING','STRATEGY_MISSING','NO_MESSAGE_VARIANT',
    'INVALID_ANALYSIS_RESULT','INVALID_STRATEGY_RESULT','INVALID_MESSAGE_RESULT','BUDGET_FX_NOT_CONFIGURED','MONTHLY_BUDGET_EXCEEDED','MODEL_PRICING_NOT_CONFIGURED','LLM_USAGE_RECORD_FAILED',
    'NO_COORDINATES','LOCATION_ALREADY_SET','LOCATION_COORDINATES_CHANGED','INVALID_LOCATION_RESULT','INVALID_LOCATION_RESPONSE','LOCATION_RESPONSE_TOO_LARGE'
  ),false);
  update public.prospect_jobs set status=case when p_error is null then 'done' when attempts<max_attempts and not terminal then 'queued' else 'error' end,
    result=case when p_error is null then p_result else null end,error=left(p_error,1000),
    run_after=case when p_error is not null and not terminal then clock_timestamp()+make_interval(mins=>attempts*2) else run_after end,
    claim_token=null,lease_until=null,updated_at=clock_timestamp() where id=p_id returning * into result;
  if result.type='discovery' and result.campaign_id is not null and result.status='error' then
    update public.prospect_campaigns set status='paused',
      stats=coalesce(stats,'{}'::jsonb)||jsonb_build_object('error',left(coalesce(p_error,'UNKNOWN'),300),'failed_at',clock_timestamp()),
      updated_at=clock_timestamp()
    where id=result.campaign_id and status='running';
  end if;
  return result;
end $$;
revoke all on function public.prospector_finish_job(uuid,uuid,jsonb,text) from public, anon, authenticated, service_role;
grant execute on function public.prospector_finish_job(uuid,uuid,jsonb,text) to service_role;
