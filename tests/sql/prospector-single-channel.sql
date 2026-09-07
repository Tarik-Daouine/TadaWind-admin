-- Fixture has four drafts created by four separate calls. All changes roll back.
select pg_temp.expect_error($q$select public.prospector_request_channel('cccccccc-0000-4000-8000-00000000d001','fax')$q$,'NO_AVAILABLE_CHANNEL');
select public.prospector_request_channel('cccccccc-0000-4000-8000-00000000d001','phone_script');
select public.prospector_request_channel('cccccccc-0000-4000-8000-00000000d001','phone_script');
select pg_temp.assert_true((select count(*)=1 from public.prospect_jobs where payload->>'channel'='phone_script'),'same-channel request is idempotent');
select pg_temp.expect_error($q$select public.prospector_request_channel('cccccccc-0000-4000-8000-00000000d001','email')$q$,'PROSPECT_JOB_ACTIVE');
select public.prospector_review_message((select id from public.prospect_messages where channel='linkedin'),'approve',1);
select public.prospector_review_message((select id from public.prospect_messages where channel='email'),'edit',1,'{"body":"Votre hôtel est situé à Sarlat. Une autre idée ?"}');
select pg_temp.expect_error($q$select public.prospector_request_channel('cccccccc-0000-4000-8000-00000000d001','email')$q$,'MESSAGE_CONFLICT');
select pg_temp.expect_error($q$select public.prospector_request_channel('cccccccc-0000-4000-8000-00000000d001','linkedin')$q$,'MESSAGE_CONFLICT');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select pg_temp.expect_error($q$select public.prospector_request_channel('cccccccc-0000-4000-8000-00000000d001','email')$q$,'permission denied');
select pg_temp.expect_error($q$select public.prospector_store_messages('cccccccc-0000-4000-8000-00000000d001','{"variants":{"email":{},"linkedin":{}}}')$q$,'INVALID_MESSAGE_RESULT');
select pg_temp.expect_error($q$select public.prospector_store_messages('cccccccc-0000-4000-8000-00000000d001','{"variants":{"fax":{}}}')$q$,'INVALID_MESSAGE_RESULT');
select pg_temp.expect_error($q$select public.prospector_store_messages('cccccccc-0000-4000-8000-00000000d001','{"variants":{"email":{}}}')$q$,'MESSAGE_CONFLICT');
select pg_temp.expect_error($q$select public.prospector_store_messages('cccccccc-0000-4000-8000-00000000d001','{"variants":{"linkedin":{}}}')$q$,'MESSAGE_CONFLICT');
do $$ declare m public.prospect_messages; before_ids uuid[]; payload jsonb; begin
  select array_agg(id order by id) into before_ids from public.prospect_messages where channel<>'instagram_dm';
  select * into strict m from public.prospect_messages where channel='instagram_dm';
  payload := jsonb_build_object('variants',jsonb_build_object('instagram_dm',jsonb_build_object('body',m.body)),
    'sources_used',m.sources_used,'grounding',m.variables->'grounding','tone_check',m.variables->'tone_check','confidence',0.7);
  perform public.prospector_store_messages(m.prospect_id,payload);
  perform pg_temp.assert_true((select array_agg(id order by id)=before_ids from public.prospect_messages where channel<>'instagram_dm'),'other channels keep their ids');
  perform pg_temp.assert_true((select count(*)=1 from public.prospect_messages where channel='instagram_dm' and id<>m.id and validated_revision=1),'only requested draft replaced and validated');
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}',true);
set local role authenticated;
select public.prospector_confirm_message_sent((select id from public.prospect_messages where channel='linkedin'),1);
select pg_temp.expect_error($q$select public.prospector_request_channel('cccccccc-0000-4000-8000-00000000d001','instagram_dm')$q$,'MESSAGE_CONFLICT');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select pg_temp.expect_error($q$select public.prospector_store_messages('cccccccc-0000-4000-8000-00000000d001','{"variants":{"instagram_dm":{}}}')$q$,'MESSAGE_CONFLICT');
reset role;
