import {it,expect} from 'vitest'
import {brevoConfig,brevoMessage,brevoOutcome} from '../../../supabase/functions/_shared/prospector/brevo.js'
it('requires a secret and a sender owned by TadaWind',()=>{
  for(const sender of ['','contact@tadawind.com.attacker.test','test@outlook.com','a\r\nb@tadawind.com']) {
    expect(brevoConfig(n=>n==='BREVO_API_KEY'?'secret':sender)).toBeNull()
  }
  expect(brevoConfig(n=>n==='BREVO_SENDER_EMAIL'?'contact@tadawind.com':undefined)).toBeNull()
  expect(brevoConfig(n=>n==='BREVO_API_KEY'?'secret':'Contact@TadaWind.com')).toEqual({apiKey:'secret',sender:'contact@tadawind.com'})
})
it('refuses to send prospecting messages with the transactional adapter',()=>{
  expect(()=>brevoMessage({kind:'prospector'},'contact@tadawind.com')).toThrow('UNSUPPORTED_EMAIL_KIND')
})
it.each([200,202,204,301,408,500])('does not treat an unexpected HTTP %s as proof of acceptance',status=>{
  expect(brevoOutcome(status,{messageId:'id'}).status).toBe('unknown')
})
it('requires a bounded provider receipt and never stores raw provider errors',()=>{
  expect(brevoOutcome(201,{}).status).toBe('unknown')
  expect(brevoOutcome(201,{messageId:'x'.repeat(501)}).status).toBe('unknown')
  expect(brevoOutcome(401,{message:'sensitive provider detail'})).toEqual({status:'failed',error:'BREVO_AUTH_FAILED',messageId:null})
  expect(brevoOutcome(400,{code:'not_enough_credits'}).error).toBe('BREVO_QUOTA_EXHAUSTED')
})
