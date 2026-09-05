-- L13 : ce dont la file « À valider » a besoin côté base.
--
-- 1. prospector_review_message / action 'edit' : le garde-fou remet la révision à
--    l'état non validé (c'est voulu : une sortie IA modifiée n'est plus la sortie IA).
--    Mais seul le worker pouvait revalider, donc un message édité ne pouvait plus être
--    approuvé. Ici l'humain devient l'auteur de la révision : on ne conserve que les
--    citations dont le constat figure encore littéralement dans le texte, on revérifie
--    chacune contre sa source, puis on retamponne la traçabilité.
-- 2. prospector_reject_prospect : écarter un prospect (sort de la file, motif conservé).
-- 3. prospector_request_regeneration : redemander une rédaction sans relancer l'analyse.

create or replace function public.prospector_review_message(p_id uuid,p_action text,p_expected_revision integer,p_patch jsonb default '{}',p_reason text default null) returns public.prospect_messages
language plpgsql security definer set search_path = '' as $$
declare message public.prospect_messages; actor uuid:=public.prospector_require_user();
  v_subject text; v_body text; v_used jsonb; v_hay text; v_rev integer;
  citation jsonb; source public.prospect_sources;
begin
  perform pg_advisory_xact_lock(731905,1);
  select * into strict message from public.prospect_messages where id=p_id for update;
  if message.revision is distinct from p_expected_revision or message.status='sent' then raise exception 'MESSAGE_CONFLICT'; end if;

  if p_action='approve' then
    update public.prospect_messages set status='approved' where id=p_id returning * into message;

  elsif p_action='edit' then
    if jsonb_typeof(p_patch) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('subject','body','variables','sources_used')) then raise exception 'INVALID_MESSAGE_PATCH'; end if;
    v_subject := case when p_patch ? 'subject' then p_patch->>'subject' else message.subject end;
    v_body    := case when p_patch ? 'body' then p_patch->>'body' else message.body end;
    if coalesce(length(trim(v_body)),0)=0 then raise exception 'MESSAGE_BODY_REQUIRED'; end if;
    v_hay := coalesce(v_subject,'')||E'\n'||coalesce(v_body,'');
    select coalesce(jsonb_agg(c.value),'[]'::jsonb) into v_used
      from jsonb_array_elements(case when p_patch ? 'sources_used' then p_patch->'sources_used' else message.sources_used end) c
      where coalesce(length(trim(c.value->>'claim')),0)>0 and position(c.value->>'claim' in v_hay)>0;
    for citation in select value from jsonb_array_elements(v_used) loop
      select * into source from public.prospect_sources where id::text=citation->>'source_id' and prospect_id=message.prospect_id;
      if not found or source.type is distinct from citation->>'type' or source.url is distinct from citation->>'url'
        or coalesce(length(trim(citation->>'evidence_quote')),0)=0
        or position(citation->>'evidence_quote' in coalesce(source.content_excerpt,''))=0 then raise exception 'INVALID_MESSAGE_EVIDENCE'; end if;
    end loop;
    update public.prospect_messages set subject=v_subject, body=v_body,
      variables = case when p_patch ? 'variables' then p_patch->'variables' else variables end,
      sources_used = v_used
      where id=p_id returning * into message;
    v_rev := message.revision;
    update public.prospect_messages set validated_revision=v_rev, validated_source_hash=public.prospector_source_hash(message)
      where id=p_id returning * into message;

  elsif p_action='reject' then
    update public.prospect_messages set status='rejected',rejection_reason=p_reason where id=p_id returning * into message;

  elsif p_action<>'later' or p_action is null then raise exception 'INVALID_REVIEW_ACTION'; end if;

  if p_action<>'edit' then
    insert into public.prospect_feedback(prospect_id,decision,reason,score_at_decision)
      select message.prospect_id,case p_action when 'approve' then 'approved' when 'reject' then 'rejected' else 'later' end,p_reason,score
      from public.prospects where id=message.prospect_id;
  end if;
  return message;
end $$;

create or replace function public.prospector_reject_prospect(p_id uuid, p_reason text) returns public.prospects
language plpgsql security definer set search_path = '' as $$
declare p public.prospects; actor uuid:=public.prospector_require_user();
begin
  perform pg_advisory_xact_lock(731905,1);
  if coalesce(length(trim(p_reason)),0)=0 then raise exception 'REJECTION_REASON_REQUIRED'; end if;
  select * into strict p from public.prospects where id=p_id for update;
  if p.status='won' then raise exception 'PROSPECT_NOT_REJECTABLE'; end if;
  update public.prospect_messages set status='rejected', rejection_reason=p_reason where prospect_id=p_id and status<>'sent';
  update public.prospect_jobs set status='error', error='PROSPECT_REJECTED', claim_token=null, lease_until=null, updated_at=clock_timestamp()
    where prospect_id=p_id and status in ('queued','running');
  insert into public.prospect_feedback(prospect_id,decision,reason,score_at_decision) values(p_id,'rejected',p_reason,p.score);
  update public.prospects set status='archived', exclusion_reason=p_reason,
    next_action=null, next_action_at=null, next_followup_at=null where id=p_id returning * into p;
  insert into public.prospect_events(prospect_id,type,label,meta,actor,actor_id)
    values(p_id,'status_changed','Prospect écarté',jsonb_build_object('reason',p_reason),'user',actor);
  return p;
end $$;

create or replace function public.prospector_request_regeneration(p_id uuid) returns public.prospect_jobs
language plpgsql security definer set search_path = '' as $$
declare result public.prospect_jobs; p public.prospects;
begin
  perform public.prospector_require_user();
  perform pg_advisory_xact_lock(731905,2);
  select * into strict p from public.prospects where id=p_id;
  if p.deleted_at is not null or p.is_client or p.status in ('excluded','archived','lost','won') or public.prospector_is_blacklisted(p) then raise exception 'PROSPECT_NOT_ANALYZABLE'; end if;
  if p.analysis is null or p.strategy is null then raise exception 'STRATEGY_MISSING'; end if;
  select * into result from public.prospect_jobs where prospect_id=p_id and status in ('queued','running') order by created_at limit 1;
  if found then return result; end if;
  if (select count(*) from public.prospect_jobs where status in ('queued','running'))>=50 then raise exception 'QUEUE_CAPACITY_REACHED'; end if;
  insert into public.prospect_jobs(type,prospect_id,idempotency_key)
    values('copywrite',p_id,'copywrite:'||p_id||':'||floor(extract(epoch from clock_timestamp()))::bigint) returning * into result;
  return result;
end $$;

do $$ declare fn text; begin
  foreach fn in array array[
    'public.prospector_review_message(uuid,text,integer,jsonb,text)',
    'public.prospector_reject_prospect(uuid,text)',
    'public.prospector_request_regeneration(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;
