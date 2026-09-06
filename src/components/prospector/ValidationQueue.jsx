import React, { useEffect, useMemo, useState } from 'react'
import Button from '../ui/Button.jsx'
import Modal from '../ui/Modal.jsx'
import { SectionCard, SectionTitle } from '../ui/SectionCard.jsx'
import { useIsMobile } from '../../hooks/useIsMobile.js'
import { REJECTION_REASONS, useProspectorValidation } from '../../hooks/useProspectorValidation.js'
import ChannelGeneration from './ChannelGeneration.jsx'
import MessageEditor, { CHANNEL_LABELS, channelFromStrategy } from './MessageEditor.jsx'

const PRIORITY = {
  hot: ['🔥 Très chaud', 'var(--red)', 'var(--red-dim)'],
  good: ['🟢 Bon prospect', 'var(--green)', 'var(--green-dim)'],
  consider: ['🟡 À considérer', 'var(--amber)', 'var(--amber-dim)'],
  low: ['⚪ Faible priorité', 'var(--gray)', 'var(--gray-dim)'],
  excluded: ['🔴 À exclure', 'var(--red)', 'var(--red-dim)'],
}

function PriorityChip({ value }) {
  const [label, color, background] = PRIORITY[value] ?? ['Non scoré', 'var(--gray)', 'var(--gray-dim)']
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 20, color, background, whiteSpace: 'nowrap' }}>{label}</span>
}

function QueueRow({ prospect, active, count, onSelect }) {
  return (
    <button onClick={onSelect} aria-current={active}
      style={{
        display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
        borderBottom: '1px solid var(--border)', padding: '11px 14px', fontFamily: 'var(--sans)',
        background: active ? 'var(--red-dim)' : 'transparent',
      }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: prospect.score == null ? 'var(--muted2)' : 'var(--text)', minWidth: 34 }}>
          {prospect.score == null ? '—' : prospect.score}
        </span>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {prospect.name}
        </span>
        {count > 1 && <span style={{ fontSize: 10, color: 'var(--muted2)' }}>{count} canaux</span>}
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
        {[prospect.city, prospect.category, prospect.distance_km == null ? null : `${prospect.distance_km} km`].filter(Boolean).join(' · ') || '—'}
      </div>
    </button>
  )
}

function ReasonModal({ open, title, intro, confirmLabel, danger, onClose, onConfirm, busy }) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  useEffect(() => { if (open) { setReason(''); setNote('') } }, [open])
  const value = reason === 'autre' ? note.trim() : reason
  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={title} size="sm"
      footer={<>
        <Button onClick={onClose} disabled={busy}>Annuler</Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={busy} disabled={!value} onClick={() => onConfirm(value)}>{confirmLabel}</Button>
      </>}>
      <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.65, marginBottom: 14 }}>{intro}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {REJECTION_REASONS.map(([key, label]) => (
          <button key={key} onClick={() => setReason(key)}
            style={{
              border: `1px solid ${reason === key ? 'var(--border-strong)' : 'var(--border)'}`,
              background: reason === key ? 'var(--s3)' : 'transparent',
              color: reason === key ? 'var(--text)' : 'var(--muted)',
              borderRadius: 999, padding: '5px 11px', fontSize: 12, fontFamily: 'var(--sans)', cursor: 'pointer',
            }}>{label}</button>
        ))}
      </div>
      {reason === 'autre' && (
        <input value={note} onChange={event => setNote(event.target.value)} autoFocus placeholder="Précise le motif"
          aria-label="Motif détaillé"
          style={{ marginTop: 12, width: '100%', background: 'var(--s3)', border: '1px solid var(--border-md)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '8px 11px', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none', boxSizing: 'border-box' }} />
      )}
    </Modal>
  )
}

