// Transactional contact emails only. Never reuse this adapter for cold outreach.
export function brevoConfig(get) {
  const apiKey = get('BREVO_API_KEY') || ''
  const sender = (get('BREVO_SENDER_EMAIL') || '').trim().toLowerCase()
  if (!apiKey || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@tadawind\.com$/.test(sender)) return null
  return {apiKey, sender}
}

export function brevoMessage(email, sender) {
  if (!['contact_internal','contact_receipt'].includes(email.kind)) throw new Error('UNSUPPORTED_EMAIL_KIND')
  return {
    sender:{name:'TadaWind',email:sender}, to:[{email:email.recipient}],
    subject:email.subject, textContent:email.body,
    replyTo:{name:'TadaWind',email:'Tada-Wind@outlook.com'},
    headers:{'X-TadaWind-Outbox-Id':email.id}, tags:['tadawind-contact'],
  }
}

export function brevoOutcome(status, body) {
  if (status===201 && typeof body?.messageId==='string' && body.messageId.length>0 && body.messageId.length<=500) {
    return {status:'accepted',error:null,messageId:body.messageId}
  }
  if (status===429) return {status:'pending',error:'BREVO_RATE_LIMITED',messageId:null}
  if (status>=400 && status<500 && status!==408) {
    return {status:'failed',error:status===401 || status===403?'BREVO_AUTH_FAILED':body?.code==='not_enough_credits'?'BREVO_QUOTA_EXHAUSTED':'BREVO_REJECTED',messageId:null}
  }
  return {status:'unknown',error:'SEND_OUTCOME_UNKNOWN',messageId:null}
}
