-- Tada Wind Prospector L0. PostgreSQL 17 / Supabase.
-- New objects only. No changes to projects/leads or existing auth configuration.
-- Apply once through the migration runner, in a transaction.

create function public.prospector_normalize_text(value text) returns text
language sql immutable set search_path = '' as $$
  select nullif(trim(regexp_replace(replace(replace(
    regexp_replace(normalize(lower(coalesce(value, '')), NFD), U&'[\0300-\036f]', '', 'g'),
    'œ','oe'),'æ','ae'), '[^a-z0-9]+',' ','g')), '');
$$;

create function public.prospector_normalize_name(value text) returns text
language plpgsql immutable set search_path = '' as $$
declare result text := lower(coalesce(value,'')); match text[];
begin
  for match in select regexp_matches(result, '\y((?:[a-z]\.){2,}(?:[a-z]\.?)?)', 'g') loop
    result := replace(result, match[1], replace(match[1],'.',''));
  end loop;
  result := public.prospector_normalize_text(result);
  return nullif(trim(regexp_replace(regexp_replace(result,
    '\y(sarl|sas|sasu|eurl|earl|scea|sci|sa|snc|selarl)\y','','g'), '\s+',' ','g')), '');
end $$;

create function public.prospector_normalize_phone(value text) returns text
language plpgsql immutable set search_path = '' as $$
declare result text := trim(coalesce(value,''));
begin
  if result = '' or result ~ '[^0-9+\s().-]' then return null; end if;
  result := regexp_replace(result,'^(\+33|0033)\s*\(0\)','+33');
  result := regexp_replace(result,'[\s().-]','','g');
  result := regexp_replace(result,'^00','+');
  if result ~ '^0[1-9][0-9]{8}$' then result := '+33' || substr(result,2); end if;
  if result like '+33%' then
    return case when result ~ '^\+33[1-9][0-9]{8}$' then result end;
  end if;
  return case when result ~ '^\+[1-9][0-9]{7,14}$' then result end;
end $$;

create function public.prospector_domain(value text) returns text
language plpgsql immutable set search_path = '' as $$
declare result text := lower(trim(coalesce(value,'')));
begin
  if result = '' then return null; end if;
  result := regexp_replace(result, '^(https?://|//)', '');
  result := split_part(split_part(split_part(result,'/',1),'?',1),'#',1);
  result := regexp_replace(result, ':[0-9]+$', '');
  result := regexp_replace(regexp_replace(result,'^www\.',''),'\.$','');
  if result !~ '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
    or length(result)>253 then return null; end if;
  return result;
end $$;

create table public.prospector_settings (
  id text primary key default 'main' check (id='main'),
  business_profile jsonb not null default '{"business":"Tada Wind","services":["vidéo promotionnelle","drone","immobilier","tourisme","événementiel","contenus réseaux sociaux","photo au sol"],"positioning":"prestations visuelles professionnelles, personnalisées et locales","targetCustomers":[],"preferredAreas":[],"portfolio":[],"contactInfo":{},"pitchNotes":""}',
  reference_address text not null default 'Sarlat-la-Canéda',
  reference_lat double precision check(reference_lat between -90 and 90),
  reference_lng double precision check(reference_lng between -180 and 180),
  radius_preferred_km integer not null default 40 check(radius_preferred_km>=0),
  radius_max_km integer not null default 100 check(radius_max_km>=radius_preferred_km and radius_max_km<=2000),
  min_score integer not null default 40 check(min_score between 0 and 100),
  priority_thresholds jsonb not null default '{"hot":80,"good":60,"consider":40,"low":20}',
  distance_bands jsonb not null default '[{"max":30,"points":5},{"max":60,"points":3},{"max":100,"points":1}]',
  enabled_categories text[] not null default '{}', disabled_categories text[] not null default '{}',
  followup_delays_days integer[] not null default '{3,7,14}',
  ai_model_simple text, ai_model_complex text, monthly_budget_usd numeric(10,2) check(monthly_budget_usd>0),
  tone text not null default 'naturel, humain, direct, sympathique, sobre',
  channels jsonb not null default '{"email":true,"instagram":true,"linkedin":true,"phone":true}',
  scoring_weights jsonb not null default '{"version":"2026-09-05","fit_tada_wind":25,"video_interest":20,"drone_interest":15,"commercial_potential":15,"digital_gap":10,"geo_access":5,"buying_signal":5,"contactability":5}',
  updated_at timestamptz not null default clock_timestamp(),
  check ((reference_lat is null) = (reference_lng is null)),
  check (not (enabled_categories && disabled_categories))
);

