-- L8-L10 : chaîne IA analyze -> score (SQL déterministe) -> strategize -> copywrite.
-- Contextes serveur (sources/analyse/stratégie rechargés en base), stockage atomique,
-- enchaînement du job suivant. Aucune sortie LLM persistée sans passage par les schémas Zod
-- (Edge Functions) puis les contrôles de preuve en base (prospector_validate_message).

-- ── Canaux réellement disponibles pour un prospect (réglages + coordonnées présentes) ──
create or replace function public.prospector_available_channels(p public.prospects) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare ch jsonb; out text[] := '{}'; rx text := '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';
begin
  select channels into ch from public.prospector_settings where id='main';
  if coalesce((ch->>'email')::boolean,false) and (coalesce(p.email,'') ~ rx or coalesce(p.contact_email,'') ~ rx or coalesce(p.email_commercial,'') ~ rx) then out := array_append(out,'email'); end if;
  if coalesce((ch->>'instagram')::boolean,false) and coalesce(length(trim(p.instagram)),0) > 0 then out := array_append(out,'instagram_dm'); end if;
  if coalesce((ch->>'linkedin')::boolean,false) and coalesce(length(trim(p.linkedin)),0) > 0 then out := array_append(out,'linkedin'); end if;
  if coalesce((ch->>'phone')::boolean,false) and (p.phone is not null or p.contact_phone is not null) then out := array_append(out,'phone'); end if;
  return out;
end $$;

-- ── Scoring déterministe (parité avec src/lib/prospector/scoring.js) ──
create or replace function public.prospector_apply_score(p_id uuid) returns public.prospects
language plpgsql security definer set search_path = '' as $$
declare
  p public.prospects; s public.prospector_settings; w jsonb; a jsonb; q jsonb;
  b jsonb := '{}'; reasons text[] := '{}'; excl text[] := '{}';
  total numeric := 0; val numeric; pts numeric; sig numeric := 0; contact numeric := 0;
  band jsonb; has_form boolean; prio text; k text; inp text; rx text := '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';
  qual_map jsonb := '{"fit_tada_wind":"fit_tada_wind","video_interest":"video_need","drone_interest":"drone_need","commercial_potential":"commercial_potential","digital_gap":"digital_gap"}';
  crit jsonb := '{"fit_tada_wind":"Adéquation Tada Wind","video_interest":"Intérêt vidéo","drone_interest":"Intérêt drone","commercial_potential":"Potentiel commercial","digital_gap":"Présence numérique perfectible","geo_access":"Accessibilité géographique","buying_signal":"Signal d''achat","contactability":"Facilité de contact"}';
