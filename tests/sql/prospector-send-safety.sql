-- Après la fixture de revue. Aucun appel réseau, transaction isolée puis rollback.
select set_config('request.jwt.claims','{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}',true);
set local role authenticated;
do $$ declare m public.prospect_messages; begin
  select * into strict m from public.prospect_messages where prospect_id='cccccccc-0000-4000-8000-00000000d001' and channel='email';
  if m.status<>'approved' then perform public.prospector_review_message(m.id,'approve',m.revision); end if;
  perform public.prospector_begin_send(m.id,m.revision);
  perform pg_temp.expect_error(format('select public.prospector_begin_send(%L,%s)',m.id,m.revision),'SEND_RECONCILIATION_REQUIRED');
  perform pg_temp.expect_error(format('select public.prospector_review_message(%L,%L,%s,%L::jsonb)',m.id,'edit',m.revision,'{"body":"Autre message"}'),'SEND_RECONCILIATION_REQUIRED');
  perform pg_temp.assert_true(not has_function_privilege('authenticated','public.prospector_release_send(uuid,timestamptz,text)','execute'),'le navigateur ne peut pas lever le verrou');
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
update public.prospect_messages set send_lock_at=clock_timestamp()-interval '3 days' where prospect_id='cccccccc-0000-4000-8000-00000000d001' and channel='email';
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}',true);
set local role authenticated;
do $$ declare m public.prospect_messages; begin
  select * into strict m from public.prospect_messages where prospect_id='cccccccc-0000-4000-8000-00000000d001' and channel='email';
  perform pg_temp.expect_error(format('select public.prospector_begin_send(%L,%s)',m.id,m.revision),'SEND_RECONCILIATION_REQUIRED');
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
do $$ declare m public.prospect_messages; begin
  select * into strict m from public.prospect_messages where prospect_id='cccccccc-0000-4000-8000-00000000d001' and channel='email';
  perform pg_temp.expect_error(format('select public.prospector_release_send(%L,%L,%L)',m.id,clock_timestamp(),'obsolete'),'STALE_SEND_ATTEMPT');
  perform public.prospector_release_send(m.id,m.send_lock_at,'Test : refus Microsoft explicite');
  perform pg_temp.assert_true((select send_lock_at is null from public.prospect_messages where id=m.id),'libération contrôlée');
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}',true);
set local role authenticated;
do $$ declare m public.prospect_messages; begin
  select * into strict m from public.prospect_messages where prospect_id='cccccccc-0000-4000-8000-00000000d001' and channel='email';
  perform public.prospector_begin_send(m.id,m.revision);
  perform public.prospector_confirm_message_sent(m.id,m.revision,'Test : élément envoyé vérifié');
  perform pg_temp.assert_true((select status='sent' from public.prospect_messages where id=m.id),'confirmation humaine autorisée sans renvoyer');
  perform pg_temp.expect_error(format('select public.prospector_begin_send(%L,%s)',m.id,m.revision),'MESSAGE_ALREADY_SENT');
end $$;
