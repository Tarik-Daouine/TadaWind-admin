import {validateMessage} from './schemas.js'

// Only quoted evidence survives from the generated prose. The server owns all other
// sentences, so a fact mislabeled as "generic" cannot bypass the evidence checks.
export function composeGroundedMessage(message, {channel, sources, prospectId, service}) {
  if (typeof service !== 'string' || !service.trim()) throw new Error('STRATEGY_MISSING')
  const fact = message.grounding.find(segment => segment.kind === 'fact')
  if (!fact) throw new Error('INVALID_GROUNDING')
  const quoted = fact.text.trim()
  const proof = message.sources_used.filter(item => item.path === fact.path && item.claim === fact.text)
  if(!proof.length || proof.some(item=>!item.evidence_quote.includes(quoted)))throw new Error('FACT_NOT_EXTRACTIVE')
  const proposal = `Je vous propose d’échanger autour d’une prestation « ${service} » pour votre communication.`
  const attribution = proof.every(item=>item.type==='website_page') ? 'Sur votre site, vous indiquez : « ' : 'Dans les informations recueillies, il est indiqué : « '
  const intro = 'Bonjour,\n\n' + attribution
  const quoteEnd = /[.!?…]$/.test(quoted) ? ' »' : ' ».'
  const close = quoteEnd + '\n\n'
  const cta = 'Seriez-vous disponible pour un court échange ?'
  let variants, grounding
  const generic = (path,text) => ({path,text,kind:'generic',source_ids:[]})
  const offer = (path,text) => ({path,text,kind:'proposal',source_ids:[]})
  const factAt = path => ({path,text:quoted,kind:'fact',source_ids:fact.source_ids})
  const factPath = channel === 'phone_script' ? 'phone_script.reason' : `${channel}.body`
  if(channel === 'phone_script') {
    variants = {phone_script:{opening:'Bonjour, je vous appelle pour Tada Wind.',reason:attribution+quoted+quoteEnd,proposal,objections:[],cta}}
    grounding = [generic('phone_script.opening',variants.phone_script.opening),generic(factPath,attribution),factAt(factPath),generic(factPath,quoteEnd),offer('phone_script.proposal',proposal),generic('phone_script.cta',cta)]
  } else {
    const body = intro + quoted + close + proposal + '\n\n' + cta + '\n\nTada Wind'
    variants = {[channel]:channel==='email'?{subject:'Une idée de contenu pour votre communication',body}:{body}}
    grounding = [generic(factPath,intro),factAt(factPath),generic(factPath,close),offer(factPath,proposal),generic(factPath,'\n\n'+cta+'\n\nTada Wind')]
    if(channel==='email')grounding.unshift(generic('email.subject',variants.email.subject))
  }
  return validateMessage({variants,grounding,sources_used:proof.map(item=>({...item,path:factPath,claim:quoted})),
    tone_check:{generic:false,fake_compliment:false,corporate:false},confidence:message.confidence},{channel,sources,prospectId})
}
