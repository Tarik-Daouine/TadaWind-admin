import {afterEach,beforeEach,expect,it,vi} from 'vitest'

const state=vi.hoisted(()=>({handler:null,connection:null,consumed:{data:{verifier_cipher:'cipher'},error:null},inserted:null,upserted:null,verifier:'verifier',user:'owner'}))
vi.mock('../../../supabase/functions/_shared/prospector/automation-runtime.ts',()=>({
  json:(body,status=200)=>Response.json(body,{status}),cors:(_request,response)=>response,
  sha:async value=>`hash:${value}`,encrypt:async value=>`encrypted:${value}`,decrypt:async()=>state.verifier,
  requireAdmin:async()=>state.user,
  serviceClient:()=>({from:table=>table==='automation_connections'?{
    select:()=>({eq:()=>({maybeSingle:async()=>({data:state.connection,error:null})})}),
    upsert:async row=>{state.upserted=row;return{error:null}},
  }:{
    delete:()=>({
      lt:async()=>({error:null}),
      eq:()=>({gt:()=>({select:()=>({maybeSingle:async()=>state.consumed})})}),
    }),
    insert:async row=>{state.inserted=row;return{error:null}},
  }}),
}))

beforeEach(async()=>{
  vi.resetModules();state.connection=null;state.inserted=null;state.upserted=null;state.user='owner';state.consumed={data:{verifier_cipher:'cipher'},error:null}
  vi.stubGlobal('Deno',{serve:fn=>{state.handler=fn},env:{get:name=>({
    SUPABASE_URL:'https://project.supabase.co',MS_OAUTH_CLIENT_ID:'client',MS_OAUTH_CLIENT_SECRET:'secret',AUTOMATION_ENCRYPTION_KEY:'key',
  })[name]}})
  vi.stubGlobal('fetch',vi.fn())
  await import('../../../supabase/functions/automation-outlook/index.ts')
})
afterEach(()=>vi.unstubAllGlobals())

const post=body=>state.handler(new Request('https://project.supabase.co/functions/v1/automation-outlook',{
  method:'POST',headers:{authorization:'Bearer admin','content-type':'application/json'},body:JSON.stringify(body),
}))

it('exposes connection state without exposing Microsoft credentials',async()=>{
  state.connection={sender:'tada-wind@outlook.com',updated_at:'2026-09-16T10:00:00Z'}
  const response=await post({action:'status'}),body=await response.json()
  expect(body).toEqual({app_configured:true,connected:true,sender:'tada-wind@outlook.com',updated_at:'2026-09-16T10:00:00Z'})
  expect(JSON.stringify(body)).not.toContain('secret')
})

it('creates a short-lived server-side PKCE state and a consumers consent URL',async()=>{
  const response=await post({action:'connect'}),body=await response.json(),url=new URL(body.url)
  expect(url.origin).toBe('https://login.microsoftonline.com')
  expect(url.pathname).toContain('/consumers/oauth2/v2.0/authorize')
  expect(url.searchParams.get('scope')).toContain('Mail.Send')
  expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  expect(url.searchParams.has('client_secret')).toBe(false)
  expect(state.inserted.created_by).toBe('owner')
  expect(state.inserted.verifier_cipher).toMatch(/^encrypted:/)
})

it('accepts only the fixed personal mailbox on the callback',async()=>{
  fetch.mockResolvedValueOnce(Response.json({access_token:'access',refresh_token:'refresh',expires_in:3600,scope:'Mail.Send User.Read'}))
    .mockResolvedValueOnce(Response.json({mail:'other@outlook.com'}))
  const stateValue='a'.repeat(64)
  const response=await state.handler(new Request(`https://project.supabase.co/functions/v1/automation-outlook?state=${stateValue}&code=code`))
  expect(response.headers.get('location')).toContain('outlook=wrong_account')
  expect(state.upserted).toBe(null)
})

it('stores encrypted tokens after Microsoft confirms the expected mailbox',async()=>{
  fetch.mockResolvedValueOnce(Response.json({access_token:'access',refresh_token:'refresh',expires_in:3600,scope:'Mail.Send User.Read'}))
    .mockResolvedValueOnce(Response.json({mail:'Tada-Wind@outlook.com'}))
  const response=await state.handler(new Request(`https://project.supabase.co/functions/v1/automation-outlook?state=${'b'.repeat(64)}&code=code`))
  expect(response.headers.get('location')).toContain('outlook=connected')
  expect(state.upserted).toMatchObject({id:'outlook',sender:'tada-wind@outlook.com'})
  expect(state.upserted.token_cipher).toMatch(/^encrypted:/)
  expect(state.upserted.token_cipher).not.toBe('access')
})
