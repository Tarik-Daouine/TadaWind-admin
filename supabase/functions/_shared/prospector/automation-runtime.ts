import {createClient} from 'npm:@supabase/supabase-js@2.100.0'
import {serviceClient} from './runtime.ts'
export {serviceClient}
export const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}})
export async function sha(value:string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('')
}
function bytes64(bytes:Uint8Array) { return btoa(String.fromCharCode(...bytes)) }
function from64(value:string) { return Uint8Array.from(atob(value),x=>x.charCodeAt(0)) }
async function key() {
  const raw=Deno.env.get('AUTOMATION_ENCRYPTION_KEY') || ''
  if (!raw) throw new Error('AUTOMATION_NOT_CONFIGURED')
  return crypto.subtle.importKey('raw',from64(raw),'AES-GCM',false,['encrypt','decrypt'])
}
export async function encrypt(value:string) {
  const iv=crypto.getRandomValues(new Uint8Array(12))
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(),new TextEncoder().encode(value))
  return bytes64(iv)+'.'+bytes64(new Uint8Array(cipher))
}
export async function decrypt(value:string) {
  const [iv,data]=value.split('.')
  return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(iv)},await key(),from64(data)))
}
export async function requireAdmin(request:Request) {
  const auth=request.headers.get('authorization') || ''
  if (!auth.startsWith('Bearer ')) throw new Error('UNAUTHORIZED')
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{authorization:auth}}})
  const {data,error}=await client.auth.getUser()
  if(error || !data.user || data.user.is_anonymous) throw new Error('UNAUTHORIZED')
  return data.user.id
}
export function cors(request:Request,response:Response,publicSite=false) {
  const origin=request.headers.get('origin') || ''
  const allowed=publicSite ? ['https://www.tadawind.com','https://tadawind.com'] : ['https://tarik-daouine.github.io']
  if (allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
    response.headers.set('Access-Control-Allow-Origin',origin)
    response.headers.set('Access-Control-Allow-Methods','POST, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers','authorization, apikey, content-type, x-client-info')
    response.headers.set('Vary','Origin')
  }
  return response
}
export async function outlookToken() {
  const db=serviceClient()
  const {data:connection,error}=await db.from('automation_connections').select('*').eq('id','outlook').maybeSingle()
  if(error || !connection) throw new Error('OUTLOOK_NOT_CONNECTED')
  const tokens=JSON.parse(await decrypt(connection.token_cipher))
  if(tokens.expires_at>Date.now()+60000) return {token:tokens.access_token,sender:connection.sender}
  const response=await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token',{
    method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},signal:AbortSignal.timeout(20000),
    body:new URLSearchParams({client_id:Deno.env.get('MS_OAUTH_CLIENT_ID')!,client_secret:Deno.env.get('MS_OAUTH_CLIENT_SECRET')!,grant_type:'refresh_token',refresh_token:tokens.refresh_token,scope:'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access'}),
  })
  if(!response.ok) {await response.body?.cancel();throw new Error('OUTLOOK_RECONNECT_REQUIRED')}
  const next=await response.json()
  if(typeof next.access_token!=='string') throw new Error('OUTLOOK_RECONNECT_REQUIRED')
  const cipher=await encrypt(JSON.stringify({...next,refresh_token:next.refresh_token || tokens.refresh_token,expires_at:Date.now()+next.expires_in*1000}))
  const saved=await db.from('automation_connections').update({token_cipher:cipher,updated_at:new Date().toISOString()}).eq('id','outlook').eq('token_cipher',connection.token_cipher)
  if(saved.error) throw new Error('TOKEN_SAVE_FAILED')
  return {token:next.access_token,sender:connection.sender}
}