begin
  perform public.prospector_require_worker();
  select * into strict p from public.prospects where id=p_id for update;
  select * into strict s from public.prospector_settings where id='main';
  w := s.scoring_weights;
  a := coalesce(p.analysis,'{}'::jsonb);
  q := coalesce(a->'qualitative_scores','{}'::jsonb);

  foreach k in array array['fit_tada_wind','video_interest','drone_interest','commercial_potential','digital_gap','geo_access','buying_signal','contactability'] loop
    b := b || jsonb_build_object(k, 0);
  end loop;

  if public.prospector_is_blacklisted(p) then excl := array_append(excl,'Entreprise sur liste d''exclusion'); end if;
  if p.is_client then excl := array_append(excl,'Entreprise déjà cliente'); end if;
  if p.distance_km is not null and p.distance_km > s.radius_max_km then
    excl := array_append(excl, 'Hors zone : '||p.distance_km||' km (maximum '||s.radius_max_km||' km)'); end if;
  if p.category is not null and (p.category = any(s.disabled_categories)
     or (cardinality(s.enabled_categories) > 0 and not (p.category = any(s.enabled_categories)))) then
    excl := array_append(excl,'Catégorie désactivée'); end if;

  if cardinality(excl) > 0 then
    update public.prospects set score=0, score_breakdown=b, score_reasons=excl, weights_version=(w->>'version'),
      priority='excluded', exclusion_reason=array_to_string(excl,' ; '),
      status = case when status in ('won','archived','lost','excluded') then status else 'excluded' end
    where id=p_id returning * into p;
    insert into public.prospect_events(prospect_id,type,label,meta,actor)
      values(p_id,'scored','Score : exclu',jsonb_build_object('priority','excluded','reasons',to_jsonb(excl)),'system');
    return p;
  end if;

  for k in select jsonb_object_keys(qual_map) loop
    inp := qual_map->>k;
    val := case when jsonb_typeof(q->inp)='number' then greatest(0, least(100, (q->>inp)::numeric)) else 0 end;
    pts := round(val * (w->>k)::numeric / 100, 2);
    b := jsonb_set(b, array[k], to_jsonb(pts));
    reasons := array_append(reasons, (crit->>k)||' : '||pts||'/'||(w->>k)||' ('||
      case when jsonb_typeof(q->inp)='number' then 'note '||val||'/100' else 'donnée inconnue' end||')');
  end loop;

  pts := 0;
  if p.distance_km is not null then
    for band in select value from jsonb_array_elements(s.distance_bands) loop
      if p.distance_km <= (band->>'max')::numeric then pts := (band->>'points')::numeric; exit; end if;
    end loop;
  end if;
  b := jsonb_set(b, '{geo_access}', to_jsonb(round(pts/5 * (w->>'geo_access')::numeric, 2)));
  reasons := array_append(reasons, 'Distance : '||coalesce(p.distance_km::text||' km','inconnue')||' → '||(b->>'geo_access')||'/'||(w->>'geo_access'));

  for band in select value from jsonb_array_elements(coalesce(a->'buying_signals','[]'::jsonb)) loop
    sig := greatest(sig, case band->>'weight' when 'fort' then 5 when 'moyen' then 3 when 'faible' then 1 else 0 end);
  end loop;
  b := jsonb_set(b, '{buying_signal}', to_jsonb(round(sig/5 * (w->>'buying_signal')::numeric, 2)));
  reasons := array_append(reasons, 'Signal d''achat : '||(case sig when 5 then 'fort' when 3 then 'moyen' when 1 then 'faible' else 'aucun renseigné' end)||' → '||(b->>'buying_signal')||'/'||(w->>'buying_signal'));

  select bool_or(coalesce((src.extracted->'website'->>'has_contact_form')::boolean,false)) into has_form
    from public.prospect_sources src where src.prospect_id=p_id;
  contact := case
    when coalesce(p.contact_email,'') ~ rx then 5
    when coalesce(p.email,'') ~ rx or coalesce(p.email_commercial,'') ~ rx then 3
    when coalesce(has_form,false) then 1 else 0 end;
  b := jsonb_set(b, '{contactability}', to_jsonb(round(contact/5 * (w->>'contactability')::numeric, 2)));
  reasons := array_append(reasons, 'Contact : '||(case contact when 5 then 'email direct' when 3 then 'email général' when 1 then 'formulaire seul' else 'aucun moyen renseigné' end)||' → '||(b->>'contactability')||'/'||(w->>'contactability'));

  select sum(value::numeric) into total from jsonb_each_text(b);
  total := least(100, greatest(0, round(total)));
  prio := case
    when total >= (s.priority_thresholds->>'hot')::numeric then 'hot'
    when total >= (s.priority_thresholds->>'good')::numeric then 'good'
    when total >= (s.priority_thresholds->>'consider')::numeric then 'consider'
    when total >= (s.priority_thresholds->>'low')::numeric then 'low'
    else 'excluded' end;

  update public.prospects set score=total::integer, score_breakdown=b, score_reasons=reasons,
    weights_version=(w->>'version'), priority=prio,
    weaknesses = coalesce((select array_agg(x) from jsonb_array_elements_text(a->'weaknesses') x),'{}'),
    opportunities = coalesce((select array_agg(x) from jsonb_array_elements_text(a->'opportunities') x),'{}'),
    summary = coalesce(nullif(a->>'summary',''), summary),
    status = case when status in ('new','to_analyze') then 'qualified' else status end
  where id=p_id returning * into p;
  insert into public.prospect_events(prospect_id,type,label,meta,actor)
    values(p_id,'scored','Score : '||total||'/100',jsonb_build_object('total',total,'priority',prio,'breakdown',b),'system');
  return p;
