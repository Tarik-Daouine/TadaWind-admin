-- Additive: CONTACT_INTERNAL_ENABLED remains off until receipt verification.
alter table public.automation_outbox add column provider text not null default 'outlook' check(provider in ('outlook','brevo'));
alter table public.automation_outbox add column provider_message_id text;
create table public.automation_email_attempts (
  attempt_id uuid primary key,
  outbox_id uuid not null references public.automation_outbox(id),
  created_at timestamptz not null default now()
);
create index automation_email_attempts_window on public.automation_email_attempts(created_at);
alter table public.automation_email_attempts enable row level security;
revoke all on public.automation_email_attempts from public,anon,authenticated;
grant all on public.automation_email_attempts to service_role;

create function public.automation_claim_brevo_email() returns setof public.automation_outbox
language plpgsql security definer set search_path=public,pg_temp as $$
declare claimed public.automation_outbox;
begin
  -- All concurrent workers share the cap. Failed/uncertain calls consume it too.
  perform pg_advisory_xact_lock(hashtextextended('automation-brevo-quota',0));
  if (select count(*) from public.automation_email_attempts where created_at>now()-interval '24 hours')>=300 then
    raise exception 'BREVO_LOCAL_QUOTA_REACHED';
  end if;
  select * into claimed from public.automation_claim_email();
  if not found then return; end if;
  update public.automation_outbox set provider='brevo',provider_message_id=null where id=claimed.id returning * into claimed;
  insert into public.automation_email_attempts(attempt_id,outbox_id) values(claimed.attempt_id,claimed.id);
  return next claimed;
end $$;

create function public.automation_finish_brevo_email(p_id uuid,p_attempt uuid,p_status text,p_error text,p_message_id text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_status='accepted' and (p_message_id is null or length(p_message_id)=0 or length(p_message_id)>500) then raise exception 'INVALID_MESSAGE_ID'; end if;
  if not exists(select 1 from public.automation_email_attempts where attempt_id=p_attempt and outbox_id=p_id) then raise exception 'ATTEMPT_CONFLICT'; end if;
  perform public.automation_finish_email(p_id,p_attempt,p_status,p_error);
  update public.automation_outbox set provider_message_id=case when p_status='accepted' then p_message_id else null end where id=p_id;
end $$;
revoke all on function public.automation_claim_brevo_email(),public.automation_finish_brevo_email(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.automation_claim_brevo_email(),public.automation_finish_brevo_email(uuid,uuid,text,text,text) to service_role;
