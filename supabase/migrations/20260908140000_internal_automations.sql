-- Internal automations: additive deployment. Legacy Make stays active until cutover.
create table public.automation_connections (
  id text primary key check (id='outlook'),
  sender text not null,
  token_cipher text not null,
  updated_at timestamptz not null default now()
);
create table public.automation_oauth_states (
  state_hash text primary key,
  verifier_cipher text not null,
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id)
);
create table public.automation_contacts (
  id uuid primary key,
  fingerprint text not null,
  email_hash text not null,
  lead_id text not null,
  created_at timestamptz not null default now()
);
create index automation_contacts_rate on public.automation_contacts(created_at,email_hash);
create table public.automation_outbox (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.automation_contacts(id),
  kind text not null check(kind in ('contact_internal','contact_receipt')),
  recipient text not null,
  subject text not null,
  body text not null,
  status text not null default 'pending' check(status in ('pending','dispatching','accepted','failed','unknown')),
  attempts integer not null default 0,
  attempt_id uuid,
  error_code text,
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(contact_id,kind)
);
create index automation_outbox_pending on public.automation_outbox(available_at) where status='pending';
alter table public.automation_connections enable row level security;
alter table public.automation_oauth_states enable row level security;
alter table public.automation_contacts enable row level security;
alter table public.automation_outbox enable row level security;
revoke all on public.automation_connections,public.automation_oauth_states,public.automation_contacts,public.automation_outbox from public,anon,authenticated;
grant all on public.automation_connections,public.automation_oauth_states,public.automation_contacts,public.automation_outbox to service_role;
grant select on public.automation_outbox to authenticated;
create policy automation_outbox_admin on public.automation_outbox for select to authenticated using(auth.uid() is not null);

create function public.automation_accept_contact(p_id uuid,p_fingerprint text,p_email_hash text,p_data jsonb,p_internal text,p_internal_body text,p_receipt_body text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare existing public.automation_contacts; lead text;
begin
  -- Serializes rate accounting and repeat submissions without relying on browser state.
  perform pg_advisory_xact_lock(hashtextextended('automation-contact',0));
  select * into existing from public.automation_contacts where id=p_id;
  if found then
    if existing.fingerprint<>p_fingerprint then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('accepted',true,'duplicate',true,'reference',p_id);
  end if;
  if (select count(*) from public.automation_contacts where created_at>now()-interval '1 hour')>=100
    or (select count(*) from public.automation_contacts where email_hash=p_email_hash and created_at>now()-interval '1 hour')>=5 then
    raise exception 'RATE_LIMITED';
  end if;
  lead := 'FORM-'||p_id::text;
  insert into public.leads("ID","Prenom","Nom","Email","Telephone","Ville / Lieu mission","Date souhaitee mission","Type de besoin","Message client","Nom entreprise","Type de client","Source","Timestamp","Statut")
  values(lead,p_data->>'prenom',p_data->>'nom',p_data->>'email',nullif(p_data->>'telephone',''),p_data->>'ville_lieu',nullif(p_data->>'date_souhaitee','')::timestamptz,p_data->>'type_besoin',p_data->>'message',p_data->>'nom_entreprise',case when (p_data->>'particulier')::boolean then 'Particulier' else 'Professionnel' end,'tadawind_site',now(),'nouveau');
  insert into public.automation_contacts(id,fingerprint,email_hash,lead_id) values(p_id,p_fingerprint,p_email_hash,lead);
  insert into public.automation_outbox(contact_id,kind,recipient,subject,body) values
    (p_id,'contact_internal',p_internal,'Nouvelle demande TadaWind',p_internal_body),
    (p_id,'contact_receipt',p_data->>'email','Votre demande TadaWind a bien été reçue',p_receipt_body);
  return jsonb_build_object('accepted',true,'duplicate',false,'reference',p_id);
end $$;

create function public.automation_claim_email() returns setof public.automation_outbox
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  -- Never requeue an attempt whose delivery outcome is uncertain.
  update public.automation_outbox set status='unknown',error_code='WORKER_INTERRUPTED',updated_at=now()
  where status='dispatching' and updated_at<now()-interval '5 minutes';
  return query update public.automation_outbox set status='dispatching',attempt_id=gen_random_uuid(),attempts=attempts+1,updated_at=now()
    where id=(select id from public.automation_outbox where status='pending' and available_at<=now() order by created_at limit 1 for update skip locked)
    returning *;
end $$;
create function public.automation_finish_email(p_id uuid,p_attempt uuid,p_status text,p_error text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_status not in ('accepted','failed','unknown','pending') then raise exception 'INVALID_STATUS'; end if;
  update public.automation_outbox set status=case when p_status='pending' and attempts>=3 then 'failed' else p_status end,
    error_code=p_error,updated_at=now(),available_at=now()+interval '5 minutes'
  where id=p_id and attempt_id=p_attempt and status='dispatching';
  if not found then raise exception 'ATTEMPT_CONFLICT'; end if;
end $$;

revoke all on function public.automation_accept_contact(uuid,text,text,jsonb,text,text,text),public.automation_claim_email(),public.automation_finish_email(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.automation_accept_contact(uuid,text,text,jsonb,text,text,text),public.automation_claim_email(),public.automation_finish_email(uuid,uuid,text,text) to service_role;
