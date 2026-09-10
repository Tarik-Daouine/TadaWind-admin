-- Executed only with the migration inside a rolled-back transaction. No network triggers on leads.
do $$ declare first_result jsonb; second_result jsonb; email public.automation_outbox; begin
  first_result:=public.automation_accept_contact('11111111-ffff-4111-8111-111111111111','fixture','fixture-email',
    '{"prenom":"TEST AUTOMATION","nom":"ROLLBACK","email":"test@example.invalid","ville_lieu":"Sarlat","type_besoin":"autre","particulier":true,"date_souhaitee":""}',
    'internal@example.invalid','Internal fixture','Receipt fixture');
  second_result:=public.automation_accept_contact('11111111-ffff-4111-8111-111111111111','fixture','fixture-email','{}','internal@example.invalid','','');
  if second_result->>'duplicate'<>'true' then raise exception 'duplicate_not_detected'; end if;
  if (select count(*) from public.automation_outbox)<>2 then raise exception 'outbox_not_atomic'; end if;
  if (select count(*) from public.leads where "ID"='FORM-11111111-ffff-4111-8111-111111111111')<>1 then raise exception 'duplicate_lead'; end if;
  begin
    perform public.automation_accept_contact('11111111-ffff-4111-8111-111111111111','different','fixture-email','{}','','','');
    raise exception 'conflict_not_rejected';
  exception when others then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise; end if; end;
  select * into email from public.automation_claim_email();
  perform public.automation_finish_email(email.id,email.attempt_id,'unknown','SEND_OUTCOME_UNKNOWN');
  select * into email from public.automation_claim_email();
  perform public.automation_finish_email(email.id,email.attempt_id,'accepted',null);
  if exists(select 1 from public.automation_claim_email()) then raise exception 'uncertain_email_reclaimed'; end if;
  -- Le jeton Outlook n'existe plus du tout : la table a été supprimée avec le
  -- consentement délégué, ce qui est plus fort que de vérifier ses droits.
  if to_regclass('public.automation_connections') is not null then raise exception 'oauth_table_resurrected'; end if;
  if has_function_privilege('anon','public.automation_accept_contact(uuid,text,text,jsonb,text,text,text)','execute') then raise exception 'public_rpc_bypass'; end if;
  if has_table_privilege('authenticated','public.automation_outbox','update') then raise exception 'browser_can_requeue'; end if;
end $$;
