const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function validateContact(input) {
  if (!input || typeof input !== 'object' || !UUID.test(input.request_id || '')) throw new Error('INVALID_INPUT')
  if (input.website) return {honeypot:true}
  const field = (key, max, required=false) => {
    const value = input[key] ?? ''
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error('INVALID_INPUT')
    if (required && !value.trim()) throw new Error('INVALID_INPUT')
    return value.trim()
  }
  const email=field('email',254,true).toLowerCase()
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || input.rgpd !== true || typeof input.particulier !== 'boolean') throw new Error('INVALID_INPUT')
  const date=field('date_souhaitee',10)
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date)) throw new Error('INVALID_INPUT')
  const kind=field('type_besoin',40,true)
  if (!['patrimoine','immobilier','entreprise','nature','autre','tourisme','evenement'].includes(kind)) throw new Error('INVALID_INPUT')
  return {request_id:input.request_id,data:{
    prenom:field('prenom',100,true),nom:field('nom',100,true),email,
    telephone:field('telephone',40),ville_lieu:field('ville_lieu',200,true),
    date_souhaitee:date,type_besoin:kind,message:field('message',5000),
    particulier:input.particulier,nom_entreprise:field('nom_entreprise',200,!input.particulier),
  }}
}
export function contactEmails(data,reference) {
  return {
    internal:`Nouvelle demande depuis tadawind.com\n\nRéférence : ${reference}\nNom : ${data.prenom} ${data.nom}\nEmail : ${data.email}\nTéléphone : ${data.telephone || 'Non renseigné'}\nEntreprise : ${data.nom_entreprise || 'Non renseignée'}\nLieu : ${data.ville_lieu}\nDate : ${data.date_souhaitee || 'À définir'}\nBesoin : ${data.type_besoin}\n\n${data.message || 'Pas de message complémentaire.'}\n\nRetrouvez cette demande dans l’admin TadaWind.`,
    // Do not echo free-form input into the receipt: prevents abusing it as a spam relay.
    receipt:`Bonjour,\n\nVotre demande sur tadawind.com a bien été enregistrée sous la référence ${reference}.\nJe reviendrai vers vous pour préciser votre projet et sa faisabilité.\n\nTarik — TadaWind\nTada-Wind@outlook.com\nhttps://www.tadawind.com\n\nSi vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer ce message.`,
  }
}
export function emailOutcome(status) {
  if (status === 202) return {status:'accepted',error:null}
  if (status === 429) return {status:'pending',error:'GRAPH_RATE_LIMITED'}
  if (status >= 400 && status < 500 && status !== 408) return {status:'failed',error:'GRAPH_REJECTED'}
  return {status:'unknown',error:'SEND_OUTCOME_UNKNOWN'}
}
