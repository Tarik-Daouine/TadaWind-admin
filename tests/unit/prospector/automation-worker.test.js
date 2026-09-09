import {it,expect,vi,beforeEach,afterEach} from 'vitest'
const state=vi.hoisted(()=>({handler:null,rpc:vi.fn(),env:{},pending:true}))
vi.mock('../../../supabase/functions/_shared/prospector/automation-runtime.ts',()=>({
  json:(data,status=200)=>Response.json(data,{status}),
  serviceClient:()=>({rpc:state.rpc,from:()=>({
    update:()=>({eq:()=>({lt:async()=>({error:null})})}),
    select:()=>({eq:()=>({limit:async()=>({data:state.pending?[{id:'fixture'}]:[]})})}),
  })}),
}))
vi.mock('../../../supabase/functions/_shared/prospector/runtime.ts',()=>({requireWorkerRequest:r=>{if(r.headers.get('x-prospector-cron-secret')!=='fixture')throw new Error('UNAUTHORIZED')}}))
const email={id:'email',attempt_id:'attempt',recipient:'test@example.invalid',subject:'Fixture',body:'Fixture',kind:'contact_receipt'}
beforeEach(async()=>{
  vi.resetModules();state.rpc.mockReset();state.env={BREVO_API_KEY:'fixture',BREVO_SENDER_EMAIL:'contact@tadawind.com'};state.pending=true
  let claimed=false
  state.rpc.mockImplementation(async name=>name==='automation_claim_brevo_email'?{data:claimed?[]:(claimed=true,[email])}:{error:null})
  vi.stubGlobal('Deno',{serve:fn=>{state.handler=fn},env:{get:name=>state.env[name]}})
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({messageId:'<fixture@brevo.invalid>'},{status:201})))
  await import('../../../supabase/functions/automation-worker/index.ts')
})
afterEach(()=>vi.unstubAllGlobals())
const run=()=>state.handler(new Request('http://local',{method:'POST',headers:{'x-prospector-cron-secret':'fixture'}}))
it('rejects unauthenticated scheduler calls',async()=>{
  expect((await state.handler(new Request('http://local',{method:'POST'}))).status).toBe(401)
  expect(fetch).not.toHaveBeenCalled()
})
it('does not claim emails when Brevo is not configured',async()=>{
  delete state.env.BREVO_API_KEY
  expect((await run()).status).toBe(503);expect(state.rpc).not.toHaveBeenCalled()
})
it('records acceptance using the exact attempt identifier',async()=>{
  expect((await run()).status).toBe(200)
  expect(state.rpc).toHaveBeenCalledWith('automation_finish_brevo_email',{p_id:'email',p_attempt:'attempt',p_status:'accepted',p_error:null,p_message_id:'<fixture@brevo.invalid>'})
})
it('never requeues a transport failure',async()=>{
  fetch.mockRejectedValue(new Error('network timeout'))
  expect((await run()).status).toBe(502)
  expect(state.rpc).toHaveBeenCalledWith('automation_finish_brevo_email',{p_id:'email',p_attempt:'attempt',p_status:'unknown',p_error:'SEND_OUTCOME_UNKNOWN',p_message_id:null})
  expect(fetch).toHaveBeenCalledTimes(1)
})
it('stops if acceptance cannot be saved',async()=>{
  state.rpc.mockImplementation(async name=>name==='automation_claim_brevo_email'?{data:[email]}:{error:{message:'db down'}})
  expect((await run()).status).toBe(500);expect(fetch).toHaveBeenCalledTimes(1)
})

it('does not send when the shared rolling quota is reached',async()=>{
  state.rpc.mockResolvedValue({error:{message:'BREVO_LOCAL_QUOTA_REACHED'}})
  const response=await run()
  expect(response.status).toBe(429)
  expect((await response.json()).error).toBe('BREVO_LOCAL_QUOTA_REACHED')
  expect(fetch).not.toHaveBeenCalled()
})
it('returns success for an empty queue without Brevo credentials',async()=>{
  state.pending=false;state.env={}
  expect((await run()).status).toBe(200)
  expect(fetch).not.toHaveBeenCalled();expect(state.rpc).not.toHaveBeenCalled()
})
it.each([408,500,502])('keeps HTTP %s uncertain with no automatic resend',async status=>{
  fetch.mockResolvedValue(new Response(null,{status}))
  await run()
  expect(state.rpc).toHaveBeenCalledWith('automation_finish_brevo_email',expect.objectContaining({p_status:'unknown'}))
  expect(fetch).toHaveBeenCalledTimes(1)
})
it('records malformed acceptance as uncertain',async()=>{
  fetch.mockResolvedValue(new Response('invalid JSON',{status:201}))
  await run()
  expect(state.rpc).toHaveBeenCalledWith('automation_finish_brevo_email',expect.objectContaining({p_status:'unknown'}))
})
it('only retries an explicit rate refusal',async()=>{
  fetch.mockResolvedValue(Response.json({code:'too_many_requests'},{status:429}))
  await run()
  expect(state.rpc).toHaveBeenCalledWith('automation_finish_brevo_email',expect.objectContaining({p_status:'pending',p_error:'BREVO_RATE_LIMITED'}))
})
it('sends one plain-text transactional email through Brevo',async()=>{
  await run()
  const [url,options]=fetch.mock.calls[0]
  expect(url).toBe('https://api.brevo.com/v3/smtp/email')
  expect(options.headers['api-key']).toBe('fixture')
  expect(JSON.parse(options.body)).toMatchObject({to:[{email:'test@example.invalid'}],textContent:'Fixture',replyTo:{email:'Tada-Wind@outlook.com'}})
})
