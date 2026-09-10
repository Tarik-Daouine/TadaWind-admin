import {readFileSync} from 'node:fs'
import {management} from './prospector-db.mjs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const migrations=['20260906103000_prospector_followup.sql','20260906103100_prospector_budget.sql','20260906103200_prospector_budget_errors.sql','20260906180000_prospector_single_channel.sql','20260907121149_prospector_location_jobs.sql','20260907135447_prospector_graph_send.sql','20260907180000_prospector_send_safety.sql']
const ddl=migrations.map(name=>read('supabase/migrations/'+name)).join('\n')
const fixture=read('tests/sql/prospector-review-ui.sql').split('-- Le worker')[0]
const tests=read(process.argv[2]==='send-safety'?'tests/sql/prospector-send-safety.sql':process.argv[2]==='single-channel'?'tests/sql/prospector-single-channel.sql':'tests/sql/prospector-release.sql')

// Les automatisations internes écrivent dans public.leads, table héritée qu'aucune
// migration ne crée : le rejeu en schéma isolé ne peut donc pas les couvrir. Ce
// mode les vérifie sur le schéma réel, dans une transaction annulée.
if(['internal-automations','brevo'].includes(process.argv[2])){
  await management('database/query',{query:"begin;set local lock_timeout='3s';set local statement_timeout='45s';"+read(process.argv[2]==='brevo'?'tests/sql/brevo-contact.sql':'tests/sql/internal-automations.sql')+' rollback;'})
  console.log('Internal automation SQL assertions passed; transaction rolled back.')
}else if(process.argv[2]==='apply'){
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
  // `projects` et `leads` sont des tables héritées qu'aucune migration ne crée :
  // rejouées dans un schéma isolé, elles n'existent pas et font échouer tout le
  // rejeu. Les migrations qui s'y adossent sont donc écartées d'ici — celle des
  // automatisations internes est couverte par le mode `internal-automations`,
  // qui s'exécute sur le schéma réel dans une transaction annulée.
  const LEGACY_DEPENDENT=['20260908125459_internal_automations.sql','20260908125500_video_platforms.sql','20260909130000_brevo_contact.sql',
    // Ne fait que supprimer des tables créées par une migration déjà écartée
    // ci-dessus : rejouée seule, elle ne trouverait rien à supprimer.
    '20260910143104_drop_outlook_oauth.sql']
  const all=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')&&!LEGACY_DEPENDENT.includes(n)).sort()
  const schema=all.map(n=>read('supabase/migrations/'+n)).join('\n')
  await management('database/query',{query:"begin;set local lock_timeout='3s';set local statement_timeout='45s';create schema prospector_release_test;grant usage on schema prospector_release_test to authenticated,service_role,anon;"+isolate(schema+'\n'+fixture+'\n'+tests)+'\nrollback;'})
  console.log('Release SQL assertions passed; isolated transaction rolled back.')
}
