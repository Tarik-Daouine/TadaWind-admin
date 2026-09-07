-- Une réservation d'envoi ne périme jamais : après un crash, l'issue est inconnue.
create or replace function public.prospector_begin_send(p_id uuid, p_expected_revision integer) returns public.prospect_messages
language plpgsql security definer set search_path = '' as $$
declare message public.prospect_messages; p public.prospects;
begin
  perform public.prospector_require_user();
  perform pg_advisory_xact_lock(731905,3);
  select * into strict message from public.prospect_messages where id=p_id for update;
  if message.revision is distinct from p_expected_revision then raise exception 'MESSAGE_CONFLICT'; end if;
  if message.status='sent' then raise exception 'MESSAGE_ALREADY_SENT'; end if;
  if message.send_lock_at is not null then raise exception 'SEND_RECONCILIATION_REQUIRED'; end if;
  if message.status<>'approved' then raise exception 'APPROVAL_REQUIRED'; end if;
  if message.channel<>'email' then raise exception 'CHANNEL_NOT_SENDABLE'; end if;
  select * into strict p from public.prospects where id=message.prospect_id for update;
  if p.deleted_at is not null or p.is_client or p.status in ('excluded','archived','lost')
    or public.prospector_is_blacklisted(p) then raise exception 'PROSPECT_NOT_CONTACTABLE'; end if;
  if coalesce(nullif(trim(p.contact_email),''), nullif(trim(p.email),''), nullif(trim(p.email_commercial),'')) is null then raise exception 'NO_RECIPIENT_EMAIL'; end if;
  update public.prospect_messages set send_lock_at=clock_timestamp(),send_attempts=send_attempts+1 where id=p_id returning * into message;
  return message;
end $$;

-- L'ancien endpoint permettait au navigateur de déverrouiller une issue inconnue.
drop function public.prospector_release_send(uuid,text);
create function public.prospector_release_send(p_id uuid,p_lock_at timestamptz,p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare message public.prospect_messages;
begin
  perform public.prospector_require_worker();
  if nullif(trim(p_reason),'') is null then raise exception 'SEND_RELEASE_REASON_REQUIRED'; end if;
  select * into strict message from public.prospect_messages where id=p_id for update;
  if p_lock_at is null or message.send_lock_at is distinct from p_lock_at then raise exception 'STALE_SEND_ATTEMPT'; end if;
  if message.status='sent' then raise exception 'MESSAGE_ALREADY_SENT'; end if;
  update public.prospect_messages set send_lock_at=null where id=p_id;
  insert into public.prospect_events(prospect_id,type,label,meta,actor)
    values(message.prospect_id,'send_released','Envoi déverrouillé après vérification',jsonb_build_object('reason',left(p_reason,1000),'message_id',p_id,'attempt',p_lock_at),'system');
end $$;
revoke all on function public.prospector_release_send(uuid,timestamptz,text) from public,anon,authenticated,service_role;
grant execute on function public.prospector_release_send(uuid,timestamptz,text) to service_role;

-- Le texte approuvé ne change pas pendant l'appel réseau ou sa vérification.
create function public.prospector_guard_pending_send() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.send_lock_at is not null and (
    new.body is distinct from old.body or new.subject is distinct from old.subject
    or new.revision is distinct from old.revision or new.channel is distinct from old.channel
    or new.prospect_id is distinct from old.prospect_id
    or (new.status is distinct from old.status and new.status<>'sent')) then
    raise exception 'SEND_RECONCILIATION_REQUIRED';
  end if;
  return new;
end $$;
create trigger prospector_guard_pending_send before update on public.prospect_messages
for each row execute function public.prospector_guard_pending_send();
