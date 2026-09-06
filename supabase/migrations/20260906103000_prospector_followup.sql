-- Explicit human CRM decisions; never sends a message.
create function public.prospector_record_outcome(p_id uuid,p_expected_updated_at timestamptz,p_status text,p_note text) returns public.prospects
language plpgsql security definer set search_path='' as $$
declare p public.prospects; actor uuid:=public.prospector_require_user(); old_status text;
begin
  perform pg_advisory_xact_lock(731905,1);
  if p_status is null or p_status not in ('replied','interested','meeting','quote','won','lost') or length(trim(coalesce(p_note,''))) not between 1 and 4000 then raise exception 'INVALID_CRM_OUTCOME'; end if;
  select * into strict p from public.prospects where id=p_id for update;
  if p.updated_at is distinct from p_expected_updated_at then raise exception 'PROSPECT_CONFLICT'; end if;
  if p.deleted_at is not null or p.is_client or p.status in ('excluded','archived','lost','won') or public.prospector_is_blacklisted(p) then raise exception 'PROSPECT_NOT_CONTACTABLE'; end if;
  if p.last_contacted_at is null then raise exception 'CONTACT_REQUIRED'; end if;
  old_status:=p.status;
  update public.prospects set status=p_status,is_client=(p_status='won'),next_followup_at=null,next_action_at=null,
    next_action=case p_status when 'replied' then 'Répondre au prospect' when 'interested' then 'Préciser le besoin' when 'meeting' then 'Préparer le rendez-vous' when 'quote' then 'Suivre le devis' else null end
    where id=p_id returning * into p;
  update public.prospect_jobs set status='error',error='CRM_OUTCOME_RECORDED',claim_token=null,lease_until=null,updated_at=clock_timestamp()
    where prospect_id=p_id and status in ('queued','running');
  update public.prospect_messages set status='rejected',rejection_reason='Échange commercial enregistré' where prospect_id=p_id and status<>'sent';
  insert into public.prospect_events(prospect_id,type,label,meta,actor,actor_id)
    values(p_id,'status_changed','Échange commercial enregistré',jsonb_build_object('from',old_status,'to',p_status,'note',trim(p_note)),'user',actor);
  return p;
end $$;
revoke all on function public.prospector_record_outcome(uuid,timestamptz,text,text) from public,anon,authenticated,service_role;
grant execute on function public.prospector_record_outcome(uuid,timestamptz,text,text) to authenticated;

-- Only a newly confirmed message schedules the next follow-up.
create function public.prospector_schedule_followup() returns trigger
language plpgsql security definer set search_path='' as $$
declare delays integer[]; sent_count integer; prospect_status text;
begin
  if new.status='sent' and old.status is distinct from 'sent' then
    select followup_delays_days into delays from public.prospector_settings where id='main';
    select count(*) into sent_count from public.prospect_messages where prospect_id=new.prospect_id and status='sent';
    prospect_status:=case when sent_count=1 then 'contacted' when sent_count=2 then 'followup_1' else 'followup_2' end;
    update public.prospects set next_followup_at=case when sent_count<=cardinality(delays) then clock_timestamp()+make_interval(days=>delays[sent_count]) end,
      next_action=case when sent_count<=cardinality(delays) then 'Préparer une relance personnalisée' else 'Revoir le suivi commercial' end
      where id=new.prospect_id;
  end if;
  return new;
end $$;
create trigger prospector_schedule_followup after update on public.prospect_messages for each row execute function public.prospector_schedule_followup();
revoke all on function public.prospector_schedule_followup() from public,anon,authenticated,service_role;
