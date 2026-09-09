-- Only on an empty outbox, under locks, in the release script's rollback transaction.
lock table public.automation_outbox,public.automation_email_attempts in exclusive mode;
do $$ declare email public.automation_outbox; first_attempt uuid; begin
  if exists(select 1 from public.automation_outbox) or exists(select 1 from public.automation_email_attempts) then
    raise exception 'BREVO_TEST_REQUIRES_EMPTY_QUEUE_USE_TEST_DATABASE';
  end if;
  perform public.automation_accept_contact('22222222-ffff-4222-8222-222222222222','brevo-fixture','brevo-fixture-email',
    '{"prenom":"TEST BREVO","nom":"ROLLBACK","email":"test@example.invalid","ville_lieu":"Sarlat","type_besoin":"autre","particulier":true,"date_souhaitee":""}',
    'internal@example.invalid','Internal fixture','Receipt fixture');
  select * into email from public.automation_claim_brevo_email();
  first_attempt:=email.attempt_id;
  if email.provider<>'brevo' then raise exception 'wrong_provider'; end if;
  if (select count(*) from public.automation_email_attempts)<>1 then raise exception 'unreserved_send'; end if;
  perform public.automation_finish_brevo_email(email.id,email.attempt_id,'unknown','SEND_OUTCOME_UNKNOWN',null);
  insert into public.automation_email_attempts(attempt_id,outbox_id) select gen_random_uuid(),email.id from generate_series(1,299);
  begin
    perform public.automation_claim_brevo_email();
    raise exception 'quota_not_enforced';
  exception when others then if sqlerrm<>'BREVO_LOCAL_QUOTA_REACHED' then raise; end if; end;
  if (select count(*) from public.automation_outbox where status='pending')<>1 then raise exception 'quota_claimed_email'; end if;
  update public.automation_email_attempts set created_at=now()-interval '25 hours';
  select * into email from public.automation_claim_brevo_email();
  if email.attempt_id=first_attempt then raise exception 'uncertain_reclaimed'; end if;
  begin
    perform public.automation_finish_brevo_email(email.id,first_attempt,'accepted',null,'wrong-attempt');
    raise exception 'wrong_attempt_accepted';
  exception when others then if sqlerrm<>'ATTEMPT_CONFLICT' then raise; end if; end;
  perform public.automation_finish_brevo_email(email.id,email.attempt_id,'accepted',null,'<fixture@brevo.invalid>');
  if not exists(select 1 from public.automation_outbox where id=email.id and provider_message_id='<fixture@brevo.invalid>' and status='accepted') then raise exception 'receipt_missing'; end if;
  if exists(select 1 from public.automation_claim_brevo_email()) then raise exception 'uncertain_reclaimed'; end if;
  if has_function_privilege('authenticated','public.automation_claim_brevo_email()','execute') then raise exception 'public_send'; end if;
  if has_table_privilege('authenticated','public.automation_email_attempts','insert') then raise exception 'public_quota_write'; end if;
end $$;
