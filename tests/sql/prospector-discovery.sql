create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'ASSERTION_FAILED: %',label; end if;end$$;
create function pg_temp.expect_error(statement text,expected text) returns void language plpgsql as $$declare caught text;begin begin execute statement;exception when others then caught:=sqlerrm;end;if caught is null or position(expected in caught)=0 then raise exception 'EXPECTED_ERROR: %, got %',expected,coalesce(caught,'success');end if;end$$;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}',true);
set local role authenticated;
select pg_temp.expect_error($q$select public.prospector_start_campaign('Injection','{"categories":["hotels;drop table"],"radius_km":10}')$q$,'INVALID_CAMPAIGN_CATEGORIES');
select pg_temp.expect_error($q$select public.prospector_start_campaign('Trop loin','{"categories":["hotels"],"radius_km":999}')$q$,'INVALID_CAMPAIGN_RADIUS');
select public.prospector_start_campaign('Sarlat hôtels','{"categories":["hotels","restaurants","hotels"],"radius_km":20}');
select pg_temp.assert_true((select count(*)=1 from public.prospect_campaigns where status='running'),'campaign created');
select pg_temp.assert_true((select count(*)=1 from public.prospect_jobs where type='discovery' and status='queued'),'discovery queued');
select pg_temp.expect_error($q$select public.prospector_store_discovery((select id from public.prospect_campaigns limit 1),'[]','{}')$q$,'permission denied');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select public.prospector_store_discovery((select id from public.prospect_campaigns limit 1),
  '[{"name":"Hôtel OSM","category":"hotels","city":"Sarlat","lat":44.89,"lng":1.21,"website":"https://osm-fixture.invalid/","source_url":"https://www.openstreetmap.org/node/123","source_excerpt":"Hôtel OSM · Sarlat","source_data":{"osm_id":123}},
    {"name":"Hôtel OSM bis","category":"hotels","city":"Sarlat","lat":44.89,"lng":1.21,"website":"https://osm-fixture.invalid/","source_url":"https://www.openstreetmap.org/node/124","source_excerpt":"Doublon domaine","source_data":{"osm_id":124}},
    {"name":"Sans source","category":"hotels","lat":44.89,"lng":1.21,"source_url":"https://evil.invalid/1","source_excerpt":"x","source_data":{}}]',
  '{"found":3}');
select pg_temp.assert_true((select count(*)=1 from public.prospects where data_origin='openstreetmap'),'only unique valid candidate inserted');
select pg_temp.assert_true((select count(*)=1 from public.prospect_sources where type='openstreetmap'),'source stored');
select pg_temp.assert_true((select count(*)=1 from public.prospect_jobs where type='enrich'),'enrichment queued');
select pg_temp.assert_true((select status='done' and (stats->>'inserted')::int=1 and (stats->>'skipped')::int=2 from public.prospect_campaigns),'campaign report stored');
reset role;
