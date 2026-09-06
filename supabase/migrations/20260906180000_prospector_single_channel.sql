-- One generated channel per call. Preserve human work and other channels.
create or replace function public.prospector_copywrite_context(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public.prospector_require_worker();
  return public.prospector_strategy_context(p_id) || jsonb_build_object(
    'protected_channels',coalesce((select jsonb_agg(channel) from public.prospect_messages
      where prospect_id=p_id and kind='first_touch' and (status in ('edited','approved') or revision>1)),'[]'::jsonb),
    'first_touch_sent',exists(select 1 from public.prospect_messages where prospect_id=p_id and kind='first_touch' and status='sent'));
end $$;

create or replace function public.prospector_store_messages(p_id uuid, p_message jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.prospects; variants jsonb; ch text; msg_id uuid; inserted integer := 0;
  subj text; body_text text; used jsonb; grounding jsonb; ps jsonb;
begin
  perform public.prospector_require_worker();
  if jsonb_typeof(p_message) is distinct from 'object' or jsonb_typeof(p_message->'variants') is distinct from 'object' then raise exception 'INVALID_MESSAGE_RESULT'; end if;
  select * into strict p from public.prospects where id=p_id for update;
  if p.deleted_at is not null or p.is_client or p.status in ('excluded','archived','lost','won') or public.prospector_is_blacklisted(p) then raise exception 'PROSPECT_NOT_ANALYZABLE'; end if;
  if p.strategy is null then raise exception 'STRATEGY_MISSING'; end if;
  variants := p_message->'variants';
  if (select count(*) from jsonb_object_keys(variants)) <> 1 then raise exception 'INVALID_MESSAGE_RESULT'; end if;
  select key into ch from jsonb_object_keys(variants) as key;
  if ch not in ('email','instagram_dm','linkedin','phone_script') then raise exception 'INVALID_MESSAGE_RESULT'; end if;
  if not ((case when ch='phone_script' then 'phone' else ch end) = any(public.prospector_available_channels(p))) then raise exception 'NO_AVAILABLE_CHANNEL'; end if;
  -- Lock messages too: human review locks the message, independently of the prospect.
  perform 1 from public.prospect_messages where prospect_id=p_id and kind='first_touch' for update;
  if exists(select 1 from public.prospect_messages where prospect_id=p_id and kind='first_touch'
    and (status='sent' or (channel=ch and (status in ('edited','approved') or revision>1)))) then
    raise exception 'MESSAGE_CONFLICT';
  end if;
  delete from public.prospect_messages where prospect_id=p_id and kind='first_touch' and channel=ch and status in ('draft','rejected');
  foreach ch in array array['email','instagram_dm','linkedin','phone_script'] loop
    continue when not (variants ? ch);
    used := coalesce((select jsonb_agg(e) from jsonb_array_elements(coalesce(p_message->'sources_used','[]'::jsonb)) e where e->>'path' like ch||'.%'),'[]'::jsonb);
    grounding := coalesce((select jsonb_agg(e) from jsonb_array_elements(coalesce(p_message->'grounding','[]'::jsonb)) e where e->>'path' like ch||'.%'),'[]'::jsonb);
    if ch = 'phone_script' then
      ps := variants->'phone_script'; subj := null;
      body_text := concat_ws(E'\n\n', ps->>'opening', ps->>'reason', ps->>'proposal', ps->>'cta');
    else
      subj := case when ch='email' then variants->'email'->>'subject' else null end;
      body_text := variants->ch->>'body';
    end if;
    insert into public.prospect_messages(prospect_id,channel,kind,subject,body,sources_used,variables,generated_by,model)
      values(p_id, ch, 'first_touch', subj, body_text, used,
        jsonb_build_object('grounding',grounding,'tone_check',p_message->'tone_check','confidence',p_message->'confidence',
          'phone_script', case when ch='phone_script' then variants->'phone_script' else null end),
        'copywrite', p_message->>'model')
      returning id into msg_id;
    perform public.prospector_validate_message(msg_id, 1,
      public.prospector_source_hash((select m from public.prospect_messages m where m.id=msg_id)));
    inserted := inserted + 1;
  end loop;
  if inserted = 0 then raise exception 'NO_MESSAGE_VARIANT'; end if;
  update public.prospects set
    status = case when status in ('won','archived','lost','excluded') then status else 'to_validate' end,
    next_action = 'Valider le message de premier contact'
  where id=p_id;
  return jsonb_build_object('messages', inserted);
end $$;

create or replace function public.prospector_request_channel(p_id uuid, p_channel text) returns public.prospect_jobs
language plpgsql security definer set search_path = '' as $$
declare result public.prospect_jobs; p public.prospects; ch text;
begin
  perform public.prospector_require_user();
  perform pg_advisory_xact_lock(731905,2);
  select * into strict p from public.prospects where id=p_id;
  if p.deleted_at is not null or p.is_client or p.status in ('excluded','archived','lost','won') or public.prospector_is_blacklisted(p) then raise exception 'PROSPECT_NOT_ANALYZABLE'; end if;
  if p.analysis is null or p.strategy is null then raise exception 'STRATEGY_MISSING'; end if;
  ch := coalesce(p_channel, case when p.strategy->>'recommended_channel'='phone' then 'phone_script' else p.strategy->>'recommended_channel' end);
  if ch is null or ch not in ('email','instagram_dm','linkedin','phone_script') then raise exception 'NO_AVAILABLE_CHANNEL'; end if;
  if not ((case when ch='phone_script' then 'phone' else ch end) = any(public.prospector_available_channels(p))) then raise exception 'NO_AVAILABLE_CHANNEL'; end if;
  if exists(select 1 from public.prospect_messages where prospect_id=p_id and kind='first_touch'
    and (status='sent' or (channel=ch and (status in ('edited','approved') or revision>1)))) then raise exception 'MESSAGE_CONFLICT'; end if;
  select * into result from public.prospect_jobs where prospect_id=p_id and status in ('queued','running') order by created_at limit 1;
  if found then
    if result.type='copywrite' and coalesce(result.payload->>'channel',case when p.strategy->>'recommended_channel'='phone' then 'phone_script' else p.strategy->>'recommended_channel' end)=ch then return result; end if;
    raise exception 'PROSPECT_JOB_ACTIVE';
  end if;
  if (select count(*) from public.prospect_jobs where status in ('queued','running'))>=50 then raise exception 'QUEUE_CAPACITY_REACHED'; end if;
  insert into public.prospect_jobs(type,prospect_id,payload,idempotency_key)
    values('copywrite',p_id,jsonb_build_object('channel',ch),'copywrite:'||p_id||':'||floor(extract(epoch from clock_timestamp()))::bigint) returning * into result;
  return result;
end $$;


create or replace function public.prospector_request_regeneration(p_id uuid) returns public.prospect_jobs
language sql security definer set search_path = '' as $$
  select public.prospector_request_channel(p_id,null);
$$;
revoke all on function public.prospector_request_channel(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.prospector_request_channel(uuid,text) to authenticated;

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
    'MESSAGE_CONFLICT','LLM_NOT_CONFIGURED','LLM_INVALID_OUTPUT','LLM_TRUNCATED','LLM_REFUSAL','LLM_REQUEST_REJECTED',
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
