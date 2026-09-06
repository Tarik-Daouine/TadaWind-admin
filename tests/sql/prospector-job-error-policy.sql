create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'ASSERTION_FAILED: %',label;end if;end$$;
insert into public.prospects(id,name) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Job Error Test');
insert into public.prospect_jobs(id,type,prospect_id,idempotency_key) values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','enrich','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','job-error-test');
select set_config('request.jwt.claims','{"role":"service_role"}',true);set local role service_role;
select * from public.prospector_claim_jobs(1,30);
select public.prospector_finish_job(id,claim_token,null,'NO_WEBSITE') from public.prospect_jobs where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
select pg_temp.assert_true((select status='error' and attempts=1 and error='NO_WEBSITE' from public.prospect_jobs where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'),'terminal error');
reset role;