end $$;

-- ── Contextes serveur pour les Edge Functions IA (worker uniquement) ──
create or replace function public.prospector_analyze_context(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.prospector_settings; srcs jsonb;
begin
  perform public.prospector_require_worker();
  perform 1 from public.prospects where id=p_id;
  if not found then raise exception 'PROSPECT_NOT_FOUND'; end if;
  select * into strict s from public.prospector_settings where id='main';
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,'prospect_id',x.prospect_id,'type',x.type,'url',x.url,
    'fetched_at',x.fetched_at,'content_excerpt',x.content_excerpt,'extracted',x.extracted,'confidence',x.confidence
  ) order by x.confidence desc, x.fetched_at desc),'[]')
  into srcs
  from (select * from public.prospect_sources where prospect_id=p_id
        and coalesce(length(trim(content_excerpt)),0) > 0
        order by confidence desc, fetched_at desc limit 40) x;
  return jsonb_build_object('sources',srcs,'prospect_id',p_id,'model',s.ai_model_complex);
end $$;

create or replace function public.prospector_strategy_context(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.prospects; s public.prospector_settings;
begin
  perform public.prospector_require_worker();
  select * into strict p from public.prospects where id=p_id;
  select * into strict s from public.prospector_settings where id='main';
  return public.prospector_analyze_context(p_id) || jsonb_build_object(
    'analysis', p.analysis, 'strategy', p.strategy, 'business_profile', s.business_profile,
    'available_channels', to_jsonb(public.prospector_available_channels(p)),
    'tone', s.tone, 'model', s.ai_model_complex);
end $$;

create or replace function public.prospector_copywrite_context(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public.prospector_require_worker();
  return public.prospector_strategy_context(p_id);
end $$;

-- ── Enchaînement enrichissement -> analyse (avec pré-filtre distance) ──
create or replace function public.prospector_enqueue_analysis(p_id uuid) returns public.prospects
language plpgsql security definer set search_path = '' as $$
declare p public.prospects;
begin
  perform public.prospector_require_worker();
  select * into strict p from public.prospects where id=p_id for update;
  if p.deleted_at is not null or p.is_client or p.status in ('excluded','archived','lost','won') or public.prospector_is_blacklisted(p) then raise exception 'PROSPECT_NOT_ANALYZABLE'; end if;
  if not exists(select 1 from public.prospect_sources where prospect_id=p_id and coalesce(length(trim(content_excerpt)),0)>0) then raise exception 'NO_SOURCE_TO_ANALYZE'; end if;
  update public.prospects set status = case when status='new' then 'to_analyze' else status end where id=p_id returning * into p;
  insert into public.prospect_jobs(type,prospect_id,idempotency_key)
    values('analyze',p_id,'analyze:'||p_id||':'||floor(extract(epoch from clock_timestamp()))::bigint) on conflict do nothing;
  return p;
end $$;

create or replace function public.prospector_store_enrichment(p_id uuid,p_requested_url text,p_final_url text,p_content_hash text,p_result jsonb,p_expires_at timestamptz) returns public.prospects
language plpgsql security definer set search_path = '' as $$
declare p public.prospects; result public.prospects; src jsonb; website_data jsonb; socials jsonb; radius integer;
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

  select radius_max_km into radius from public.prospector_settings where id='main';
  if result.distance_km is not null and result.distance_km > radius then
    update public.prospects set status='excluded', exclusion_reason='Hors zone : '||result.distance_km||' km (maximum '||radius||' km)' where id=result.id returning * into result;
    insert into public.prospect_events(prospect_id,type,label,actor) values(result.id,'excluded','Hors zone de prospection','system');
    return result;
  end if;
  insert into public.prospect_jobs(type,prospect_id,idempotency_key)
    values('analyze',result.id,'analyze:'||result.id||':'||floor(extract(epoch from clock_timestamp()))::bigint) on conflict do nothing;
  return result;
end $$;

-- ── Stockage des sorties IA (validées Zod côté Edge) + étape suivante ──
create or replace function public.prospector_store_analysis(p_id uuid, p_analysis jsonb) returns public.prospects
language plpgsql security definer set search_path = '' as $$
declare p public.prospects; scored public.prospects;
begin
  perform public.prospector_require_worker();
  if jsonb_typeof(p_analysis) is distinct from 'object'
    or jsonb_typeof(p_analysis->'qualitative_scores') is distinct from 'object'
    or jsonb_typeof(p_analysis->'buying_signals') is distinct from 'array' then raise exception 'INVALID_ANALYSIS_RESULT'; end if;
  select * into strict p from public.prospects where id=p_id for update;
  if p.deleted_at is not null or p.is_client or p.status in ('excluded','archived','lost','won') or public.prospector_is_blacklisted(p) then raise exception 'PROSPECT_NOT_ANALYZABLE'; end if;
  update public.prospects set analysis=p_analysis, last_analyzed_at=clock_timestamp() where id=p_id;
  insert into public.prospect_events(prospect_id,type,label,actor) values(p_id,'analyzed','Analyse IA effectuée','system');
  select * into scored from public.prospector_apply_score(p_id);
  if scored.priority in ('hot','good','consider') and cardinality(public.prospector_available_channels(scored)) > 0 then
    insert into public.prospect_jobs(type,prospect_id,idempotency_key)
      values('strategize',p_id,'strategize:'||p_id||':'||floor(extract(epoch from clock_timestamp()))::bigint) on conflict do nothing;
  end if;
  return scored;
end $$;

create or replace function public.prospector_store_strategy(p_id uuid, p_strategy jsonb) returns public.prospects
language plpgsql security definer set search_path = '' as $$
declare p public.prospects;
begin
  perform public.prospector_require_worker();
  if jsonb_typeof(p_strategy) is distinct from 'object' or jsonb_typeof(p_strategy->'angles') is distinct from 'array'
    or jsonb_array_length(p_strategy->'angles') = 0 then raise exception 'INVALID_STRATEGY_RESULT'; end if;
  select * into strict p from public.prospects where id=p_id for update;
  if p.deleted_at is not null or p.is_client or p.status in ('excluded','archived','lost','won') or public.prospector_is_blacklisted(p) then raise exception 'PROSPECT_NOT_ANALYZABLE'; end if;
  if p.analysis is null then raise exception 'ANALYSIS_MISSING'; end if;
  update public.prospects set strategy=p_strategy where id=p_id returning * into p;
  insert into public.prospect_events(prospect_id,type,label,actor) values(p_id,'strategy_ready','Angles commerciaux préparés','system');
  insert into public.prospect_jobs(type,prospect_id,idempotency_key)
    values('copywrite',p_id,'copywrite:'||p_id||':'||floor(extract(epoch from clock_timestamp()))::bigint) on conflict do nothing;
  return p;
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
  delete from public.prospect_messages where prospect_id=p_id and kind='first_touch' and status <> 'sent';
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

-- ── Erreurs IA terminales : ne consomment pas les retries, marquées d'un motif clair ──
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
    'INVALID_ANALYSIS_RESULT','INVALID_STRATEGY_RESULT','INVALID_MESSAGE_RESULT'
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

-- ── Modèles IA par défaut : la chaîne s'active dès l'ajout de ANTHROPIC_API_KEY ──
alter table public.prospector_settings alter column ai_model_simple set default 'claude-haiku-4-5-20251001';
alter table public.prospector_settings alter column ai_model_complex set default 'claude-sonnet-5';
update public.prospector_settings set
  ai_model_simple = coalesce(ai_model_simple, 'claude-haiku-4-5-20251001'),
  ai_model_complex = coalesce(ai_model_complex, 'claude-sonnet-5')
where id='main';

-- ── Droits : worker uniquement ──
do $$ declare fn text; begin
  foreach fn in array array[
    'public.prospector_available_channels(public.prospects)',
    'public.prospector_apply_score(uuid)',
    'public.prospector_analyze_context(uuid)',
    'public.prospector_strategy_context(uuid)',
    'public.prospector_copywrite_context(uuid)',
    'public.prospector_enqueue_analysis(uuid)',
    'public.prospector_store_analysis(uuid,jsonb)',
    'public.prospector_store_strategy(uuid,jsonb)',
    'public.prospector_store_messages(uuid,jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;
