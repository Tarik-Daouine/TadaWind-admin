import {it,expect,vi,beforeEach,afterEach} from 'vitest'
const state=vi.hoisted(()=>({handler:null,auth:vi.fn(),query:vi.fn(),env:{}}))
vi.mock('../../../supabase/functions/_shared/prospector/automation-runtime.ts',()=>({
  json:(data,status=200)=>Response.json(data,{status}),cors:(_,response)=>response,requireAdmin:state.auth,
  serviceClient:()=>({from:()=>({select:()=>({gt:state.query})})}),
}))
beforeEach(async()=>{
  vi.resetModules();state.auth.mockReset().mockResolvedValue('admin');state.query.mockReset().mockResolvedValue({count:300,error:null})
  state.env={BREVO_API_KEY:'private-fixture',BREVO_SENDER_EMAIL:'contact@tadawind.com'}
  vi.stubGlobal('Deno',{serve:fn=>{state.handler=fn},env:{get:name=>state.env[name]}})
  await import('../../../supabase/functions/automation-status/index.ts')
})
afterEach(()=>vi.unstubAllGlobals())
const run=()=>state.handler(new Request('http://local',{method:'POST'}))
it('does not expose setup status to unauthenticated callers',async()=>{
  state.auth.mockRejectedValue(new Error('UNAUTHORIZED'))
  expect((await run()).status).toBe(401);expect(state.query).not.toHaveBeenCalled()
})
it('returns quota and setup without exposing the key or claiming delivery readiness',async()=>{
  const body=await (await run()).json()
  expect(body).toEqual({provider:'brevo',configured:true,sender:'contact@tadawind.com',contact_enabled:false,attempts_24h:300,limit_24h:300})
  expect(JSON.stringify(body)).not.toContain('private-fixture')
})
it('fails explicitly when the quota cannot be read',async()=>{
  state.query.mockResolvedValue({error:{message:'database failure'}})
  expect((await run()).status).toBe(503)
})