create table public.prospect_campaigns (
  id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 300),
  filters jsonb not null default '{}' check(jsonb_typeof(filters)='object'),
  status text not null default 'draft' check(status in ('draft','running','paused','done')),
  stats jsonb not null default '{}', notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  name text not null check(length(trim(name)) between 1 and 300),
  normalized_name text generated always as (public.prospector_normalize_name(name)) stored check(normalized_name is not null),
  category text, subcategory text, description text, address text, city text,
  normalized_city text generated always as (public.prospector_normalize_text(city)) stored,
  postal_code text, department text, region text, country text default 'France',
  lat double precision check(lat between -90 and 90), lng double precision check(lng between -180 and 180),
  phone text, email text, email_commercial text, contact_first_name text, contact_last_name text,
  contact_role text, contact_email text, contact_phone text,
  website text, website_domain text, instagram text, facebook text, linkedin text, tiktok text, youtube text,
  other_links jsonb not null default '[]', summary text,
  analysis jsonb check(analysis is null or jsonb_typeof(analysis)='object'),
  strategy jsonb check(strategy is null or jsonb_typeof(strategy)='object'),
  score integer check(score between 0 and 100), score_breakdown jsonb, score_reasons text[] not null default '{}',
  weights_version text, distance_km numeric check(distance_km>=0 and distance_km<>'NaN'::numeric),
  priority text check(priority in ('hot','good','consider','low','excluded')),
  weaknesses text[] not null default '{}', opportunities text[] not null default '{}',
  status text not null default 'new' check(status in ('new','to_analyze','qualified','to_validate','ready_to_contact','contacted','followup_1','followup_2','replied','interested','meeting','quote','won','lost','archived','excluded','low_priority')),
  owner text, discovered_at timestamptz not null default now(), last_analyzed_at timestamptz,
  last_contacted_at timestamptz, next_action text, next_action_at timestamptz, next_followup_at timestamptz,
  campaign_id uuid references public.prospect_campaigns(id) on delete set null,
  data_origin text, collected_at timestamptz not null default now(), last_verified_at timestamptz,
  tags text[] not null default '{}', dedupe_hash text, is_client boolean not null default false,
  exclusion_reason text, deleted_at timestamptz,
  check(score is null or (weights_version is not null and jsonb_typeof(score_breakdown)='object' and cardinality(score_reasons)>0))
);
create unique index prospects_domain_uniq on public.prospects(website_domain) where website_domain is not null and deleted_at is null;
create index prospects_phone_idx on public.prospects(phone);
create index prospects_name_city_idx on public.prospects(normalized_name, normalized_city);
create index prospects_dedupe_hash_idx on public.prospects(dedupe_hash);
create index prospects_status_idx on public.prospects(status);
create index prospects_priority_idx on public.prospects(priority);
create index prospects_campaign_idx on public.prospects(campaign_id);

create table public.prospect_sources (
  id uuid primary key default gen_random_uuid(), prospect_id uuid not null references public.prospects(id) on delete cascade,
  type text not null check(length(trim(type))>0), url text,
  fetched_at timestamptz not null default now(), content_excerpt text, extracted jsonb,
  confidence numeric(3,2) not null default 0.5 check(confidence between 0 and 1),
  check(url is null or url ~ '^https?://[^[:space:]@]+$')
);
create index prospect_sources_prospect_idx on public.prospect_sources(prospect_id);

create table public.prospect_events (
  id uuid primary key default gen_random_uuid(), prospect_id uuid not null references public.prospects(id) on delete cascade,
  created_at timestamptz not null default now(), type text not null, label text, meta jsonb,
  actor text not null default 'system' check(actor in ('system','user')), actor_id uuid
);
create index prospect_events_prospect_idx on public.prospect_events(prospect_id,created_at desc);

create table public.prospect_messages (
  id uuid primary key default gen_random_uuid(), prospect_id uuid not null references public.prospects(id) on delete cascade,
  channel text not null check(channel in ('email','instagram_dm','linkedin','phone_script')),
  kind text not null default 'first_touch' check(kind in ('first_touch','followup','reply_draft')),
  subject text, body text, variables jsonb not null default '{}' check(jsonb_typeof(variables)='object'),
  sources_used jsonb not null default '[]' check(jsonb_typeof(sources_used)='array'),
  status text not null default 'draft' check(status in ('draft','approved','edited','sent','rejected','regenerate_requested')),
  generated_by text, model text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  revision integer not null default 1 check(revision>0), validated_revision integer, validated_source_hash text,
  approved_at timestamptz, approved_by uuid, sent_at timestamptz, sent_by uuid,
  sent_channel_ref text, rejection_reason text,
  check((status in ('approved','sent')) = (approved_at is not null and approved_by is not null)),
  check((status='sent') = (sent_at is not null and sent_by is not null))
);
create index prospect_messages_prospect_idx on public.prospect_messages(prospect_id);
create index prospect_messages_validation_idx on public.prospect_messages(status,created_at) where status in ('draft','edited','approved');

