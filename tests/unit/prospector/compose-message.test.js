import {it,expect} from 'vitest'
import {composeGroundedMessage} from '../../../supabase/functions/_shared/prospector/compose-message.js'
import {messageFixture,sources,prospectId} from './fixtures.js'
import {validateCopywriteSelection} from '../../../supabase/functions/_shared/prospector/schemas.js'
it('accepts a literal selection and rejects invented or extra provider fields',()=>{
  const selection={source_id:sources[0].id,evidence_quote:sources[0].content_excerpt.slice(0,80),confidence:0.8}
  const context={sources,prospectId}
  expect(validateCopywriteSelection(selection,context).sources_used[0].url).toBe(sources[0].url)
  expect(()=>validateCopywriteSelection({...selection,evidence_quote:'Une piscine avec une description inventée'},context)).toThrow('INVALID_CITATION_QUOTE')
  expect(()=>validateCopywriteSelection({...selection,source_id:'00000000-0000-4000-8000-000000000000'},context)).toThrow('INVALID_CITATION_SOURCE')
  expect(()=>validateCopywriteSelection({...selection,url:'https://wrong.invalid'},context)).toThrow()
})
it.each(['email','instagram_dm','linkedin','phone_script'])('removes unsupported generic prose in %s and preserves exact evidence',channel=>{
  const message=messageFixture()
  const fact=message.grounding.find(s=>s.kind==='fact')
  const citations=message.sources_used.filter(s=>s.path===fact.path&&s.claim===fact.text)
  const quote=citations[0].evidence_quote
  const input={...message,grounding:[{...fact,text:quote},{path:'email.body',kind:'generic',source_ids:[],text:'Votre piscine est immense et votre site ne contient aucune vidéo.'}],sources_used:citations.map(c=>({...c,claim:quote}))}
  const output=composeGroundedMessage(input,{channel,sources,prospectId,service:'Vidéo promotionnelle'})
  expect(JSON.stringify(output)).not.toContain('piscine est immense')
  expect(JSON.stringify(output)).not.toContain('aucune vidéo')
  expect(output.sources_used[0].claim).toBe(quote)
  expect(Object.keys(output.variants)).toEqual([channel])
})
