import React, { useEffect, useMemo, useState } from 'react'
import Button from '../ui/Button.jsx'
import { SectionCard, SectionTitle } from '../ui/SectionCard.jsx'
import { copyTadaWindEmailToClipboard, TADA_WIND_SIGNATURE_TEXT } from '../../lib/prospector/emailSignature.js'
import { describeSendAvailability } from '../../lib/prospector/emailSend.js'

export const CHANNEL_LABELS = {
  email: 'Email',
  instagram_dm: 'DM Instagram',
  linkedin: 'LinkedIn',
  phone_script: 'Script téléphone',
}

// La stratégie recommande un canal (« phone ») ; les brouillons portent « phone_script ».
export const channelFromStrategy = (value) => (value === 'phone' ? 'phone_script' : value)

const inputStyle = {
  width: '100%',
  background: 'var(--s3)',
  border: '1px solid var(--border-md)',
  borderRadius: 'var(--radius)',
  color: 'var(--text)',
  fontFamily: 'var(--sans)',
  fontSize: 13,
  lineHeight: 1.7,
  padding: '10px 12px',
  outline: 'none',
  boxSizing: 'border-box',
  resize: 'vertical',
}

function StatusChip({ message }) {
  const map = {
    approved: ['Approuvé', 'var(--green)', 'var(--green-dim)'],
    draft: ['Brouillon', 'var(--amber)', 'var(--amber-dim)'],
    edited: ['Modifié', 'var(--amber)', 'var(--amber-dim)'],
    rejected: ['Refusé', 'var(--red)', 'var(--red-dim)'],
  }
  const [label, color, background] = map[message.status] ?? [message.status, 'var(--gray)', 'var(--gray-dim)']
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 20, color, background }}>
      {label}{message.revision > 1 ? ` · rév. ${message.revision}` : ''}
    </span>
  )
}