create table public.prospect_jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null check(type in ('discovery','enrich','analyze','score','strategize','copywrite','crm_next','manual_analyze')),
  status text not null default 'queued' check(status in ('queued','running','done','error')),
  payload jsonb not null default '{}' check(jsonb_typeof(payload)='object'), result jsonb,
  attempts integer not null default 0 check(attempts>=0),
  max_attempts integer not null default 3 check(max_attempts between 1 and 5 and attempts<=max_attempts),
  run_after timestamptz not null default now(), error text,
  prospect_id uuid references public.prospects(id) on delete cascade,
  campaign_id uuid references public.prospect_campaigns(id) on delete cascade,
  idempotency_key text not null unique check(length(idempotency_key) between 1 and 300),
  claim_token uuid, lease_until timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check((status='running') = (claim_token is not null and lease_until is not null)),
  check((type='discovery' and campaign_id is not null) or (type<>'discovery' and prospect_id is not null))
);
create index prospect_jobs_pick_idx on public.prospect_jobs(status,run_after) where status='queued';
create index prospect_jobs_lease_idx on public.prospect_jobs(lease_until) where status='running';
create index prospect_jobs_prospect_idx on public.prospect_jobs(prospect_id);
create index prospect_jobs_campaign_idx on public.prospect_jobs(campaign_id);
create unique index prospect_jobs_active_idx on public.prospect_jobs(type,coalesce(prospect_id,campaign_id)) where status in ('queued','running');

create table public.prospect_blacklist (
  id uuid primary key default gen_random_uuid(), reason text, domain text, normalized_name text, phone text, email text,
  source text not null default 'manual' check(source in ('manual','opt_out','reply_negative')),
  created_by uuid, created_at timestamptz not null default now(),
  check(num_nonnulls(domain,normalized_name,phone,email)>0)
);
create index prospect_blacklist_domain_idx on public.prospect_blacklist(domain);
create index prospect_blacklist_name_idx on public.prospect_blacklist(normalized_name);
create index prospect_blacklist_phone_idx on public.prospect_blacklist(phone);
create index prospect_blacklist_email_idx on public.prospect_blacklist(email);

create table public.prospect_feedback (
  id uuid primary key default gen_random_uuid(), prospect_id uuid references public.prospects(id) on delete cascade,
  decision text not null check(decision in ('approved','rejected','later','blacklist')),
  reason text, note text, score_at_decision integer check(score_at_decision between 0 and 100),
  created_at timestamptz not null default now()
);
create index prospect_feedback_prospect_idx on public.prospect_feedback(prospect_id);
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
  function text not null, model text not null,
  prospect_id uuid references public.prospects(id) on delete set null,
  campaign_id uuid references public.prospect_campaigns(id) on delete set null,
  input_tokens integer not null default 0 check(input_tokens>=0), output_tokens integer not null default 0 check(output_tokens>=0),
  cost_estimate_usd numeric(10,4) not null default 0 check(cost_estimate_usd>=0 and cost_estimate_usd<>'NaN'::numeric)
);
create index ai_usage_created_idx on public.ai_usage(created_at desc);
create index ai_usage_prospect_idx on public.ai_usage(prospect_id);
create index ai_usage_campaign_idx on public.ai_usage(campaign_id);

-- Shared checks. Fixed search paths, fully qualified references and explicit grants below.
create function public.prospector_require_user() returns uuid language plpgsql stable set search_path = '' as $$
begin
  if auth.role() is distinct from 'authenticated' or auth.uid() is null then raise exception 'USER_ACTION_REQUIRED' using errcode='42501'; end if;
  return auth.uid();
end $$;
create function public.prospector_require_worker() returns void language plpgsql stable set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'WORKER_REQUIRED' using errcode='42501'; end if;
end $$;
create function public.prospector_is_blacklisted(p public.prospects) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.prospect_blacklist b where
    (b.domain is not null and b.domain=p.website_domain) or
    (b.phone is not null and b.phone in (p.phone,p.contact_phone)) or
    (b.normalized_name is not null and b.normalized_name=public.prospector_normalize_name(p.name)) or
    (b.email is not null and b.email in (p.email,p.contact_email,p.email_commercial)));
$$;

