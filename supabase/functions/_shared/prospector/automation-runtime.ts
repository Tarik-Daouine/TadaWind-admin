import {createClient} from 'npm:@supabase/supabase-js@2.100.0'
import {serviceClient} from './runtime.ts'
export {serviceClient}
export const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}})
export async function sha(value:string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('')
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
