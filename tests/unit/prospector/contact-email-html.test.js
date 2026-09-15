import {it,expect} from 'vitest'
import {contactReceiptHtml,contactInternalHtml} from '../../../supabase/functions/_shared/prospector/contact-email-html.js'
import {brevoMessage} from '../../../supabase/functions/_shared/prospector/brevo.js'
const data={prenom:'Camille',ville_lieu:'Saint-Cyprien',date_souhaitee:'2026-10-19',type_besoin:'nature',message:'PRIVATE MESSAGE'}
it('restores the original receipt identity and personalized summary',()=>{
  const html=contactReceiptHtml(data)
  for(const text of ['#171a21','#e10600','logo-full.png','DEMANDE BIEN REÇUE','Camille','Saint-Cyprien','19/10/2026','24 à 48 heures','Télépilote professionnel UAS'])expect(html).toContain(text)
  expect(html).not.toContain('PRIVATE MESSAGE')
  expect(html).not.toContain('Melvin')
})
it('escapes every user field and keeps arbitrary message text out of the receipt',()=>{
  const html=contactReceiptHtml({...data,prenom:'<img src=x onerror=alert(1)>',ville_lieu:'A & B',type_besoin:'<script>'})
  expect(html).not.toContain('<img src=x');expect(html).toContain('&lt;img');expect(html).toContain('A &amp; B');expect(html).not.toContain('<script>')
  expect(contactInternalHtml('hello\n<script>')).toContain('hello<br>&lt;script&gt;')
})
it('handles an unspecified date',()=>expect(contactReceiptHtml({...data,date_souhaitee:''})).toContain('À définir'))
it('passes HTML and plain text to Brevo without changing routing',()=>{
  const email={id:'fixture',kind:'contact_receipt',recipient:'test@example.invalid',subject:'Confirmation',body:'Plain',html_body:contactReceiptHtml(data)}
  expect(brevoMessage(email,'contact@tadawind.com')).toMatchObject({htmlContent:email.html_body,textContent:'Plain',to:[{email:'test@example.invalid'}]})
  expect(brevoMessage({...email,html_body:null},'contact@tadawind.com')).not.toHaveProperty('htmlContent')
})
