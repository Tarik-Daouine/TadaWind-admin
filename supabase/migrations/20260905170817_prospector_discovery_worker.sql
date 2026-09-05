-- L11 (suite) : exécution de la découverte par le worker.
-- - distance_km calculée par prospect à l'insertion (haversine depuis le centre de campagne)
-- - erreurs de configuration de découverte marquées terminales (pas de retry infini)
-- - campagne mise en pause + motif journalisé si la découverte échoue définitivement

create function public.prospector_haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns numeric language sql immutable set search_path = '' as $$
  select round((2 * 6371 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))))::numeric, 1);
$$;
revoke all on function public.prospector_haversine_km(double precision,double precision,double precision,double precision) from public,anon,authenticated,service_role;
grant execute on function public.prospector_haversine_km(double precision,double precision,double precision,double precision) to service_role;

create or replace function public.prospector_store_discovery(p_campaign_id uuid,p_candidates jsonb,p_report jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare campaign public.prospect_campaigns; candidate jsonb; prospect public.prospects;
  inserted_count integer:=0; skipped_count integer:=0; queued_count integer:=0; active_count integer;
  center_lat double precision; center_lng double precision; cand_distance numeric;
begin
  perform public.prospector_require_worker();
  if jsonb_typeof(p_candidates) is distinct from 'array' or jsonb_array_length(p_candidates)>50 or jsonb_typeof(p_report) is distinct from 'object' then raise exception 'INVALID_DISCOVERY_RESULT'; end if;
  select * into strict campaign from public.prospect_campaigns where id=p_campaign_id for update;

  -- Centre rapporté par le service de découverte (réglages ou géocodage). Toléré absent.
  begin
    center_lat := nullif(p_report#>>'{center,lat}','')::double precision;
    center_lng := nullif(p_report#>>'{center,lng}','')::double precision;
  exception when others then center_lat := null; center_lng := null;
  end;
  if center_lat is null or center_lng is null
    or center_lat not between -90 and 90 or center_lng not between -180 and 180 then
    center_lat := null; center_lng := null;
  end if;

  select count(*) into active_count from public.prospect_jobs where status in ('queued','running');
  for candidate in select value from jsonb_array_elements(p_candidates) loop
    begin
      if length(trim(coalesce(candidate->>'name',''))) not between 1 and 300
        or (candidate->>'lat')::double precision not between -90 and 90 or (candidate->>'lng')::double precision not between -180 and 180
        or coalesce(candidate->>'source_url','') !~ '^https://www\.openstreetmap\.org/(node|way|relation)/[0-9]+$'
        or length(trim(coalesce(candidate->>'source_excerpt','')))=0 then raise exception 'INVALID_DISCOVERY_CANDIDATE'; end if;
      cand_distance := case when center_lat is not null
        then public.prospector_haversine_km(center_lat,center_lng,(candidate->>'lat')::double precision,(candidate->>'lng')::double precision)
        else null end;
      insert into public.prospects(name,category,address,city,postal_code,lat,lng,distance_km,phone,email,website,campaign_id,data_origin)
        values(trim(candidate->>'name'),nullif(candidate->>'category',''),nullif(candidate->>'address',''),nullif(candidate->>'city',''),nullif(candidate->>'postal_code',''),
          (candidate->>'lat')::double precision,(candidate->>'lng')::double precision,cand_distance,nullif(candidate->>'phone',''),nullif(candidate->>'email',''),nullif(candidate->>'website',''),p_campaign_id,'openstreetmap')
        returning * into prospect;
      insert into public.prospect_sources(prospect_id,type,url,content_excerpt,extracted,confidence)
        values(prospect.id,'openstreetmap',candidate->>'source_url',left(candidate->>'source_excerpt',12000),candidate->'source_data',0.9);
      inserted_count:=inserted_count+1;
      if prospect.website is not null and active_count<50 then
        insert into public.prospect_jobs(type,prospect_id,payload,idempotency_key)
          values('enrich',prospect.id,jsonb_build_object('campaign_id',p_campaign_id),'enrich:'||prospect.id) on conflict(idempotency_key) do nothing;
        if found then queued_count:=queued_count+1;active_count:=active_count+1;end if;
      end if;
    exception when unique_violation then skipped_count:=skipped_count+1;
      when raise_exception then
        if sqlerrm in ('PROSPECT_COLLISION','PROSPECT_BLACKLISTED','INVALID_DISCOVERY_CANDIDATE','INVALID_CANONICAL_WEBSITE','INVALID_PHONE') then skipped_count:=skipped_count+1; else raise; end if;
    end;
  end loop;
  p_report:=p_report||jsonb_build_object('inserted',inserted_count,'skipped',skipped_count,'queued_for_enrichment',queued_count,
    'distance_computed',center_lat is not null,'completed_at',clock_timestamp());
  update public.prospect_campaigns set status='done',stats=p_report,updated_at=clock_timestamp() where id=p_campaign_id;
  return p_report;
end $$;
revoke all on function public.prospector_store_discovery(uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.prospector_store_discovery(uuid,jsonb,jsonb) to service_role;

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
    'INVALID_DISCOVERY_RADIUS','INVALID_DISCOVERY_CATEGORIES','INVALID_DISCOVERY_RESULT','INVALID_OVERPASS_RESPONSE'
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
revoke all on function public.prospector_finish_job(uuid,uuid,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.prospector_finish_job(uuid,uuid,jsonb,text) to service_role;
