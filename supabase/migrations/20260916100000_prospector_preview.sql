create table public.prospector_email_previews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  message_id uuid not null references public.prospect_messages(id),
  revision integer not null,
  subject text,
  body text not null,
  status text not null default 'reserved' check(status in ('reserved','accepted','failed','unknown')),
  provider_message_id text,
  created_at timestamptz not null default now(),
  unique(user_id,message_id,revision)
);
alter table public.prospector_email_previews enable row level security;
revoke all on public.prospector_email_previews from public,anon,authenticated;
grant select on public.prospector_email_previews to authenticated;
grant all on public.prospector_email_previews to service_role;
create policy preview_owner on public.prospector_email_previews for select to authenticated using(user_id=auth.uid());

create function public.prospector_reserve_preview(p_id uuid,p_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.prospector_require_user(); m public.prospect_messages; preview public.prospector_email_previews;
begin
  if coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'USER_ACTION_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('automation-brevo-quota',0));
  select * into strict m from public.prospect_messages where id=p_id for share;
  if m.channel<>'email' or m.revision<>p_revision then raise exception 'MESSAGE_CONFLICT'; end if;
  select * into preview from public.prospector_email_previews where user_id=actor and message_id=p_id and revision=p_revision;
  if found then return jsonb_build_object('duplicate',true,'status',preview.status,'id',preview.id); end if;
  if (select count(*) from public.prospector_email_previews where user_id=actor and created_at>now()-interval '1 hour')>=3 then raise exception 'PREVIEW_RATE_LIMITED'; end if;
  if (select count(*) from public.automation_email_attempts where created_at>now()-interval '24 hours')+
     (select count(*) from public.prospector_email_previews where created_at>now()-interval '24 hours')>=300 then raise exception 'PREVIEW_RATE_LIMITED'; end if;
  insert into public.prospector_email_previews(user_id,message_id,revision,subject,body) values(actor,p_id,p_revision,m.subject,m.body) returning * into preview;
  return to_jsonb(preview)||jsonb_build_object('duplicate',false);
end $$;
revoke all on function public.prospector_reserve_preview(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.prospector_reserve_preview(uuid,integer) to authenticated;

-- Same shared lock and quota for receipts and previews.
create or replace function public.automation_claim_brevo_email() returns setof public.automation_outbox
language plpgsql security definer set search_path=public,pg_temp as $$
declare claimed public.automation_outbox;
begin
  perform pg_advisory_xact_lock(hashtextextended('automation-brevo-quota',0));
  if (select count(*) from public.automation_email_attempts where created_at>now()-interval '24 hours')+
     (select count(*) from public.prospector_email_previews where created_at>now()-interval '24 hours')>=300 then raise exception 'BREVO_LOCAL_QUOTA_REACHED'; end if;
  select * into claimed from public.automation_claim_email();
  if not found then return; end if;
  update public.automation_outbox set provider='brevo',provider_message_id=null where id=claimed.id returning * into claimed;
  insert into public.automation_email_attempts(attempt_id,outbox_id) values(claimed.attempt_id,claimed.id);
  return next claimed;
end $$;
