-- Run inside a transaction and roll back; no email dispatch.
do $$ declare result jsonb; begin
  result:=public.automation_accept_contact_html('11111111-ffff-4111-8111-222222222222','html-fixture','html-fixture',
    '{"prenom":"TEST","nom":"ROLLBACK","email":"test@example.invalid","ville_lieu":"Sarlat","type_besoin":"autre","particulier":true,"date_souhaitee":""}',
    'internal@example.invalid','Internal','Receipt','<p>Internal</p>','<p>Receipt</p>');
  if (select count(*) from public.automation_outbox where contact_id='11111111-ffff-4111-8111-222222222222' and html_body is not null)<>2 then raise exception 'HTML_NOT_ATOMIC'; end if;
  result:=public.automation_accept_contact_html('11111111-ffff-4111-8111-222222222222','html-fixture','html-fixture','{}','','','','changed','changed');
  if result->>'duplicate'<>'true' or exists(select 1 from public.automation_outbox where contact_id='11111111-ffff-4111-8111-222222222222' and html_body='changed') then raise exception 'DUPLICATE_MUTATED'; end if;
  if not exists(select 1 from public.automation_outbox where contact_id='11111111-ffff-4111-8111-222222222222' and kind='contact_receipt' and subject='Confirmation de votre demande de contact') then raise exception 'SUBJECT_MISSING'; end if;
  if has_function_privilege('anon','public.automation_accept_contact_html(uuid,text,text,jsonb,text,text,text,text,text)','execute') or has_function_privilege('authenticated','public.automation_accept_contact_html(uuid,text,text,jsonb,text,text,text,text,text)','execute') then raise exception 'PUBLIC_RPC'; end if;
end $$;
