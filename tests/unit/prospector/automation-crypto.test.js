import {it,expect,vi,afterEach} from 'vitest'
vi.mock('npm:@supabase/supabase-js@2.100.0',()=>({createClient:vi.fn()}))
import {encrypt,decrypt} from '../../../supabase/functions/_shared/prospector/automation-runtime.ts'
afterEach(()=>vi.unstubAllGlobals())
it('encrypts backend credentials with randomized authenticated encryption',async()=>{
  vi.stubGlobal('Deno',{env:{get:()=>Buffer.alloc(32,7).toString('base64')}})
  const a=await encrypt('fixture-token'),b=await encrypt('fixture-token')
  expect(a).not.toBe(b);expect(a).not.toContain('fixture-token');expect(await decrypt(a)).toBe('fixture-token')
  const [iv,body]=a.split('.');const tampered=body[0]==='A'?'B':'A'
  await expect(decrypt(iv+'.'+tampered+body.slice(1))).rejects.toThrow()
})
it('fails closed without the encryption secret',async()=>{
  vi.stubGlobal('Deno',{env:{get:()=>undefined}})
  await expect(encrypt('fixture-token')).rejects.toThrow('AUTOMATION_NOT_CONFIGURED')
})