create function public.prospector_settings_guard() returns trigger language plpgsql set search_path = '' as $$
declare key text; total numeric := 0; previous numeric := 101; band jsonb; bound numeric := -1; point numeric; delay integer := 0;
begin
  if jsonb_typeof(new.business_profile) is distinct from 'object' or jsonb_typeof(new.business_profile->'services') is distinct from 'array'
    or jsonb_array_length(new.business_profile->'services')=0 or length(trim(new.tone))=0 then raise exception 'INVALID_PROFILE'; end if;
  if exists(select 1 from jsonb_array_elements(new.business_profile->'services') s where jsonb_typeof(s)<>'string' or length(trim(s#>>'{}'))=0) then raise exception 'INVALID_SERVICES'; end if;
  if jsonb_typeof(new.scoring_weights) is distinct from 'object' or coalesce(length(trim(new.scoring_weights->>'version')),0)=0 then raise exception 'INVALID_WEIGHTS'; end if;
  foreach key in array array['fit_tada_wind','video_interest','drone_interest','commercial_potential','digital_gap','geo_access','buying_signal','contactability'] loop
    if jsonb_typeof(new.scoring_weights->key) is distinct from 'number' then raise exception 'INVALID_WEIGHTS'; end if;
    point := (new.scoring_weights->>key)::numeric;
    if point<0 or point>100 then raise exception 'INVALID_WEIGHTS'; end if;
    total := total+point;
  end loop;
  if total<>100 then raise exception 'INVALID_WEIGHTS_TOTAL'; end if;
  if tg_op='UPDATE' and (new.scoring_weights-'version') is distinct from (old.scoring_weights-'version')
    and new.scoring_weights->>'version'=old.scoring_weights->>'version' then raise exception 'WEIGHTS_VERSION_REQUIRED'; end if;
  foreach key in array array['hot','good','consider','low'] loop
    if jsonb_typeof(new.priority_thresholds->key) is distinct from 'number' then raise exception 'INVALID_THRESHOLDS'; end if;
    point := (new.priority_thresholds->>key)::numeric;
    if point<0 or point>=previous then raise exception 'INVALID_THRESHOLDS'; end if;
    previous := point;
  end loop;
  if jsonb_typeof(new.distance_bands) is distinct from 'array' or jsonb_array_length(new.distance_bands)<>3 then raise exception 'INVALID_DISTANCE_BANDS'; end if;
  for band in select * from jsonb_array_elements(new.distance_bands) loop
    if jsonb_typeof(band->'max') is distinct from 'number' then raise exception 'INVALID_DISTANCE_BANDS'; end if;
    if (band->>'max')::numeric<=bound then raise exception 'INVALID_DISTANCE_BANDS'; end if;
    bound := (band->>'max')::numeric;
    if band ? 'points' and (jsonb_typeof(band->'points')<>'number' or (band->>'points')::numeric not between 0 and 5) then raise exception 'INVALID_DISTANCE_POINTS'; end if;
  end loop;
  foreach key in array array['email','instagram','linkedin','phone'] loop
    if jsonb_typeof(new.channels->key) is distinct from 'boolean' then raise exception 'INVALID_CHANNELS'; end if;
  end loop;
  if cardinality(new.followup_delays_days)>5 then raise exception 'INVALID_FOLLOWUP_DELAYS'; end if;
  foreach point in array new.followup_delays_days loop
    if point is null or point<=delay or point>365 then raise exception 'INVALID_FOLLOWUP_DELAYS'; end if;
    delay:=point;
  end loop;
  if array_position(new.enabled_categories,null) is not null or array_position(new.disabled_categories,null) is not null then raise exception 'INVALID_CATEGORIES'; end if;
  new.updated_at:=clock_timestamp(); return new;
end $$;
create trigger prospector_settings_guard before insert or update on public.prospector_settings for each row execute function public.prospector_settings_guard();
insert into public.prospector_settings(id) values('main');

create function public.prospector_prospect_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare conflicts uuid[];
begin
  -- Shared by every insertion path, including backend imports.
  perform pg_advisory_xact_lock(731905,1);
  new.name:=trim(new.name); new.phone:=public.prospector_normalize_phone(new.phone);
  new.contact_phone:=public.prospector_normalize_phone(new.contact_phone);
  new.city:=nullif(trim(new.city),'');
  new.email:=nullif(lower(trim(new.email)),''); new.contact_email:=nullif(lower(trim(new.contact_email)),'');
  new.email_commercial:=nullif(lower(trim(new.email_commercial)),'');
  new.website:=nullif(trim(new.website),'');
  if new.website is not null and new.website !~ '^https?://' then new.website:='https://'||new.website; end if;
  new.website_domain:=public.prospector_domain(new.website);
  if new.website is not null and (new.website_domain is null or new.website ~ '[@[:space:]]') then raise exception 'INVALID_CANONICAL_WEBSITE'; end if;
  if tg_op='INSERT' and public.prospector_is_blacklisted(new) then raise exception 'PROSPECT_BLACKLISTED'; end if;
  if new.deleted_at is null then
    select array_agg(p.id) into conflicts from public.prospects p where p.id<>new.id and p.deleted_at is null and (
      (new.website_domain is not null and p.website_domain=new.website_domain) or
      (new.phone is not null and p.phone=new.phone) or
      (public.prospector_normalize_name(new.name) is not null and public.prospector_normalize_text(new.city) is not null
        and p.normalized_name=public.prospector_normalize_name(new.name) and p.normalized_city=public.prospector_normalize_text(new.city)));
    if conflicts is not null then raise exception 'PROSPECT_COLLISION' using detail=array_to_string(conflicts,','); end if;
  end if;
  new.dedupe_hash:=case when new.website_domain is not null then 'domain:'||new.website_domain
    when new.phone is not null then 'phone:'||new.phone
    when public.prospector_normalize_name(new.name) is not null and public.prospector_normalize_text(new.city) is not null
      then 'name_city:['||to_json(public.prospector_normalize_name(new.name))::text||','||to_json(public.prospector_normalize_text(new.city))::text||']' end;
  new.updated_at:=clock_timestamp(); return new;
end $$;
create trigger prospector_prospect_guard before insert or update on public.prospects for each row execute function public.prospector_prospect_guard();

create function public.prospector_source_hash(p_message public.prospect_messages) returns text
language sql stable security definer set search_path = '' as $$
  select md5(coalesce(jsonb_agg(jsonb_build_object('id',s.id,'type',s.type,'url',s.url,
    'fetched_at',s.fetched_at,'content_excerpt',s.content_excerpt,'extracted',s.extracted) order by s.id)::text,'[]'))
  from public.prospect_sources s where s.prospect_id=p_message.prospect_id
    and exists(select 1 from jsonb_array_elements(p_message.sources_used) c where c->>'source_id'=s.id::text);
$$;

create function public.prospector_message_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare p public.prospects;
begin
  if tg_op='INSERT' then
    if new.status<>'draft' or new.approved_at is not null or new.sent_at is not null then raise exception 'INITIAL_MESSAGE_MUST_BE_DRAFT'; end if;
    new.revision:=1; new.validated_revision:=null; new.validated_source_hash:=null;
  else
    if old.status='sent' then raise exception 'SENT_MESSAGE_IMMUTABLE'; end if;
    if (new.id,new.prospect_id,new.channel,new.kind) is distinct from (old.id,old.prospect_id,old.channel,old.kind) then raise exception 'MESSAGE_IDENTITY_IMMUTABLE'; end if;
    if (new.subject,new.body,new.variables,new.sources_used) is distinct from (old.subject,old.body,old.variables,old.sources_used) then
      new.revision:=old.revision+1; new.validated_revision:=null; new.validated_source_hash:=null;
      new.approved_at:=null; new.approved_by:=null; new.status:='draft';
    else new.revision:=old.revision; end if;
    if new.status in ('approved','sent') and new.status is distinct from old.status then
      perform public.prospector_require_user();
      if new.status='approved' and old.status not in ('draft','edited') then raise exception 'INVALID_MESSAGE_TRANSITION'; end if;
      if new.status='sent' and old.status<>'approved' then raise exception 'APPROVAL_REQUIRED'; end if;
      select * into strict p from public.prospects where id=new.prospect_id for update;
      if p.deleted_at is not null or p.is_client or p.status in ('excluded','archived','lost') or public.prospector_is_blacklisted(p) then raise exception 'PROSPECT_NOT_CONTACTABLE'; end if;
      if new.validated_revision is distinct from new.revision or new.validated_source_hash is distinct from public.prospector_source_hash(new) then raise exception 'MESSAGE_VALIDATION_REQUIRED'; end if;
      if new.status='approved' then new.approved_at:=clock_timestamp(); new.approved_by:=auth.uid();
      else new.sent_at:=clock_timestamp(); new.sent_by:=auth.uid(); end if;
    end if;
  end if;
  if new.status not in ('approved','sent') then new.approved_at:=null; new.approved_by:=null; end if;
  if new.status<>'sent' then new.sent_at:=null; new.sent_by:=null; end if;
  new.updated_at:=clock_timestamp(); return new;
end $$;
create trigger prospector_message_guard before insert or update on public.prospect_messages for each row execute function public.prospector_message_guard();

create function public.prospector_message_event() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' or new.status is distinct from old.status or new.revision is distinct from old.revision then
    insert into public.prospect_events(prospect_id,type,label,meta,actor,actor_id) values(new.prospect_id,
      case when tg_op='INSERT' then 'message_generated' when new.status='sent' then 'contacted'
        when new.status='approved' then 'message_approved' when new.revision<>old.revision then 'message_edited' else 'message_reviewed' end,
      'Message : '||new.status,jsonb_build_object('message_id',new.id,'revision',new.revision,'status',new.status),
      case when auth.role()='authenticated' then 'user' else 'system' end,auth.uid());
  end if;
  return new;
end $$;
create trigger prospector_message_event after insert or update on public.prospect_messages for each row execute function public.prospector_message_event();

create function public.prospector_save_settings(p_settings jsonb,p_expected_updated_at timestamptz) returns public.prospector_settings
language plpgsql security definer set search_path = '' as $$
declare result public.prospector_settings; merged public.prospector_settings;
begin
  perform public.prospector_require_user();
  if jsonb_typeof(p_settings) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_settings) k where k not in
    ('business_profile','reference_address','reference_lat','reference_lng','radius_preferred_km','radius_max_km','min_score','priority_thresholds','distance_bands','enabled_categories','disabled_categories','followup_delays_days','ai_model_simple','ai_model_complex','monthly_budget_usd','tone','channels','scoring_weights')) then raise exception 'INVALID_SETTINGS_FIELDS'; end if;
  select * into strict result from public.prospector_settings where id='main' for update;
  if result.updated_at is distinct from p_expected_updated_at then raise exception 'SETTINGS_CONFLICT'; end if;
  merged:=jsonb_populate_record(result,p_settings);
  update public.prospector_settings set business_profile=merged.business_profile,reference_address=merged.reference_address,
    reference_lat=merged.reference_lat,reference_lng=merged.reference_lng,radius_preferred_km=merged.radius_preferred_km,radius_max_km=merged.radius_max_km,
    min_score=merged.min_score,priority_thresholds=merged.priority_thresholds,distance_bands=merged.distance_bands,
    enabled_categories=merged.enabled_categories,disabled_categories=merged.disabled_categories,followup_delays_days=merged.followup_delays_days,
    ai_model_simple=merged.ai_model_simple,ai_model_complex=merged.ai_model_complex,monthly_budget_usd=merged.monthly_budget_usd,
    tone=merged.tone,channels=merged.channels,scoring_weights=merged.scoring_weights where id='main' returning * into result;
  return result;
end $$;

create function public.prospector_create_prospect(p_input jsonb) returns public.prospects
language plpgsql security definer set search_path = '' as $$
declare fields public.prospects; result public.prospects; actor uuid:=public.prospector_require_user();
begin
  if jsonb_typeof(p_input) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_input) k where k not in
    ('name','category','address','city','postal_code','website','phone','email','contact_email','instagram','facebook','linkedin','description')) then raise exception 'INVALID_PROSPECT_FIELDS'; end if;
  fields:=jsonb_populate_record(null::public.prospects,p_input);
  insert into public.prospects(name,category,address,city,postal_code,website,phone,email,contact_email,instagram,facebook,linkedin,description,data_origin)
    values(fields.name,fields.category,fields.address,fields.city,fields.postal_code,fields.website,fields.phone,fields.email,fields.contact_email,
      fields.instagram,fields.facebook,fields.linkedin,fields.description,'manual') returning * into result;
  insert into public.prospect_events(prospect_id,type,label,actor,actor_id) values(result.id,'discovered','Prospect ajouté manuellement','user',actor);
  return result;
