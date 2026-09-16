import {it,expect,vi,beforeEach,afterEach} from 'vitest'
const state=vi.hoisted(()=>({handler:null,user:{id:'owner',is_anonymous:false},rpc:vi.fn(),update:vi.fn(),env:{}}))
vi.mock('npm:@supabase/supabase-js@2.100.0',()=>({createClient:()=>({auth:{getUser:async()=>({data:{user:state.user}})},rpc:state.rpc})}))
vi.mock('../../../supabase/functions/_shared/prospector/runtime.ts',()=>({json:(data,status=200)=>Response.json(data,{status}),serviceClient:()=>({from:()=>({update:state.update})})}))
beforeEach(async()=>{
  vi.resetModules();state.user={id:'owner',is_anonymous:false};state.rpc.mockReset();state.update.mockReset()
  state.env={BREVO_API_KEY:'fixture',BREVO_SENDER_EMAIL:'contact@tadawind.com',PROSPECTOR_PREVIEW_RECIPIENT:'owner@example.invalid'}
  state.rpc.mockResolvedValue({data:{id:'attempt',subject:'Example',body:'Bonjour <script>alert(1)</script>',duplicate:false}})
  state.update.mockReturnValue({eq:()=>({eq:async()=>({error:null})})})
  vi.stubGlobal('Deno',{serve:fn=>{state.handler=fn},env:{get:name=>state.env[name]}})
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({messageId:'<preview>'},{status:201})))
  await import('../../../supabase/functions/prospector-preview-email/index.ts')
})
afterEach(()=>vi.unstubAllGlobals())
const run=(payload={message_id:'message',revision:2})=>state.handler(new Request('https://fixture',{method:'POST',headers:{authorization:'Bearer fixture','content-type':'application/json'},body:JSON.stringify(payload)}))
it('requires a verified non-anonymous session',async()=>{
  state.user=null;expect((await run()).status).toBe(401)
  state.user={id:'anonymous',is_anonymous:true};expect((await run()).status).toBe(401)
  expect(state.rpc).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled()
})
it('rejects attempts to choose a recipient or replace the body',async()=>{
  for(const field of ['recipient','body','subject'])expect((await run({message_id:'message',revision:2,[field]:'tampered'})).status).toBe(400)
  expect(fetch).not.toHaveBeenCalled()
})
it('sends the saved snapshot only to the server-fixed address with the shared signature',async()=>{
  expect((await run()).status).toBe(200)
  const mail=JSON.parse(fetch.mock.calls[0][1].body)
  expect(mail.to).toEqual([{email:'owner@example.invalid'}]);expect(mail.subject).toBe('[APERÇU] Example')
  expect(mail.htmlContent).not.toContain('<script>');expect(mail.htmlContent).toContain('Tarik Daouine')
  expect(state.rpc).toHaveBeenCalledTimes(1);expect(state.rpc).toHaveBeenCalledWith('prospector_reserve_preview',{p_id:'message',p_revision:2})
  expect(state.update).toHaveBeenCalledWith({status:'accepted',provider_message_id:'<preview>'})
})
it.each(['reserved','unknown','failed','accepted'])('never resends a previous %s attempt',async status=>{
  state.rpc.mockResolvedValue({data:{duplicate:true,status}})
  expect((await run()).status).toBe(status==='accepted'?200:409);expect(fetch).not.toHaveBeenCalled()
})
it('leaves transport failures uncertain and never retries',async()=>{
  fetch.mockRejectedValue(new Error('timeout'));expect((await run()).status).toBe(502)
  expect(fetch).toHaveBeenCalledTimes(1);expect(state.update).toHaveBeenCalledWith({status:'unknown',provider_message_id:null})
})
it('does not reserve or send when configuration is missing',async()=>{
  delete state.env.PROSPECTOR_PREVIEW_RECIPIENT
  expect((await run()).status).toBe(503);expect(state.rpc).not.toHaveBeenCalled()
})
