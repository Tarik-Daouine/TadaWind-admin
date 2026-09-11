import {cors,json,serviceClient} from '../_shared/prospector/automation-runtime.ts'
Deno.serve(async request=>{
  const reply=(body:unknown,status=200)=>cors(request,json(body,status),true)
  if(!['https://www.tadawind.com','https://tadawind.com'].includes(request.headers.get('origin')||''))return reply({error:'ORIGIN_NOT_ALLOWED'},403)
  if(request.method==='OPTIONS')return reply({ok:true})
  if(request.method!=='POST')return reply({error:'METHOD_NOT_ALLOWED'},405)
  // Only a fixed event name is accepted. No visitor ID, URL, email or form data.
  const reader=request.body?.getReader();if(!reader)return reply({error:'INVALID_EVENT'},400)
  let value='';const decoder=new TextDecoder();let bytes=0
  while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>32){await reader.cancel();return reply({error:'INVALID_EVENT'},400)}value+=decoder.decode(part.value,{stream:true})}
  if(!['page_view','form_open','contact_accepted','email_click'].includes(value))return reply({error:'INVALID_EVENT'},400)
  const {error}=await serviceClient().rpc('site_count_event',{p_event:value})
  return reply(error?{error:'UNAVAILABLE'}:{accepted:true},error?503:202)
})