end $$;

create function public.prospector_message_context(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare message public.prospect_messages; sources jsonb;
begin
  perform public.prospector_require_worker();
  select * into strict message from public.prospect_messages where id=p_id;
  select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]') into sources from public.prospect_sources s where s.prospect_id=message.prospect_id
    and exists(select 1 from jsonb_array_elements(message.sources_used) c where c->>'source_id'=s.id::text);
  return jsonb_build_object('message',to_jsonb(message),'sources',sources,'source_hash',public.prospector_source_hash(message));
end $$;

create function public.prospector_validate_message(p_id uuid,p_revision integer,p_source_hash text) returns public.prospect_messages
language plpgsql security definer set search_path = '' as $$
declare message public.prospect_messages; citation jsonb; source public.prospect_sources;
begin
  perform public.prospector_require_worker();
  select * into strict message from public.prospect_messages where id=p_id for update;
  if message.status not in ('draft','edited') or message.revision is distinct from p_revision then raise exception 'MESSAGE_CONFLICT'; end if;
  if public.prospector_source_hash(message) is distinct from p_source_hash then raise exception 'SOURCE_CONFLICT'; end if;
  if jsonb_array_length(message.sources_used)=0 or coalesce(length(trim(message.body)),0)=0 then raise exception 'MESSAGE_EVIDENCE_REQUIRED'; end if;
  for citation in select * from jsonb_array_elements(message.sources_used) loop
    select * into source from public.prospect_sources where id::text=citation->>'source_id' and prospect_id=message.prospect_id;
    if not found or source.type is distinct from citation->>'type' or source.url is distinct from citation->>'url'
      or coalesce(length(trim(citation->>'evidence_quote')),0)=0 or position(citation->>'evidence_quote' in coalesce(source.content_excerpt,''))=0
      or coalesce(length(trim(citation->>'claim')),0)=0 then raise exception 'INVALID_MESSAGE_EVIDENCE'; end if;
  end loop;
  -- Full Zod/grounding validation is required in the Edge Function before this worker-only RPC.
  update public.prospect_messages set validated_revision=revision,validated_source_hash=p_source_hash where id=p_id returning * into message;
  return message;
