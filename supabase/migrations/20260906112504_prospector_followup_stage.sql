-- Le pipeline CRM prévoit « Relance 1 » et « Relance 2 », mais l'étape n'était jamais atteinte :
-- le trigger calculait un statut sans jamais l'écrire, et prospector_confirm_message_sent
-- réécrivait 'contacted' juste après. On aligne l'étape sur le nombre d'envois confirmés.
create or replace function public.prospector_confirm_message_sent(p_id uuid,p_expected_revision integer,p_reference text default null) returns public.prospect_messages
language plpgsql security definer set search_path='' as $$
declare message public.prospect_messages; sent_count integer;
begin
  perform public.prospector_require_user();
  perform pg_advisory_xact_lock(731905,1);
  select * into strict message from public.prospect_messages where id=p_id for update;
  if message.revision is distinct from p_expected_revision or message.status<>'approved' then raise exception 'APPROVAL_REQUIRED'; end if;
  update public.prospect_messages set status='sent',sent_channel_ref=p_reference where id=p_id returning * into message;
  select count(*) into sent_count from public.prospect_messages where prospect_id=message.prospect_id and status='sent';
  update public.prospects set
    status=case when sent_count<=1 then 'contacted' when sent_count=2 then 'followup_1' else 'followup_2' end,
    last_contacted_at=clock_timestamp()
    where id=message.prospect_id;
  return message;
end $$;
revoke all on function public.prospector_confirm_message_sent(uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.prospector_confirm_message_sent(uuid,integer,text) to authenticated;

-- Le trigger ne planifie que l'échéance ; l'étape CRM est posée par la RPC ci-dessus.
create or replace function public.prospector_schedule_followup() returns trigger
language plpgsql security definer set search_path='' as $$
declare delays integer[]; sent_count integer;
begin
  if new.status='sent' and old.status is distinct from 'sent' then
    select followup_delays_days into delays from public.prospector_settings where id='main';
    select count(*) into sent_count from public.prospect_messages where prospect_id=new.prospect_id and status='sent';
    update public.prospects set next_followup_at=case when sent_count<=cardinality(delays) then clock_timestamp()+make_interval(days=>delays[sent_count]) end,
      next_action=case when sent_count<=cardinality(delays) then 'Préparer une relance personnalisée' else 'Revoir le suivi commercial' end
      where id=new.prospect_id;
  end if;
  return new;
end $$;
revoke all on function public.prospector_schedule_followup() from public,anon,authenticated,service_role;
