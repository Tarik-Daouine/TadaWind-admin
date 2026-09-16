import {readFileSync} from 'node:fs'
import {management} from './prospector-db.mjs'

const migration=readFileSync(new URL('../supabase/migrations/20260916130000_outlook_personal_oauth.sql',import.meta.url),'utf8')
const assertions=`
do $$ begin
  if to_regclass('public.automation_connections') is null then raise exception 'oauth_connection_table_missing'; end if;
  if has_table_privilege('authenticated','public.automation_connections','select') then raise exception 'browser_can_read_oauth_token'; end if;
  if has_table_privilege('authenticated','public.automation_oauth_states','insert') then raise exception 'browser_can_create_oauth_state'; end if;
end $$;`

await management('database/query',{query:`begin;${migration}${assertions}rollback;`})
console.log('OAuth migration assertions passed; transaction rolled back.')