end $$;

create function public.prospector_review_message(p_id uuid,p_action text,p_expected_revision integer,p_patch jsonb default '{}',p_reason text default null) returns public.prospect_messages
language plpgsql security definer set search_path = '' as $$
declare message public.prospect_messages; actor uuid:=public.prospector_require_user();
begin
  perform pg_advisory_xact_lock(731905,1);
  select * into strict message from public.prospect_messages where id=p_id for update;
  if message.revision is distinct from p_expected_revision or message.status='sent' then raise exception 'MESSAGE_CONFLICT'; end if;
  if p_action='approve' then update public.prospect_messages set status='approved' where id=p_id returning * into message;
  elsif p_action='edit' then
    if jsonb_typeof(p_patch) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('subject','body','variables','sources_used')) then raise exception 'INVALID_MESSAGE_PATCH'; end if;
    update public.prospect_messages set subject=case when p_patch?'subject' then p_patch->>'subject' else subject end,
      body=case when p_patch?'body' then p_patch->>'body' else body end,
      variables=case when p_patch?'variables' then p_patch->'variables' else variables end,
      sources_used=case when p_patch?'sources_used' then p_patch->'sources_used' else sources_used end where id=p_id returning * into message;
  elsif p_action='reject' then update public.prospect_messages set status='rejected',rejection_reason=p_reason where id=p_id returning * into message;
  elsif p_action<>'later' or p_action is null then raise exception 'INVALID_REVIEW_ACTION'; end if;
  if p_action<>'edit' then insert into public.prospect_feedback(prospect_id,decision,reason,score_at_decision)
    select message.prospect_id,case p_action when 'approve' then 'approved' when 'reject' then 'rejected' else 'later' end,p_reason,score from public.prospects where id=message.prospect_id; end if;
  return message;
