create or replace function public.prospector_finish_job(p_id uuid,p_claim_token uuid,p_result jsonb default null,p_error text default null) returns public.prospect_jobs
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
    'LLM_NOT_CONFIGURED','LLM_INVALID_OUTPUT','LLM_TRUNCATED','LLM_REFUSAL','LLM_REQUEST_REJECTED',
    'NO_SOURCE_TO_ANALYZE','NO_AVAILABLE_CHANNEL','ANALYSIS_MISSING','STRATEGY_MISSING','NO_MESSAGE_VARIANT',
    'INVALID_ANALYSIS_RESULT','INVALID_STRATEGY_RESULT','INVALID_MESSAGE_RESULT','BUDGET_FX_NOT_CONFIGURED','MONTHLY_BUDGET_EXCEEDED','MODEL_PRICING_NOT_CONFIGURED','LLM_USAGE_RECORD_FAILED'
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