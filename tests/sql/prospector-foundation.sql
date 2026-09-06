-- Run ONLY inside a transaction, rolled back by scripts/prospector-db.mjs.
-- Uses synthetic fixtures and simulated JWT claims; never changes auth.users.
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'ASSERTION_FAILED: %',label; end if; end $$;
create function pg_temp.expect_error(statement text,expected text) returns void language plpgsql as $$
declare caught text;
begin
  begin execute statement; exception when others then caught:=sqlerrm; end;
  if caught is null or position(expected in caught)=0 then raise exception 'EXPECTED_ERROR: %, got %',expected,coalesce(caught,'success'); end if;
end $$;

select pg_temp.assert_true(public.prospector_normalize_name(' S.A.R.L. Château de l’Œuvre SASU ')='chateau de l oeuvre','name normalization');
select pg_temp.assert_true(public.prospector_normalize_name('Sassafras')='sassafras','legal substring preserved');
select pg_temp.assert_true(public.prospector_normalize_name(' SARL ') is null,'empty normalized name');
select pg_temp.assert_true(public.prospector_normalize_phone('+33 (0)6 12 34 56 78')='+33612345678','phone optional zero');
select pg_temp.assert_true(public.prospector_normalize_phone('0033 6 12 34 56 78')='+33612345678','phone 0033');
select pg_temp.assert_true(public.prospector_normalize_phone('06123 poste 2') is null,'invalid phone');
select pg_temp.assert_true(public.prospector_domain('https://WWW.Example.fr/page')='example.fr','domain normalization');
select pg_temp.assert_true(public.prospector_domain('https://user:pass@example.fr') is null,'domain credentials rejected');

select pg_temp.assert_true((select count(*)=10 from pg_tables where schemaname='public' and tablename in
  ('prospector_settings','prospect_campaigns','prospects','prospect_sources','prospect_events','prospect_messages','prospect_jobs','prospect_blacklist','prospect_feedback','ai_usage') and rowsecurity),'ten RLS tables');
select pg_temp.assert_true((select count(*)=0 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'prospector_%' and prosecdef and not coalesce(proconfig @> array['search_path=""'],false)),'fixed definer paths');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.prospect_messages','UPDATE'),'no direct authenticated message updates');
select pg_temp.assert_true(not has_table_privilege('service_role','public.prospect_jobs','UPDATE'),'no direct worker job updates');
select pg_temp.assert_true(not has_function_privilege('anon','public.prospector_create_prospect(jsonb)','EXECUTE'),'anon cannot call intake');

set local role anon;
select pg_temp.expect_error('select * from public.prospector_settings','permission denied');
select pg_temp.expect_error($q$select public.prospector_create_prospect('{"name":"No access"}')$q$,'permission denied');
reset role;

select set_config('request.jwt.claims','{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}',true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=1 from public.prospector_settings),'authenticated reads singleton');
select pg_temp.expect_error($q$update public.prospector_settings set min_score=90$q$,'permission denied');
select pg_temp.expect_error($q$select public.prospector_claim_jobs()$q$,'permission denied');
select pg_temp.expect_error($q$select public.prospector_save_settings('{"min_score":90}', '2000-01-01')$q$,'SETTINGS_CONFLICT');
select pg_temp.expect_error($q$select public.prospector_save_settings('{"radius_max_km":10}',(select updated_at from public.prospector_settings))$q$,'check constraint');
select pg_temp.expect_error($q$select public.prospector_save_settings('{"scoring_weights":{"version":"bad","fit_tada_wind":25}}',(select updated_at from public.prospector_settings))$q$,'INVALID_WEIGHTS');
select pg_temp.expect_error($q$select public.prospector_save_settings('{"priority_thresholds":{"hot":40,"good":80,"consider":20,"low":10}}',(select updated_at from public.prospector_settings))$q$,'INVALID_THRESHOLDS');
select pg_temp.expect_error($q$select public.prospector_save_settings('{"distance_bands":[{"max":60},{"max":30},{"max":100}]}',(select updated_at from public.prospector_settings))$q$,'INVALID_DISTANCE_BANDS');
select pg_temp.expect_error($q$select public.prospector_save_settings('{"followup_delays_days":[3,3]}',(select updated_at from public.prospector_settings))$q$,'INVALID_FOLLOWUP_DELAYS');
select pg_temp.expect_error($q$select public.prospector_save_settings('{"business_profile":{"services":[]}}',(select updated_at from public.prospector_settings))$q$,'INVALID_PROFILE');
select pg_temp.expect_error($q$select public.prospector_save_settings('{"id":"evil"}',(select updated_at from public.prospector_settings))$q$,'INVALID_SETTINGS_FIELDS');
select public.prospector_save_settings('{"min_score":45}',(select updated_at from public.prospector_settings));
select pg_temp.assert_true((select min_score=45 from public.prospector_settings),'settings save persists');

