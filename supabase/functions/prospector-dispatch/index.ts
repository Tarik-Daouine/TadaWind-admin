import {cors,json,requireAdmin} from '../_shared/prospector/automation-runtime.ts'

type BackgroundRuntime={waitUntil(promise:Promise<unknown>):void}
const backgroundRuntime=()=>(globalThis as typeof globalThis&{EdgeRuntime?:BackgroundRuntime}).EdgeRuntime
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function startWorker(campaignId:string) {
  const base=Deno.env.get('SUPABASE_URL')||''
  const secret=Deno.env.get('PROSPECTOR_CRON_SECRET')||''
  if(!base||!secret)throw new Error('DISPATCH_NOT_CONFIGURED')
  const response=await fetch(`${base}/functions/v1/prospector-worker`,{
    method:'POST',headers:{'content-type':'application/json','x-prospector-cron-secret':secret},body:'{}',signal:AbortSignal.timeout(180000),
  })
  const body=await response.text()
  if(!response.ok)console.error('PROSPECTOR_DISPATCH_FAILED',JSON.stringify({campaignId,status:response.status,body:body.slice(0,500)}))
  else console.log('PROSPECTOR_DISPATCH_DONE',JSON.stringify({campaignId,status:response.status,body:body.slice(0,500)}))
}

export async function handle(request:Request) {
  if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405)
  try{await requireAdmin(request)}catch{return json({error:'UNAUTHORIZED'},401)}
  let payload:unknown
  try{payload=await request.json()}catch{return json({error:'INVALID_INPUT'},400)}
  const input=payload as Record<string,unknown>
  if(!input||typeof input!=='object'||Object.keys(input).some(key=>key!=='campaign_id')||typeof input.campaign_id!=='string'||!uuid.test(input.campaign_id))return json({error:'INVALID_INPUT'},400)
  const runtime=backgroundRuntime()
  if(!runtime)return json({error:'BACKGROUND_RUNTIME_UNAVAILABLE'},503)
  runtime.waitUntil(startWorker(input.campaign_id))
  return json({accepted:true,campaign_id:input.campaign_id},202)
}

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return cors(request,new Response(null,{status:204}))
  let response:Response
  try{response=await handle(request)}catch{response=json({error:'DISPATCH_FAILED'},500)}
  return cors(request,response)
})
