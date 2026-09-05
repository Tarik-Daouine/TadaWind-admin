-- L6-L7: enrichment cache and atomic storage boundary for the worker.
alter table public.prospect_sources add column content_hash text check(content_hash is null or content_hash ~ '^[a-f0-9]{64}$');
create unique index prospect_sources_content_uniq on public.prospect_sources(prospect_id,url,content_hash) where content_hash is not null;

create table public.prospect_web_cache (
  url text primary key check(url ~ '^https?://[^[:space:]@]+$'),
  final_url text not null check(final_url ~ '^https?://[^[:space:]@]+$'),
  content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
  result jsonb not null check(jsonb_typeof(result)='object'),
  fetched_at timestamptz not null default now(), expires_at timestamptz not null,
  check(expires_at>fetched_at)
);
create index prospect_web_cache_expiry_idx on public.prospect_web_cache(expires_at);
alter table public.prospect_web_cache enable row level security;
revoke all on table public.prospect_web_cache from public,anon,authenticated,service_role;
grant select,insert,update,delete on table public.prospect_web_cache to service_role;

create function public.prospector_manual_source() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.data_origin='manual' and coalesce(length(trim(new.description)),0)>0 then
    insert into public.prospect_sources(prospect_id,type,content_excerpt,extracted,confidence)
      values(new.id,'manual',left(new.description,12000),jsonb_build_object('field','description'),1);
  end if;
  return new;
end $$;
create trigger prospector_manual_source after insert on public.prospects for each row execute function public.prospector_manual_source();

create function public.prospector_store_enrichment(p_id uuid,p_requested_url text,p_final_url text,p_content_hash text,p_result jsonb,p_expires_at timestamptz) returns public.prospects
language plpgsql security definer set search_path = '' as $$
declare p public.prospects; result public.prospects; src jsonb; website_data jsonb; socials jsonb;
begin
  perform public.prospector_require_worker();
  if p_requested_url !~ '^https?://[^[:space:]@]+$' or p_final_url !~ '^https?://[^[:space:]@]+$'
    or p_content_hash !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_result) is distinct from 'object'
    or jsonb_typeof(p_result->'website') is distinct from 'object' or jsonb_typeof(p_result->'socials') is distinct from 'object'
    or p_expires_at<=clock_timestamp() then raise exception 'INVALID_ENRICHMENT_RESULT'; end if;
  select * into strict p from public.prospects where id=p_id for update;
  if p.deleted_at is not null or p.is_client or p.status in ('excluded','archived','lost') or public.prospector_is_blacklisted(p) then raise exception 'PROSPECT_NOT_ANALYZABLE'; end if;
  src:=p_result->'sources'->0; website_data:=p_result->'website'; socials:=p_result->'socials';
  if coalesce(length(src->>'content_excerpt'),0)=0 then raise exception 'EMPTY_ENRICHMENT_SOURCE'; end if;
  insert into public.prospect_web_cache(url,final_url,content_hash,result,expires_at)
    values(p_requested_url,p_final_url,p_content_hash,p_result,p_expires_at)
    on conflict(url) do update set final_url=excluded.final_url,content_hash=excluded.content_hash,result=excluded.result,fetched_at=clock_timestamp(),expires_at=excluded.expires_at;
  insert into public.prospect_sources(prospect_id,type,url,content_excerpt,extracted,confidence,content_hash)
    values(p_id,'website_page',p_final_url,left(src->>'content_excerpt',12000),p_result,0.7,p_content_hash)
    on conflict(prospect_id,url,content_hash) where content_hash is not null do update set fetched_at=clock_timestamp(),extracted=excluded.extracted;
  update public.prospects set
    website=coalesce(website,p_final_url),
    instagram=coalesce(instagram,socials->'instagram'->>0),facebook=coalesce(facebook,socials->'facebook'->>0),
    linkedin=coalesce(linkedin,socials->'linkedin'->>0),tiktok=coalesce(tiktok,socials->'tiktok'->>0),youtube=coalesce(youtube,socials->'youtube'->>0),
    email=coalesce(email,website_data->'emails'->>0),phone=coalesce(phone,website_data->'phones'->>0),
    status=case when status='new' then 'to_analyze' else status end,last_verified_at=clock_timestamp()
    where id=p_id returning * into result;
  insert into public.prospect_events(prospect_id,type,label,meta,actor) values(p_id,'enriched','Site web enrichi',jsonb_build_object('url',p_final_url,'content_hash',p_content_hash),'system');
  return result;
end $$;

revoke all on function public.prospector_store_enrichment(uuid,text,text,text,jsonb,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.prospector_store_enrichment(uuid,text,text,text,jsonb,timestamptz) to service_role;
revoke all on function public.prospector_manual_source() from public,anon,authenticated,service_role;