/** Preuves : ce que le message affirme, en regard de l'extrait de source qui le justifie. */
function Citations({ message }) {
  const citations = Array.isArray(message.sources_used) ? message.sources_used : []
  if (!citations.length) {
    return (
      <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
        Aucun constat sourcé dans cette version. Le texte est entièrement de toi — rien n’est attribué au prospect par le système.
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {citations.map((citation, index) => (
        <div key={`${citation.source_id}-${index}`} style={{ borderLeft: '2px solid var(--blue)', paddingLeft: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>« {citation.claim} »</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6, marginTop: 3 }}>
            Source {citation.type} : « {citation.evidence_quote} »
          </div>
          {citation.url && (
            <a href={citation.url} target="_blank" rel="noreferrer"
              style={{ fontSize: 10, color: 'var(--blue)', wordBreak: 'break-all' }}>{citation.url}</a>
          )}
        </div>
      ))}
    </div>
  )
}

function PhoneScript({ script }) {
  if (!script) return null
  const objections = Array.isArray(script.objections) ? script.objections : []
  if (!objections.length) return null
  return (
    <SectionCard>
      <SectionTitle>Objections préparées</SectionTitle>
      {objections.map((item, index) => (
        <div key={index} style={{ fontSize: 12, lineHeight: 1.65, marginBottom: 8 }}>
          <div style={{ color: 'var(--muted)' }}>— {item.objection}</div>
          <div style={{ color: 'var(--text)' }}>→ {item.response}</div>
        </div>
      ))}
      <div style={{ fontSize: 10, color: 'var(--muted2)' }}>Hypothèses proposées par l’IA, pas des réactions réelles du prospect.</div>
    </SectionCard>
  )
}

export default function MessageEditor({ messages, recommended, onSave, onApprove, onConfirmSent, onSendEmail, sendConfig, recipient, busy, onToast }) {
  const available = messages ?? []
  const [channel, setChannel] = useState(null)
  const [draft, setDraft] = useState({ subject: '', body: '' })
  const [sentRef, setSentRef] = useState('')
  // L'envoi réel demande deux clics : le premier arme, le second part. Aucun
  // premier contact ne peut donc sortir d'un clic isolé ou répété par erreur.
  const [armed, setArmed] = useState(false)

  const current = useMemo(
    () => available.find(item => item.channel === channel) ?? available[0] ?? null,
    [available, channel],
  )

  // Sélection initiale : le canal recommandé s'il existe encore parmi les brouillons.
  useEffect(() => {
    if (!available.length) { setChannel(null); return }
    const preferred = available.some(item => item.channel === recommended) ? recommended : available[0].channel
    setChannel(preferred)
  }, [available.map(item => item.id).join(','), recommended])

  useEffect(() => {
    setDraft({ subject: current?.subject ?? '', body: current?.body ?? '' })
    setSentRef('')
    setArmed(false)
  }, [current?.id, current?.revision])

  if (!current) {
    return (
      <SectionCard>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
          Aucun brouillon disponible pour ce prospect. Choisis un canal ci-dessus pour en préparer un.
        </div>
      </SectionCard>
    )
  }

  const dirty = (draft.subject ?? '') !== (current.subject ?? '') || (draft.body ?? '') !== (current.body ?? '')

  // La copie peut échouer (permission refusée, contexte non sécurisé) : on le dit,
  // plutôt que de laisser croire que le message est dans le presse-papiers.
  const handleCopy = async () => {
    try {
      if (current.channel === 'email') {
        const { format } = await copyTadaWindEmailToClipboard(current.body)
        onToast?.(format === 'html' ? 'Message et signature copiés' : 'Message copié en texte seul (signature incluse)', 'success')
        return
      }
      const plain = [current.subject, current.body].filter(Boolean).join('\n\n')
      if (!navigator?.clipboard?.writeText) throw new Error('CLIPBOARD_UNAVAILABLE')
      await navigator.clipboard.writeText(plain)
      onToast?.('Message copié', 'success')
    } catch (error) {
      onToast?.(error?.message === 'CLIPBOARD_UNAVAILABLE'
        ? 'Le presse-papiers n’est pas disponible ici. Sélectionne le texte et copie-le manuellement.'
        : 'Copie refusée par le navigateur. Autorise le presse-papiers, ou copie le texte manuellement.', 'error')
    }
  }
  const approved = current.status === 'approved'
  // Le bouton d'envoi ne s'active que si le serveur déclare Microsoft Graph
  // configuré. Le front n'apprend jamais les identifiants, seulement ce verdict.
  const { sendable: canSend, reason: sendReason } = describeSendAvailability({
    sendLockAt: current.send_lock_at,
    channel: current.channel, sendConfig, recipient, approved,
  })
  const sendable = canSend && Boolean(onSendEmail)

  return (
    <>
      <div role="tablist" aria-label="Canal du message"
        style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
        {available.map(item => {
          const active = item.id === current.id
          return (
            <button key={item.id} role="tab" aria-selected={active} onClick={() => setChannel(item.channel)}
              style={{
                border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border)'}`,
                background: active ? 'var(--s3)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--muted)',
                borderRadius: 999, padding: '5px 12px', fontSize: 12, fontFamily: 'var(--sans)', cursor: 'pointer',
              }}>
              {CHANNEL_LABELS[item.channel] ?? item.channel}
              {item.channel === recommended && <span style={{ color: 'var(--green)', marginLeft: 6 }}>●</span>}
            </button>
          )
        })}
      </div>

      <SectionCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
          <SectionTitle>{CHANNEL_LABELS[current.channel] ?? current.channel}</SectionTitle>
          <StatusChip message={current} />
        </div>

        {current.channel === 'email' && (
          <label style={{ display: 'block', marginBottom: 10 }}>
            <span style={{ display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 5 }}>Objet</span>
            <input value={draft.subject} onChange={event => setDraft(previous => ({ ...previous, subject: event.target.value }))}
              style={inputStyle} aria-label="Objet du message" />
          </label>
        )}

        <label style={{ display: 'block' }}>
          <span style={{ display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 5 }}>Message</span>
          <textarea value={draft.body} rows={current.channel === 'instagram_dm' ? 6 : 12}
            onChange={event => setDraft(previous => ({ ...previous, body: event.target.value }))}
            style={inputStyle} aria-label="Corps du message" />
        </label>

        {current.channel === 'email' && (
          <div style={{ marginTop: 10, padding: '9px 11px', border: '1px solid var(--border)', background: 'var(--s2)', borderRadius: 'var(--radius)', fontSize: 11, color: 'var(--muted)', lineHeight: 1.55, whiteSpace: 'pre-line' }}>
            <strong style={{ color: 'var(--text)' }}>Signature ajoutée automatiquement à l’envoi :</strong>{'\n'}{TADA_WIND_SIGNATURE_TEXT}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <Button size="sm" onClick={() => setDraft({ subject: current.subject ?? '', body: current.body ?? '' })} disabled={!dirty || busy}>
            Annuler mes modifications
          </Button>
          <Button variant="ghost" size="sm" loading={busy === 'save'} disabled={!dirty || (busy && busy !== 'save')}
            onClick={() => onSave(current, { subject: draft.subject, body: draft.body })}>
            Enregistrer
          </Button>
          <div style={{ flex: 1 }} />
          {!approved && (
            <Button variant="primary" size="sm" loading={busy === 'approve'} disabled={dirty || (busy && busy !== 'approve')}
              title={dirty ? 'Enregistre d’abord tes modifications' : undefined}
              onClick={() => onApprove(current)}>
              ✅ Approuver ce message
            </Button>
          )}
        </div>
        {dirty && (
          <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 8, lineHeight: 1.5 }}>
            Modifications non enregistrées. En enregistrant, tu deviens l’auteur de cette version : les citations dont la phrase a disparu du texte sont retirées automatiquement.
          </div>
        )}
      </SectionCard>

      {approved && (
        <SectionCard borderColor="rgba(34,197,94,0.35)">
          <SectionTitle accent="var(--green)" accentDim="rgba(34,197,94,0.25)">Envoi — action manuelle</SectionTitle>
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.65, marginBottom: 10 }}>
            Rien ne part sans ton clic. Le bouton « Copier » ajoute automatiquement la signature Tada Wind en HTML et en texte avant collage dans Outlook.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={sentRef} onChange={event => setSentRef(event.target.value)} placeholder="Référence (facultatif) : objet, lien, n° de conversation…"
              aria-label="Référence de l’envoi" style={{ ...inputStyle, flex: 1, minWidth: 220, fontSize: 12, padding: '7px 10px' }} />
            <Button size="sm" onClick={handleCopy}>Copier</Button>
            <Button variant="primary" size="sm" loading={busy === 'sent'} disabled={busy && busy !== 'sent'}
              onClick={() => onConfirmSent(current, sentRef)}>
              Je l’ai envoyé
            </Button>
          </div>

          {current.channel === 'email' && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.65, marginBottom: 9 }}>
                {sendable
                  ? <>Envoi direct depuis <strong style={{ color: 'var(--text)' }}>{sendConfig.sender ?? 'la boîte Tada Wind'}</strong> vers {recipient ? <strong style={{ color: 'var(--text)' }}>{recipient}</strong> : 'le contact du prospect'}. Le message part tel quel, signature comprise.</>
                  : sendReason}
              </div>
              <Button variant={armed ? 'danger' : 'primary'} size="sm" loading={busy === 'send'}
                disabled={!sendable || (busy && busy !== 'send')}
                title={sendable ? undefined : sendReason}
                onClick={() => {
                  if (!armed) { setArmed(true); return }
                  setArmed(false)
                  onSendEmail(current)
                }}>
                {armed ? `Confirmer l’envoi${recipient ? ` à ${recipient}` : ''}` : '📤 Envoyer depuis Outlook'}
              </Button>
              {armed && (
                <Button size="sm" onClick={() => setArmed(false)} disabled={busy === 'send'} style={{ marginLeft: 8 }}>Annuler</Button>
              )}
            </div>
          )}
        </SectionCard>
      )}

      {current.channel === 'phone_script' && <PhoneScript script={current.variables?.phone_script} />}

      <SectionCard>
        <SectionTitle accent="var(--blue)" accentDim="rgba(79,127,243,0.25)">Sources utilisées pour la personnalisation</SectionTitle>
        <Citations message={current} />
      </SectionCard>
    </>
  )
}
