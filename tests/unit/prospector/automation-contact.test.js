import {it,expect} from 'vitest'
import {validateContact,contactEmails,emailOutcome} from '../../../supabase/functions/_shared/prospector/automation-contact.js'
const input=()=>({request_id:'11111111-1111-4111-8111-111111111111',prenom:'Test',nom:'Local',email:'test@example.invalid',ville_lieu:'Sarlat',type_besoin:'entreprise',particulier:true,rgpd:true})
it('accepts unknown date and discards client-controlled CRM fields',()=>{
  const contact=validateContact({...input(),Statut:'gagne',recipient:'other@example.invalid'})
  expect(contact.data.date_souhaitee).toBe('');expect(contact.data).not.toHaveProperty('recipient');expect(contact.data).not.toHaveProperty('Statut')
})
it.each([{rgpd:false},{email:'a\nb@example.org'},{date_souhaitee:'2026-02-30'},{message:'x'.repeat(5001)},{particulier:false},{request_id:'invalid'}])('rejects invalid request %j',patch=>{
  expect(()=>validateContact({...input(),...patch})).toThrow('INVALID_INPUT')
})
it('does not echo arbitrary message or name into visitor receipt',()=>{
  const data=validateContact({...input(),message:'Click malicious.example',prenom:'Injected content'}).data
  const mail=contactEmails(data,'reference');expect(mail.internal).toContain('Click malicious.example');expect(mail.receipt).not.toContain('malicious');expect(mail.receipt).not.toContain('Injected')
})
it('discards the honeypot',()=>expect(validateContact({...input(),website:'bot'})).toEqual({honeypot:true}))
it.each([408,500,503,200,302])('never retries ambiguous HTTP %s',code=>expect(emailOutcome(code).status).toBe('unknown'))
it('retries only explicit rate rejection and distinguishes acceptance',()=>{
  expect(emailOutcome(429).status).toBe('pending');expect(emailOutcome(202).status).toBe('accepted');expect(emailOutcome(403).status).toBe('failed')
})
