-- Keep the existing idempotency, rate limits and atomic outbox creation.
alter table public.automation_outbox add column html_body text;

create function public.automation_accept_contact_html(p_id uuid,p_fingerprint text,p_email_hash text,p_data jsonb,p_internal text,p_internal_body text,p_receipt_body text,p_internal_html text,p_receipt_html text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  if p_internal_html is null or p_receipt_html is null or length(p_internal_html)>100000 or length(p_receipt_html)>30000 then
    raise exception 'INVALID_INPUT';
  end if;
  result := public.automation_accept_contact(p_id,p_fingerprint,p_email_hash,p_data,p_internal,p_internal_body,p_receipt_body);
  if not (result->>'duplicate')::boolean then
    update public.automation_outbox set
      html_body=case kind when 'contact_internal' then p_internal_html else p_receipt_html end,
      subject=case kind when 'contact_receipt' then 'Confirmation de votre demande de contact' else subject end
      where contact_id=p_id;
  end if;
  return result;
end $$;
revoke all on function public.automation_accept_contact_html(uuid,text,text,jsonb,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.automation_accept_contact_html(uuid,text,text,jsonb,text,text,text,text,text) to service_role;
