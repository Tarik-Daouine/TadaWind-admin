-- L11: user-started OpenStreetMap campaigns and service-only atomic storage.
create function public.prospector_start_campaign(p_name text,p_filters jsonb) returns public.prospect_campaigns
language plpgsql security definer set search_path = '' as $$
declare actor uuid:=public.prospector_require_user(); settings public.prospector_settings; result public.prospect_campaigns; categories text[]; radius numeric;
begin
  if length(trim(coalesce(p_name,''))) not between 1 and 300 or jsonb_typeof(p_filters) is distinct from 'object'
    or p_filters - array['categories','radius_km']::text[] <> '{}'::jsonb then raise exception 'INVALID_CAMPAIGN'; end if;
  select * into strict settings from public.prospector_settings where id='main';
  if jsonb_typeof(p_filters->'categories') is distinct from 'array' then raise exception 'INVALID_CAMPAIGN_CATEGORIES'; end if;
  select array_agg(distinct value) into categories from jsonb_array_elements_text(p_filters->'categories') value;
  if coalesce(cardinality(categories),0) not between 1 and 8 or categories <@ array['hotels','campsites','restaurants','tourism','events','real_estate','architecture','leisure'] is not true then raise exception 'INVALID_CAMPAIGN_CATEGORIES'; end if;
  radius:=coalesce((p_filters->>'radius_km')::numeric,settings.radius_preferred_km);
  if radius<1 or radius>settings.radius_max_km then raise exception 'INVALID_CAMPAIGN_RADIUS'; end if;
  if (select count(*) from public.prospect_jobs where status in ('queued','running'))>=50 then raise exception 'QUEUE_CAPACITY_REACHED'; end if;
  insert into public.prospect_campaigns(name,filters,status,stats)
    values(trim(p_name),jsonb_build_object('categories',to_jsonb(categories),'radius_km',radius),'running','{}') returning * into result;
  insert into public.prospect_jobs(type,campaign_id,idempotency_key) values('discovery',result.id,'discovery:'||result.id);
  return result;
end $$;

create function public.prospector_store_discovery(p_campaign_id uuid,p_candidates jsonb,p_report jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare campaign public.prospect_campaigns; candidate jsonb; prospect public.prospects; inserted_count integer:=0; skipped_count integer:=0; queued_count integer:=0; active_count integer;
begin
  perform public.prospector_require_worker();
  if jsonb_typeof(p_candidates) is distinct from 'array' or jsonb_array_length(p_candidates)>50 or jsonb_typeof(p_report) is distinct from 'object' then raise exception 'INVALID_DISCOVERY_RESULT'; end if;
  select * into strict campaign from public.prospect_campaigns where id=p_campaign_id for update;
  select count(*) into active_count from public.prospect_jobs where status in ('queued','running');
  for candidate in select value from jsonb_array_elements(p_candidates) loop
    begin
      if length(trim(coalesce(candidate->>'name',''))) not between 1 and 300
        or (candidate->>'lat')::double precision not between -90 and 90 or (candidate->>'lng')::double precision not between -180 and 180
        or coalesce(candidate->>'source_url','') !~ '^https://www\.openstreetmap\.org/(node|way|relation)/[0-9]+$'
        or length(trim(coalesce(candidate->>'source_excerpt','')))=0 then raise exception 'INVALID_DISCOVERY_CANDIDATE'; end if;
      insert into public.prospects(name,category,address,city,postal_code,lat,lng,phone,email,website,campaign_id,data_origin)
        values(trim(candidate->>'name'),nullif(candidate->>'category',''),nullif(candidate->>'address',''),nullif(candidate->>'city',''),nullif(candidate->>'postal_code',''),
          (candidate->>'lat')::double precision,(candidate->>'lng')::double precision,nullif(candidate->>'phone',''),nullif(candidate->>'email',''),nullif(candidate->>'website',''),p_campaign_id,'openstreetmap')
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
  p_report:=p_report||jsonb_build_object('inserted',inserted_count,'skipped',skipped_count,'queued_for_enrichment',queued_count,'completed_at',clock_timestamp());
  update public.prospect_campaigns set status='done',stats=p_report,updated_at=clock_timestamp() where id=p_campaign_id;
  return p_report;
end $$;

revoke all on function public.prospector_start_campaign(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.prospector_start_campaign(text,jsonb) to authenticated;
revoke all on function public.prospector_store_discovery(uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.prospector_store_discovery(uuid,jsonb,jsonb) to service_role;