export default function ValidationQueue({ onToast, onOpenProspect }) {
  const mobile = useIsMobile()
  const queue = useProspectorValidation()
  const [selectedId, setSelectedId] = useState(null)
  const [busy, setBusy] = useState(null)
  const [modal, setModal] = useState(null)

  const selected = useMemo(
    () => queue.prospects.find(item => item.id === selectedId) ?? queue.prospects[0] ?? null,
    [queue.prospects, selectedId],
  )
  const drafts = selected ? (queue.messages[selected.id] ?? []) : []
  const recommended = channelFromStrategy(selected?.strategy?.recommended_channel)
  const index = selected ? queue.prospects.findIndex(item => item.id === selected.id) : -1

  useEffect(() => { if (selected && selected.id !== selectedId) setSelectedId(selected.id) }, [selected, selectedId])

  const run = async (key, action, successMessage) => {
    setBusy(key)
    const result = await action()
    setBusy(null)
    if (result?.error) onToast?.(result.error, 'error')
    else if (successMessage) onToast?.(successMessage, 'success')
    return result
  }

  const step = (delta) => {
    if (queue.prospects.length < 2) return
    const next = (index + delta + queue.prospects.length) % queue.prospects.length
    setSelectedId(queue.prospects[next].id)
  }

  // Raccourcis du mode batch — inactifs dès qu'on saisit du texte ou qu'une modale est ouverte.
  useEffect(() => {
    const handler = (event) => {
      if (modal || busy) return
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'j' || event.key === 'ArrowDown') { event.preventDefault(); step(1) }
      if (event.key === 'k' || event.key === 'ArrowUp') { event.preventDefault(); step(-1) }
      if (event.key === 'l' && selected) { event.preventDefault(); run('later', () => queue.snooze(selected, drafts[0]), 'Reporté de 7 jours') }
      if (event.key === 'x' && selected) { event.preventDefault(); setModal('reject') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [modal, busy, index, queue.prospects, selected, drafts])

  if (queue.loading) return <Centered>Chargement de la file…</Centered>
  if (queue.error && !queue.prospects.length) return <Centered>{queue.error}</Centered>
  if (!queue.prospects.length) {
    return (
      <Centered>
        <strong style={{ color: 'var(--text)', fontSize: 14 }}>Aucun message à valider</strong>
        <span>Les brouillons sourcés apparaîtront ici. Aucun premier contact n’est envoyé sans ta validation.</span>
        <Button size="sm" onClick={queue.reload}>Recharger</Button>
      </Centered>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', overflow: 'hidden' }}>
      {(!mobile || !selected) && (
        <div style={{ width: mobile ? '100%' : 'min(300px, 26vw)', flexShrink: 0, borderRight: mobile ? 'none' : '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{queue.prospects.length} à valider</span>
            <Button size="sm" onClick={queue.reload}>Recharger</Button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {queue.prospects.map(prospect => (
              <QueueRow key={prospect.id} prospect={prospect} active={prospect.id === selected?.id}
                count={(queue.messages[prospect.id] ?? []).length} onSelect={() => setSelectedId(prospect.id)} />
            ))}
          </div>
          {!mobile && (
            <div style={{ padding: '9px 14px', borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--muted2)', lineHeight: 1.6 }}>
              Raccourcis : <b>J</b>/<b>K</b> naviguer · <b>L</b> plus tard · <b>X</b> refuser
            </div>
          )}
        </div>
      )}

      {selected && (
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: mobile ? '14px' : '20px 24px' }}>
          {mobile && <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 0, color: 'var(--muted)', fontSize: 11, cursor: 'pointer', padding: 0, marginBottom: 10 }}>← Retour à la file</button>}

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 400, color: 'var(--text)' }}>{selected.name}</h2>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                {[selected.category, selected.city, selected.distance_km == null ? null : `${selected.distance_km} km`].filter(Boolean).join(' · ') || '—'}
                {index >= 0 && <span style={{ color: 'var(--muted2)' }}> · {index + 1}/{queue.prospects.length}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <PriorityChip value={selected.priority} />
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
                {selected.score == null ? '—' : <>{selected.score}<span style={{ fontSize: 13, color: 'var(--muted2)', fontWeight: 400 }}>/100</span></>}
              </div>
            </div>
          </div>

          <SectionCard>
            <SectionTitle>Pourquoi ce prospect</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
              {(selected.score_reasons ?? []).length
                ? selected.score_reasons.map(reason => <div key={reason}>• {reason}</div>)
                : <div>Ce prospect n’a pas encore de ventilation de score.</div>}
            </div>
            {recommended && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
                Canal recommandé : <strong style={{ color: 'var(--text)' }}>{CHANNEL_LABELS[recommended] ?? recommended}</strong>
              </div>
            )}
            {onOpenProspect && (
              <div style={{ marginTop: 10 }}>
                <Button size="sm" onClick={() => onOpenProspect(selected.id)}>Ouvrir la fiche complète</Button>
              </div>
            )}
          </SectionCard>

          <ChannelGeneration key={selected.id} prospect={selected} messages={drafts} recommended={recommended} busy={busy}
            onGenerate={channel => run('regenerate', () => queue.regenerate(selected, channel), 'Brouillon ajouté à la file de traitement. Actualise après le prochain cycle.')} />
          <MessageEditor
            messages={drafts}
            recommended={recommended}
            busy={busy}
            onSave={(message, patch) => run('save', () => queue.saveEdit(message, patch), 'Message enregistré')}
            onApprove={(message) => run('approve', () => queue.approve(message), 'Message approuvé — à toi de l’envoyer')}
            onConfirmSent={(message, reference) => run('sent', () => queue.confirmSent(message, reference), 'Prospect passé en « Contacté »')}
          />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4, paddingBottom: 24 }}>
            <Button size="sm" loading={busy === 'later'} disabled={busy && busy !== 'later'}
              onClick={() => run('later', () => queue.snooze(selected, drafts[0]), 'Reporté de 7 jours')}>
              ⏭️ Plus tard
            </Button>
            <div style={{ flex: 1 }} />
            <Button variant="danger" size="sm" disabled={!!busy} onClick={() => setModal('reject')}>❌ Refuser</Button>
            <Button variant="danger" size="sm" disabled={!!busy} onClick={() => setModal('blacklist')}>🚫 Blacklist</Button>
          </div>
        </div>
      )}

      <ReasonModal
        open={modal === 'reject'} busy={busy === 'reject'} danger
        title="Écarter ce prospect"
        intro="Le prospect sort de la file et passe en archivé. Le motif alimente l’amélioration du scoring."
        confirmLabel="Écarter"
        onClose={() => setModal(null)}
        onConfirm={async (reason) => {
          const result = await run('reject', () => queue.reject(selected, reason), 'Prospect écarté')
          if (!result?.error) setModal(null)
        }}
      />
      <ReasonModal
        open={modal === 'blacklist'} busy={busy === 'blacklist'} danger
        title="Blacklister cette entreprise"
        intro="L’entreprise ne sera plus jamais recréée ni contactée, y compris par une future campagne. Action difficilement réversible."
        confirmLabel="Blacklister"
        onClose={() => setModal(null)}
        onConfirm={async (reason) => {
          const result = await run('blacklist', () => queue.blacklist(selected, reason), 'Entreprise ajoutée à la liste d’opposition')
          if (!result?.error) setModal(null)
        }}
      />
    </div>
  )
}

function Centered({ children }) {
  return (
    <div style={{ height: '100%', minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 24 }}>
      {children}
    </div>
  )
}
