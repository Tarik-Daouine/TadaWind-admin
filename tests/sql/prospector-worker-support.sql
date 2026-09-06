create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'ASSERTION_FAILED: %',label; end if;end$$;
create function pg_temp.expect_error(statement text,expected text) returns void language plpgsql as $$declare caught text;begin begin execute statement;exception when others then caught:=sqlerrm;end;if caught is null or position(expected in caught)=0 then raise exception 'EXPECTED_ERROR: %, got %',expected,coalesce(caught,'success');end if;end$$;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}',true);
set local role authenticated;
select public.prospector_create_prospect('{"name":"Enrich Test","website":"https://enrich-fixture.invalid/","description":"Contexte saisi manuellement."}');
select pg_temp.assert_true((select count(*)=1 from public.prospect_sources where type='manual' and confidence=1),'manual source captured');
select pg_temp.expect_error($q$select public.prospector_store_enrichment((select id from public.prospects limit 1),'https://enrich-fixture.invalid/','https://enrich-fixture.invalid/','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','{}',now()+interval '1 day')$q$,'permission denied');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select public.prospector_store_enrichment((select id from public.prospects where website_domain='enrich-fixture.invalid'),
  'https://enrich-fixture.invalid/','https://enrich-fixture.invalid/final','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '{"website":{"emails":["public@enrich-fixture.invalid"],"phones":["0611223344"]},"socials":{"instagram":["https://instagram.com/enrich_fixture"],"facebook":[],"linkedin":[],"tiktok":[],"youtube":[]},"signals":[],"sources":[{"content_excerpt":"Hôtel à Sarlat."}]}',now()+interval '14 days');
select pg_temp.assert_true((select status='to_analyze' and email='public@enrich-fixture.invalid' and phone='+33611223344' and instagram is not null from public.prospects where website_domain='enrich-fixture.invalid'),'enrichment stored and normalized');
select pg_temp.assert_true((select count(*)=1 from public.prospect_web_cache),'cache stored');
select pg_temp.assert_true((select count(*)=1 from public.prospect_sources where type='website_page'),'website source stored');
select pg_temp.assert_true((select count(*)=1 from public.prospect_events where type='enriched'),'enrichment event');
select public.prospector_store_enrichment((select id from public.prospects where website_domain='enrich-fixture.invalid'),
  'https://enrich-fixture.invalid/','https://enrich-fixture.invalid/final','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '{"website":{"emails":[],"phones":[]},"socials":{"instagram":[],"facebook":[],"linkedin":[],"tiktok":[],"youtube":[]},"signals":[],"sources":[{"content_excerpt":"Hôtel à Sarlat."}]}',now()+interval '14 days');
select pg_temp.assert_true((select count(*)=1 from public.prospect_sources where type='website_page'),'idempotent source');
select pg_temp.expect_error($q$select public.prospector_store_enrichment((select id from public.prospects limit 1),'file:///etc/passwd','https://x.invalid','bad','{}',now())$q$,'INVALID_ENRICHMENT_RESULT');
reset role;