select public.prospector_create_prospect('{"name":"S.A.R.L. Test Fondation Hôtel","city":"Sarlat","website":"https://www.fixture-foundation.invalid/","phone":"06 11 22 33 44","email":"public@fixture-foundation.invalid"}');
select pg_temp.assert_true((select normalized_name='test fondation hotel' and website_domain='fixture-foundation.invalid' and phone='+33611223344' from public.prospects where website_domain='fixture-foundation.invalid'),'intake normalizes in SQL');
select pg_temp.expect_error($q$select public.prospector_create_prospect('{"name":"Autre hôtel","website":"https://fixture-foundation.invalid/contact"}')$q$,'PROSPECT_COLLISION');
select pg_temp.expect_error($q$select public.prospector_create_prospect('{"name":"Autre téléphone","phone":"+33611223344"}')$q$,'PROSPECT_COLLISION');
select pg_temp.expect_error($q$select public.prospector_create_prospect('{"name":"TEST FONDATION HOTEL SAS","city":"SARLAT"}')$q$,'PROSPECT_COLLISION');
select pg_temp.expect_error($q$select public.prospector_create_prospect('{"name":"Fake","status":"won"}')$q$,'INVALID_PROSPECT_FIELDS');
select pg_temp.assert_true((select count(*)=1 from public.prospect_events where label='Prospect ajouté manuellement'),'intake event');
reset role;

-- Draft insertion is backend-only; user cannot forge proofs or approvals.
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
insert into public.prospect_sources(id,prospect_id,type,url,content_excerpt) select '22222222-2222-4222-8222-222222222222',id,'website_page','https://fixture-foundation.invalid/','Notre hôtel est situé à Sarlat.' from public.prospects where website_domain='fixture-foundation.invalid';
insert into public.prospect_messages(id,prospect_id,channel,body,sources_used)
select '33333333-3333-4333-8333-333333333333',id,'email','Votre hôtel est situé à Sarlat.',
  '[{"source_id":"22222222-2222-4222-8222-222222222222","type":"website_page","url":"https://fixture-foundation.invalid/","claim":"Votre hôtel est situé à Sarlat.","path":"email.body","evidence_quote":"Notre hôtel est situé à Sarlat."}]'
  from public.prospects where website_domain='fixture-foundation.invalid';
