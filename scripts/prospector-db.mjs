// Project-scoped management access. Never prints tokens, connection strings or row data.
import { readFileSync } from 'node:fs'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'

const env = Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)
  .filter(line => /^[A-Z_]+\s*=/.test(line)).map(line => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')] }))
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]
if (!/^[a-z]{20}$/.test(ref)) throw new Error('Unrecognized project ref')
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is required')

export async function management(path, body) {
  const result = await fetch(`https://api.supabase.com/v1/projects/${ref}/${path}`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000),
  })
  if (!result.ok) throw new Error(`Management ${result.status}: ${(await result.text()).slice(0, 1500)}`)
  const text = await result.text()
  return text ? JSON.parse(text) : null
}

const command = process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url) ? process.argv[2] : null
const migration = new URL('../supabase/migrations/20260905153918_prospector_foundation.sql', import.meta.url)
const crmMigration = new URL('../supabase/migrations/20260905155054_prospector_crm_api.sql', import.meta.url)
const workerMigration = new URL('../supabase/migrations/20260905155847_prospector_worker_support.sql', import.meta.url)
const errorMigration = new URL('../supabase/migrations/20260905160240_prospector_job_error_policy.sql', import.meta.url)
const discoveryMigration = new URL('../supabase/migrations/20260905161149_prospector_discovery.sql', import.meta.url)
const legacyFingerprintQuery = `select md5(jsonb_agg(x order by x::text)::text) as fingerprint from (
  select jsonb_build_object('column',to_jsonb(c)) as x from information_schema.columns c where table_schema='public' and table_name in ('projects','leads')
  union all select jsonb_build_object('index',to_jsonb(i)) from pg_indexes i where schemaname='public' and tablename in ('projects','leads')
  union all select jsonb_build_object('policy',to_jsonb(p)) from pg_policies p where schemaname='public' and tablename in ('projects','leads')
  union all select jsonb_build_object('trigger',pg_get_triggerdef(t.oid)) from pg_trigger t where t.tgrelid in ('public.projects'::regclass,'public.leads'::regclass)
) objects;`
if (command === 'test') {
  const sql = readFileSync(migration, 'utf8')
  const tests = readFileSync(new URL('../tests/sql/prospector-foundation.sql', import.meta.url), 'utf8')
  // Isolated schema permits repeatable tests after deployment. It never becomes visible:
  // all DDL, fixture writes and role simulations are in one rolled-back transaction.
  const isolate = text => text.replaceAll('public.', 'prospector_l0_test.').replaceAll("'public'", "'prospector_l0_test'")
  const preamble = 'create schema prospector_l0_test; grant usage on schema prospector_l0_test to anon, authenticated, service_role;'
  await management('database/query', { query: `begin; set local lock_timeout='5s'; set local statement_timeout='40s';\n${preamble}\n${isolate(sql)}\n${isolate(tests)}\nrollback;` })
  console.log('Migration + PostgreSQL integration assertions passed; transaction rolled back.')
}
if (command === 'preflight') {
  const results = await Promise.all([
    management('database/query', { query: legacyFingerprintQuery, read_only: true }),
    management('database/query', { query: `select schemaname,tablename from pg_tables where schemaname='supabase_migrations';`, read_only: true }),
  ])
  console.log(JSON.stringify({ projectRef: ref, legacyFingerprint: results[0], migrationTables: results[1] }, null, 2))
}
if (command === 'verify') {
  const results = await Promise.all([
    management('database/query', { query: `select version,name from supabase_migrations.schema_migrations where name like 'prospector_%' order by version;`, read_only: true }),
    management('database/query', { query: `select t.tablename,t.rowsecurity,
      has_table_privilege('anon',format('public.%I',t.tablename),'SELECT') as anon_read,
      has_table_privilege('authenticated',format('public.%I',t.tablename),'UPDATE') as browser_update
      from pg_tables t where schemaname='public' and (tablename like 'prospect%' or tablename='ai_usage') order by tablename;`, read_only: true }),
    management('advisors/security'),
  ])
  const lints = results[2]?.lints ?? []
  console.log(JSON.stringify({ migration: results[0], permissions: results[1], prospectorAdvisors: lints.filter(item => /prospect|ai_usage/.test(JSON.stringify(item))).map(item => ({ name: item.name, level: item.level, object: item.metadata?.name })), otherAdvisorCount: lints.filter(item => !/prospect|ai_usage/.test(JSON.stringify(item))).length }, null, 2))
}
if (command === 'capabilities') {
  const [extensions,secrets]=await Promise.all([
    management('database/query',{query:`select name,default_version,installed_version from pg_available_extensions where name in ('pg_cron','pg_net') order by name;`,read_only:true}),
    management('secrets'),
  ])
  console.log(JSON.stringify({extensions,secretNames:(secrets??[]).map(item=>item.name).sort()},null,2))
}
if (command === 'apply') {
  const existing = await management('database/query', { query: `select to_regclass('public.prospector_settings') as existing;`, read_only: true })
  if (existing[0].existing) throw new Error('Prospector already exists; inspect migration history instead of replaying DDL.')
  const before = await management('database/query', { query: legacyFingerprintQuery, read_only: true })
  const sql = readFileSync(migration, 'utf8')
  await management('database/migrations', { name: 'prospector_foundation', query: sql })
  const after = await management('database/query', { query: legacyFingerprintQuery, read_only: true })
  if (before[0].fingerprint !== after[0].fingerprint) throw new Error('Unexpected legacy schema fingerprint change; inspect immediately.')
  console.log(JSON.stringify({ applied: true, projectRef: ref, legacySchemaUnchanged: true, legacyFingerprint: after[0].fingerprint }))
}
if (command === 'test-crm') {
  const sql=readFileSync(crmMigration,'utf8'), tests=readFileSync(new URL('../tests/sql/prospector-crm-api.sql',import.meta.url),'utf8')
  await management('database/query',{query:`begin; set local lock_timeout='5s'; set local statement_timeout='30s';\n${sql}\n${tests}\nrollback;`})
  console.log('CRM API migration assertions passed; transaction rolled back.')
}
if (command === 'apply-crm') {
  const existing=await management('database/query',{query:`select exists(select 1 from information_schema.columns where table_schema='public' and table_name='prospects' and column_name='notes') as existing;`,read_only:true})
  if(existing[0].existing) throw new Error('CRM API already exists; inspect migration history.')
  await management('database/migrations',{name:'prospector_crm_api',query:readFileSync(crmMigration,'utf8')})
  console.log(JSON.stringify({applied:true,name:'prospector_crm_api',projectRef:ref}))
}
if(command==='test-worker'){
  const sql=readFileSync(workerMigration,'utf8'),tests=readFileSync(new URL('../tests/sql/prospector-worker-support.sql',import.meta.url),'utf8')
  await management('database/query',{query:`begin;set local lock_timeout='5s';set local statement_timeout='30s';\n${sql}\n${tests}\nrollback;`})
  console.log('Worker support migration assertions passed; transaction rolled back.')
}
if(command==='apply-worker'){
  const existing=await management('database/query',{query:`select to_regclass('public.prospect_web_cache') as existing;`,read_only:true})
  if(existing[0].existing)throw new Error('Worker support already exists; inspect migration history.')
  await management('database/migrations',{name:'prospector_worker_support',query:readFileSync(workerMigration,'utf8')})
  console.log(JSON.stringify({applied:true,name:'prospector_worker_support',projectRef:ref}))
}
if(command==='test-job-errors'){
  const sql=readFileSync(errorMigration,'utf8'),tests=readFileSync(new URL('../tests/sql/prospector-job-error-policy.sql',import.meta.url),'utf8')
  await management('database/query',{query:`begin;set local lock_timeout='5s';set local statement_timeout='30s';\n${sql}\n${tests}\nrollback;`})
  console.log('Job error policy assertions passed; transaction rolled back.')
}
if(command==='apply-job-errors'){
  await management('database/migrations',{name:'prospector_job_error_policy',query:readFileSync(errorMigration,'utf8')})
  console.log(JSON.stringify({applied:true,name:'prospector_job_error_policy',projectRef:ref}))
}
if(command==='test-discovery'){
  const sql=readFileSync(discoveryMigration,'utf8'),tests=readFileSync(new URL('../tests/sql/prospector-discovery.sql',import.meta.url),'utf8')
  await management('database/query',{query:`begin;set local lock_timeout='5s';set local statement_timeout='30s';\n${sql}\n${tests}\nrollback;`})
  console.log('Discovery migration assertions passed; transaction rolled back.')
}
if(command==='apply-discovery'){
  await management('database/migrations',{name:'prospector_discovery',query:readFileSync(discoveryMigration,'utf8')})
  console.log(JSON.stringify({applied:true,name:'prospector_discovery',projectRef:ref}))
}
if(command==='smoke-enrich'){
  const secret=process.env.PROSPECTOR_WORKER_SECRET
  if(!secret || secret.length<32)throw new Error('PROSPECTOR_WORKER_SECRET is required')
  const prospectId=crypto.randomUUID(),jobId=crypto.randomUUID(),suffix=prospectId.replaceAll('-','')
  const requestedUrl=`https://example.com/?prospector-smoke=${suffix}`
  try{
    await management('database/query',{query:`insert into public.prospects(id,name,website,data_origin) values('${prospectId}'::uuid,'Prospector smoke ${suffix}','${requestedUrl}','smoke_test');
      insert into public.prospect_jobs(id,type,prospect_id,idempotency_key) values('${jobId}'::uuid,'manual_analyze','${prospectId}'::uuid,'smoke-${suffix}');`})
    const response=await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/prospector-worker`,{method:'POST',headers:{'content-type':'application/json','x-prospector-cron-secret':secret},body:'{}',signal:AbortSignal.timeout(30000)})
    if(!response.ok)throw new Error(`Worker smoke HTTP ${response.status}`)
    const outcome=await response.json()
    const verified=await management('database/query',{query:`select j.status,j.error,p.status as prospect_status,
      (select count(*)::int from public.prospect_sources s where s.prospect_id=p.id and s.type='website_page') as website_sources
      from public.prospect_jobs j join public.prospects p on p.id=j.prospect_id where j.id='${jobId}'::uuid;`,read_only:true})
    const row=verified[0]
    if(outcome.claimed!==1 || row?.status!=='done' || row?.prospect_status!=='to_analyze' || row?.website_sources!==1)throw new Error(`Worker smoke assertion failed: ${JSON.stringify({outcome,row})}`)
    console.log(JSON.stringify({passed:true,claimed:outcome.claimed,jobStatus:row.status,prospectStatus:row.prospect_status,websiteSources:row.website_sources}))
  }finally{
    await management('database/query',{query:`delete from public.prospects where id='${prospectId}'::uuid; delete from public.prospect_web_cache where url='${requestedUrl}';`})
  }
}
if (command === 'inspect') {
  const data = await management('database/query', { query: `select current_setting('server_version') as postgres_version,
    (select array_agg(tablename order by tablename) from pg_tables where schemaname='public') as tables,
    (select count(*) from auth.users) as auth_user_count,
    (select array_agg(extname) from pg_extension) as extensions;`, read_only: true })
  console.log(JSON.stringify({ projectRef: ref, database: data }, null, 2))
}
