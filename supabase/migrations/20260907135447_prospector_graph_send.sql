-- Envoi Outlook via Microsoft Graph : réservation avant appel réseau.
-- L'envoi reste déclenché par un clic humain sur un message déjà approuvé.
-- Aucun premier contact ne part sans cette validation.

alter table public.prospect_messages add column if not exists send_lock_at timestamptz;
alter table public.prospect_messages add column if not exists send_attempts integer not null default 0;

-- Réserve l'envoi. Un second clic, un double appel concurrent ou un rejeu tombent
-- sur SEND_ALREADY_IN_PROGRESS tant que la réservation n'a pas expiré.
create or replace function public.prospector_begin_send(p_id uuid, p_expected_revision integer) returns public.prospect_messages
language plpgsql security definer set search_path = '' as $$
declare message public.prospect_messages; p public.prospects;
begin
  perform public.prospector_require_user();
  perform pg_advisory_xact_lock(731905,3);
  select * into strict message from public.prospect_messages where id=p_id for update;
  if message.revision is distinct from p_expected_revision then raise exception 'MESSAGE_CONFLICT'; end if;
  if message.status='sent' then raise exception 'MESSAGE_ALREADY_SENT'; end if;
  if message.status<>'approved' then raise exception 'APPROVAL_REQUIRED'; end if;
  if message.channel<>'email' then raise exception 'CHANNEL_NOT_SENDABLE'; end if;
  if message.send_lock_at is not null and message.send_lock_at > clock_timestamp() - interval '2 minutes' then
    raise exception 'SEND_ALREADY_IN_PROGRESS';
  end if;
  select * into strict p from public.prospects where id=message.prospect_id for update;
  if p.deleted_at is not null or p.is_client or p.status in ('excluded','archived','lost')
    or public.prospector_is_blacklisted(p) then raise exception 'PROSPECT_NOT_CONTACTABLE'; end if;
  if coalesce(nullif(trim(p.contact_email),''), nullif(trim(p.email),''), nullif(trim(p.email_commercial),'')) is null then
    raise exception 'NO_RECIPIENT_EMAIL';
  end if;
  update public.prospect_messages set send_lock_at=clock_timestamp(), send_attempts=send_attempts+1
    where id=p_id returning * into message;
  return message;
end $$;

-- Libère la réservation quand l'envoi a échoué, pour permettre une nouvelle tentative
-- explicite sans attendre l'expiration.
create or replace function public.prospector_release_send(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.prospector_require_user();
  update public.prospect_messages set send_lock_at=null where id=p_id and status='approved';
  insert into public.prospect_events(prospect_id,type,label,meta,actor,actor_id)
    select prospect_id,'send_failed','Envoi non abouti',jsonb_build_object('reason',left(coalesce(p_reason,'unknown'),300)),'user',auth.uid()
    from public.prospect_messages where id=p_id;
end $$;

-- Destinataire retenu, exposé au serveur d'envoi uniquement.
create or replace function public.prospector_send_context(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare message public.prospect_messages; p public.prospects;
begin
  perform public.prospector_require_worker();
  select * into strict message from public.prospect_messages where id=p_id;
  select * into strict p from public.prospects where id=message.prospect_id;
  return jsonb_build_object(
    'message_id',message.id,'revision',message.revision,'status',message.status,
    'subject',message.subject,'body',message.body,
    'recipient',coalesce(nullif(trim(p.contact_email),''),nullif(trim(p.email),''),nullif(trim(p.email_commercial),'')),
    'prospect_name',p.name);
end $$;

do $$ declare fn text; begin
  foreach fn in array array[
    'public.prospector_begin_send(uuid,integer)',
    'public.prospector_release_send(uuid,text)',
    'public.prospector_send_context(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', fn);
  end loop;
  execute 'grant execute on function public.prospector_begin_send(uuid,integer) to authenticated';
  execute 'grant execute on function public.prospector_release_send(uuid,text) to authenticated';
  execute 'grant execute on function public.prospector_send_context(uuid) to service_role';
end $$;
