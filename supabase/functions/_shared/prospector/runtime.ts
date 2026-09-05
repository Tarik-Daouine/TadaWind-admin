import {createClient} from 'npm:@supabase/supabase-js@2.100.0'
export const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})
export const serviceClient=()=>createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})
export function safeEqual(a:string,b:string){if(!a||!b||a.length!==b.length)return false;let result=0;for(let i=0;i<a.length;i++)result|=a.charCodeAt(i)^b.charCodeAt(i);return result===0}
export function requireWorkerRequest(request:Request){const expected=Deno.env.get('PROSPECTOR_CRON_SECRET')??'';if(!safeEqual(request.headers.get('x-prospector-cron-secret')??'',expected))throw new Error('UNAUTHORIZED')}
export function requireServiceRequest(request:Request){const expected=`Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??''}`;if(!safeEqual(request.headers.get('authorization')??'',expected))throw new Error('UNAUTHORIZED')}
export const errorCode=(error:unknown)=>error instanceof Error?error.message:'UNKNOWN_ERROR'
