import {readFileSync} from 'node:fs'
import {management} from './prospector-db.mjs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const migrations=['20260906103000_prospector_followup.sql','20260906103100_prospector_budget.sql','20260906103200_prospector_budget_errors.sql','20260906180000_prospector_single_channel.sql']
const ddl=migrations.map(name=>read('supabase/migrations/'+name)).join('\n')
const fixture=read('tests/sql/prospector-review-ui.sql').split('-- Le worker')[0]
const tests=read(process.argv[2]==='single-channel'?'tests/sql/prospector-single-channel.sql':'tests/sql/prospector-release.sql')
if(process.argv[2]==='apply'){
  for(const name of migrations){
    const version=name.split('_')[0]
    const exists=await management('database/query',{query:"select version from supabase_migrations.schema_migrations where version='"+version+"'",read_only:true})
    if(exists.length)continue
    await management('database/query',{query:'begin;'+read('supabase/migrations/'+name)+"\ninsert into supabase_migrations.schema_migrations(version,name) values('"+version+"','"+name.slice(15,-4)+"');commit;"})
  }
  console.log('Release migrations applied.')
}else{
  const isolate=text=>text.replaceAll('public.','prospector_release_test.').replaceAll("'public'","'prospector_release_test'")
  // Replay all migrations in an isolated, rolled-back schema.
  const {readdirSync}=await import('node:fs')
  const all=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort()
  const schema=all.map(n=>read('supabase/migrations/'+n)).join('\n')
  await management('database/query',{query:"begin;set local statement_timeout='45s';create schema prospector_release_test;grant usage on schema prospector_release_test to authenticated,service_role,anon;"+isolate(schema+'\n'+fixture+'\n'+tests)+'\nrollback;'})
  console.log('Release SQL assertions passed; isolated transaction rolled back.')
}