end $$;

create function public.prospector_confirm_message_sent(p_id uuid,p_expected_revision integer,p_reference text default null) returns public.prospect_messages
language plpgsql security definer set search_path = '' as $$
declare message public.prospect_messages;
begin
  perform public.prospector_require_user();
  perform pg_advisory_xact_lock(731905,1);
  select * into strict message from public.prospect_messages where id=p_id for update;
  if message.revision is distinct from p_expected_revision or message.status<>'approved' then raise exception 'APPROVAL_REQUIRED'; end if;
  update public.prospect_messages set status='sent',sent_channel_ref=p_reference where id=p_id returning * into message;
  update public.prospects set status='contacted',last_contacted_at=clock_timestamp() where id=message.prospect_id;
  return message;
end $$;

create function public.prospector_blacklist_prospect(p_id uuid,p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.prospects; actor uuid:=public.prospector_require_user();
begin
  perform pg_advisory_xact_lock(731905,1);
  select * into strict p from public.prospects where id=p_id for update;
  if coalesce(length(trim(p_reason)),0)=0 then raise exception 'BLACKLIST_REASON_REQUIRED'; end if;
  if not public.prospector_is_blacklisted(p) then
    insert into public.prospect_blacklist(reason,domain,normalized_name,phone,email,created_by)
      values(p_reason,p.website_domain,p.normalized_name,p.phone,p.email,actor);
  end if;
  update public.prospects set status='excluded',exclusion_reason=p_reason,next_action_at=null,next_followup_at=null where id=p_id;
  update public.prospect_messages set status='rejected',rejection_reason=p_reason where prospect_id=p_id and status<>'sent';
  update public.prospect_jobs set status='error',error='PROSPECT_BLACKLISTED',claim_token=null,lease_until=null,updated_at=clock_timestamp() where prospect_id=p_id and status in ('queued','running');
  insert into public.prospect_events(prospect_id,type,label,actor,actor_id) values(p_id,'excluded',p_reason,'user',actor);
end $$;

create function public.prospector_delete_prospect(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.prospector_require_user();
  delete from public.prospects where id=p_id;
  if not found then raise exception 'PROSPECT_NOT_FOUND'; end if;
end $$;

create function public.prospector_enqueue_job(p_type text,p_prospect_id uuid,p_campaign_id uuid,p_key text,p_payload jsonb default '{}') returns public.prospect_jobs
language plpgsql security definer set search_path = '' as $$
declare result public.prospect_jobs; p public.prospects;
begin
  perform public.prospector_require_worker();
  perform pg_advisory_xact_lock(731905,2);
  if p_prospect_id is not null then
    select * into strict p from public.prospects where id=p_prospect_id;
    if p.deleted_at is not null or p.is_client or p.status in ('excluded','archived','lost') or public.prospector_is_blacklisted(p) then raise exception 'PROSPECT_NOT_ANALYZABLE'; end if;
  end if;
  select * into result from public.prospect_jobs where idempotency_key=p_key;
  if found then
    if (result.type,result.prospect_id,result.campaign_id,result.payload) is distinct from (p_type,p_prospect_id,p_campaign_id,p_payload) then raise exception 'IDEMPOTENCY_KEY_CONFLICT'; end if;
    return result;
  end if;
  select * into result from public.prospect_jobs where type=p_type and coalesce(prospect_id,campaign_id)=coalesce(p_prospect_id,p_campaign_id) and status in ('queued','running');
  if found then return result; end if;
  insert into public.prospect_jobs(type,prospect_id,campaign_id,idempotency_key,payload) values(p_type,p_prospect_id,p_campaign_id,p_key,p_payload) returning * into result;
  return result;
end $$;

create function public.prospector_request_analysis(p_id uuid) returns public.prospect_jobs
language plpgsql security definer set search_path = '' as $$
declare result public.prospect_jobs; p public.prospects;
begin
  perform public.prospector_require_user();
  perform pg_advisory_xact_lock(731905,2);
  select * into strict p from public.prospects where id=p_id;
  if p.deleted_at is not null or p.is_client or p.status in ('excluded','archived','lost') or public.prospector_is_blacklisted(p) then raise exception 'PROSPECT_NOT_ANALYZABLE'; end if;
  select * into result from public.prospect_jobs where prospect_id=p_id and status in ('queued','running') order by created_at limit 1;
  if found then return result; end if;
  if (select count(*) from public.prospect_jobs where status in ('queued','running'))>=50 then raise exception 'QUEUE_CAPACITY_REACHED'; end if;
  insert into public.prospect_jobs(type,prospect_id,idempotency_key) values('manual_analyze',p_id,'manual:'||gen_random_uuid()) returning * into result;
  return result;
end $$;

create function public.prospector_claim_jobs(p_limit integer default 5,p_lease_seconds integer default 120) returns setof public.prospect_jobs
language plpgsql security definer set search_path = '' as $$
begin
  perform public.prospector_require_worker();
  if p_limit is null or p_limit not between 1 and 5 or p_lease_seconds is null or p_lease_seconds not between 30 and 300 then raise exception 'INVALID_CLAIM_LIMIT'; end if;
  update public.prospect_jobs j set status='error',error='PROSPECT_NOT_ANALYZABLE',claim_token=null,lease_until=null,updated_at=clock_timestamp()
    from public.prospects p where j.prospect_id=p.id and j.status in ('queued','running')
      and (p.is_client or p.deleted_at is not null or p.status in ('excluded','archived','lost') or public.prospector_is_blacklisted(p));
  update public.prospect_jobs set status=case when attempts>=max_attempts then 'error' else 'queued' end,
    error='LEASE_EXPIRED',claim_token=null,lease_until=null,run_after=clock_timestamp()+make_interval(mins=>attempts*2),updated_at=clock_timestamp()
    where status='running' and lease_until<clock_timestamp();
  return query with picked as (
    select j.id from public.prospect_jobs j where j.status='queued' and j.run_after<=clock_timestamp() and j.attempts<j.max_attempts
      and (j.type<>'discovery' or exists(select 1 from public.prospect_campaigns c where c.id=j.campaign_id and c.status='running'))
    order by j.run_after,j.created_at,j.id for update skip locked limit p_limit
  ) update public.prospect_jobs j set status='running',attempts=j.attempts+1,claim_token=gen_random_uuid(),
    lease_until=clock_timestamp()+make_interval(secs=>p_lease_seconds),updated_at=clock_timestamp()
    from picked where j.id=picked.id returning j.*;
end $$;

create function public.prospector_finish_job(p_id uuid,p_claim_token uuid,p_result jsonb default null,p_error text default null) returns public.prospect_jobs
language plpgsql security definer set search_path = '' as $$
declare result public.prospect_jobs; p public.prospects;
begin
  perform public.prospector_require_worker();
  select * into strict result from public.prospect_jobs where id=p_id for update;
  if result.status<>'running' or result.claim_token is distinct from p_claim_token or result.lease_until<=clock_timestamp() then raise exception 'STALE_JOB_CLAIM'; end if;
  if result.prospect_id is not null then
    select * into p from public.prospects where id=result.prospect_id;
    if p.is_client or p.deleted_at is not null or p.status in ('excluded','archived','lost') or public.prospector_is_blacklisted(p) then p_error:='PROSPECT_NOT_ANALYZABLE'; end if;
  end if;
  update public.prospect_jobs set status=case when p_error is null then 'done' when attempts<max_attempts and p_error<>'PROSPECT_NOT_ANALYZABLE' then 'queued' else 'error' end,
    result=case when p_error is null then p_result else null end,error=left(p_error,1000),
    run_after=case when p_error is not null then clock_timestamp()+make_interval(mins=>attempts*2) else run_after end,
    claim_token=null,lease_until=null,updated_at=clock_timestamp() where id=p_id returning * into result;
  return result;
end $$;

-- Read-only browser access. No default PUBLIC/anon privileges, even on RPCs.
do $$ declare t text; fn record; begin
  foreach t in array array['prospector_settings','prospect_campaigns','prospects','prospect_sources','prospect_events','prospect_messages','prospect_jobs','prospect_blacklist','prospect_feedback','ai_usage'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role',t);
    execute format('grant select on table public.%I to authenticated, service_role',t);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) is not null)',t||'_read',t);
  end loop;
  foreach t in array array['prospects','prospect_campaigns','prospect_sources','prospect_messages','ai_usage'] loop
    execute format('grant insert, update, delete on table public.%I to service_role',t);
  end loop;
  for fn in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'prospector\_%' escape '\' loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role',fn.signature);
  end loop;
end $$;
grant execute on function public.prospector_save_settings(jsonb,timestamptz),public.prospector_create_prospect(jsonb),
  public.prospector_review_message(uuid,text,integer,jsonb,text),public.prospector_confirm_message_sent(uuid,integer,text),
  public.prospector_blacklist_prospect(uuid,text),public.prospector_delete_prospect(uuid),public.prospector_request_analysis(uuid) to authenticated;
grant execute on function public.prospector_message_context(uuid),public.prospector_validate_message(uuid,integer,text),
  public.prospector_enqueue_job(text,uuid,uuid,text,jsonb),public.prospector_claim_jobs(integer,integer),
  public.prospector_finish_job(uuid,uuid,jsonb,text) to service_role;
-- Generated-column expressions need execute permission for backend inserts.
grant execute on function public.prospector_normalize_text(text),public.prospector_normalize_name(text),public.prospector_normalize_phone(text),public.prospector_domain(text) to service_role;