select pg_temp.expect_error($q$update public.prospect_messages set status='approved' where id='33333333-3333-4333-8333-333333333333'$q$,'USER_ACTION_REQUIRED');
select pg_temp.expect_error($q$select public.prospector_review_message('33333333-3333-4333-8333-333333333333','approve',1)$q$,'permission denied');
select pg_temp.expect_error($q$select public.prospector_validate_message('33333333-3333-4333-8333-333333333333',1,'stale')$q$,'SOURCE_CONFLICT');
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}',true);
set local role authenticated;
select pg_temp.expect_error($q$select public.prospector_review_message('33333333-3333-4333-8333-333333333333','approve',1)$q$,'MESSAGE_VALIDATION_REQUIRED');
select pg_temp.expect_error($q$select public.prospector_confirm_message_sent('33333333-3333-4333-8333-333333333333',1)$q$,'APPROVAL_REQUIRED');
select pg_temp.expect_error($q$update public.prospect_messages set status='sent'$q$,'permission denied');
select pg_temp.expect_error($q$select public.prospector_validate_message('33333333-3333-4333-8333-333333333333',1,'hash')$q$,'permission denied');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select public.prospector_validate_message('33333333-3333-4333-8333-333333333333',1,public.prospector_message_context('33333333-3333-4333-8333-333333333333')->>'source_hash');
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}',true);
set local role authenticated;
select public.prospector_review_message('33333333-3333-4333-8333-333333333333','approve',1);
select pg_temp.assert_true((select approved_by=auth.uid() and status='approved' from public.prospect_messages where id='33333333-3333-4333-8333-333333333333'),'human approval attributed');
select public.prospector_review_message('33333333-3333-4333-8333-333333333333','edit',1,'{"body":"Votre hôtel est situé à Sarlat. Une idée de vidéo ?"}');
select pg_temp.assert_true((select revision=2 and status='draft' and approved_at is null and validated_revision is null from public.prospect_messages where id='33333333-3333-4333-8333-333333333333'),'edit revokes approval and validation');
select pg_temp.expect_error($q$select public.prospector_review_message('33333333-3333-4333-8333-333333333333','approve',1)$q$,'MESSAGE_CONFLICT');
select pg_temp.expect_error($q$select public.prospector_review_message('33333333-3333-4333-8333-333333333333','approve',2)$q$,'MESSAGE_VALIDATION_REQUIRED');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select public.prospector_validate_message('33333333-3333-4333-8333-333333333333',2,public.prospector_message_context('33333333-3333-4333-8333-333333333333')->>'source_hash');
update public.prospect_sources set content_excerpt=content_excerpt||' Nouveau contenu.' where id='22222222-2222-4222-8222-222222222222';
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}',true);
set local role authenticated;
select pg_temp.expect_error($q$select public.prospector_review_message('33333333-3333-4333-8333-333333333333','approve',2)$q$,'MESSAGE_VALIDATION_REQUIRED');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select public.prospector_validate_message('33333333-3333-4333-8333-333333333333',2,public.prospector_message_context('33333333-3333-4333-8333-333333333333')->>'source_hash');
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}',true);
set local role authenticated;
select public.prospector_review_message('33333333-3333-4333-8333-333333333333','approve',2);
select public.prospector_confirm_message_sent('33333333-3333-4333-8333-333333333333',2,'manual-test');
select pg_temp.assert_true((select status='sent' and sent_by=auth.uid() from public.prospect_messages where id='33333333-3333-4333-8333-333333333333'),'manual sending confirmation');
select pg_temp.assert_true((select status='contacted' from public.prospects where website_domain='fixture-foundation.invalid'),'CRM contacted updated');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select pg_temp.expect_error($q$update public.prospect_messages set body='Modified' where id='33333333-3333-4333-8333-333333333333'$q$,'SENT_MESSAGE_IMMUTABLE');

-- Jobs: idempotence, bounded claims, stale tokens, retry/backoff and lease recovery.
select public.prospector_enqueue_job('enrich',(select id from public.prospects where website_domain='fixture-foundation.invalid'),null,'foundation-test-enrich');
select public.prospector_enqueue_job('enrich',(select id from public.prospects where website_domain='fixture-foundation.invalid'),null,'foundation-test-enrich');
select pg_temp.assert_true((select count(*)=1 from public.prospect_jobs where idempotency_key='foundation-test-enrich'),'idempotent enqueue');
select pg_temp.expect_error($q$select public.prospector_enqueue_job('score',(select id from public.prospects where website_domain='fixture-foundation.invalid'),null,'foundation-test-enrich')$q$,'IDEMPOTENCY_KEY_CONFLICT');
select pg_temp.expect_error($q$select public.prospector_claim_jobs(6)$q$,'INVALID_CLAIM_LIMIT');
select pg_temp.assert_true((select count(*)=1 from public.prospector_claim_jobs(1,30)),'first claim');
select pg_temp.assert_true((select count(*)=0 from public.prospector_claim_jobs(1,30)),'no double claim');
select pg_temp.expect_error($q$select public.prospector_finish_job((select id from public.prospect_jobs where idempotency_key='foundation-test-enrich'),'44444444-4444-4444-8444-444444444444','{}')$q$,'STALE_JOB_CLAIM');
select public.prospector_finish_job(id,claim_token,null,'SOURCE_UNREACHABLE') from public.prospect_jobs where idempotency_key='foundation-test-enrich';
select pg_temp.assert_true((select status='queued' and attempts=1 and run_after>now() and claim_token is null from public.prospect_jobs where idempotency_key='foundation-test-enrich'),'retry with backoff');
reset role;
update public.prospect_jobs set run_after=now()-interval '1 minute' where idempotency_key='foundation-test-enrich';
set local role service_role;
select * from public.prospector_claim_jobs(1,30);
reset role;
update public.prospect_jobs set lease_until=now()-interval '1 second' where idempotency_key='foundation-test-enrich';
set local role service_role;
select * from public.prospector_claim_jobs(1,30);
select pg_temp.assert_true((select status='queued' and attempts=2 and error='LEASE_EXPIRED' from public.prospect_jobs where idempotency_key='foundation-test-enrich'),'expired lease requeued');
reset role;
update public.prospect_jobs set run_after=now()-interval '1 minute' where idempotency_key='foundation-test-enrich';
set local role service_role;
select * from public.prospector_claim_jobs(1,30);
select public.prospector_finish_job(id,claim_token,null,'TIMEOUT') from public.prospect_jobs where idempotency_key='foundation-test-enrich';
select pg_temp.assert_true((select status='error' and attempts=3 from public.prospect_jobs where idempotency_key='foundation-test-enrich'),'attempt exhaustion');
reset role;

-- Opposition persists independently from a deleted prospect.
select set_config('request.jwt.claims','{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}',true);
set local role authenticated;
select public.prospector_request_analysis(id) from public.prospects where website_domain='fixture-foundation.invalid';
select public.prospector_request_analysis(id) from public.prospects where website_domain='fixture-foundation.invalid';
select pg_temp.assert_true((select count(*)=1 from public.prospect_jobs where type='manual_analyze'),'manual analysis deduplicated');
select public.prospector_blacklist_prospect(id,'Opposition de test') from public.prospects where website_domain='fixture-foundation.invalid';
select pg_temp.assert_true((select count(*)=0 from public.prospect_jobs where status in ('queued','running')),'blacklist cancels jobs');
select pg_temp.expect_error($q$select public.prospector_request_analysis(id) from public.prospects where website_domain='fixture-foundation.invalid'$q$,'PROSPECT_NOT_ANALYZABLE');
select public.prospector_delete_prospect(id) from public.prospects where website_domain='fixture-foundation.invalid';
select pg_temp.assert_true((select count(*)=0 from public.prospect_sources),'sources purged');
select pg_temp.assert_true((select count(*)=0 from public.prospect_messages),'messages purged');
select pg_temp.assert_true((select count(*)=0 from public.prospect_events),'events purged');
select pg_temp.assert_true((select count(*)=0 from public.prospect_feedback),'feedback purged');
select pg_temp.assert_true((select count(*)=1 from public.prospect_blacklist),'opposition retained');
select pg_temp.expect_error($q$select public.prospector_create_prospect('{"name":"Nouvelle identité","website":"https://fixture-foundation.invalid/"}')$q$,'PROSPECT_BLACKLISTED');
reset role;
