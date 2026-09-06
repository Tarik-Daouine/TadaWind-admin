import React, { useState } from 'react'
import Button from '../ui/Button.jsx'
import { useProspectorSettings } from '../../hooks/useProspectorSettings.js'
import { CHANNEL_LABELS } from './MessageEditor.jsx'

export default function ChannelGeneration({ prospect, messages, recommended, busy, onGenerate }) {
  const { settings } = useProspectorSettings()
  const [selected, setSelected] = useState(recommended ?? '')
  const enabled = settings?.channels ?? {}
  const email = [prospect.email, prospect.contact_email, prospect.email_commercial]
    .some(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value ?? ''))
  const candidates = {
    email: enabled.email && email,
    instagram_dm: enabled.instagram && prospect.instagram?.trim(),
    linkedin: enabled.linkedin && prospect.linkedin?.trim(),
    phone_script: enabled.phone && (prospect.phone || prospect.contact_phone),
  }
  const channels = Object.keys(candidates).filter(channel => candidates[channel])
  const channel = channels.includes(selected) ? selected : channels[0] ?? ''
  const existing = messages.find(message => message.channel === channel)
  const protectedDraft = existing && (existing.revision > 1 || ['edited', 'approved', 'sent'].includes(existing.status))
  return <div style={{ marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
    <label style={{ fontSize: 12, color: 'var(--muted)' }}>Un brouillon à la fois :{' '}
      <select aria-label="Canal à générer" value={channel} onChange={event => setSelected(event.target.value)} disabled={!!busy || !channels.length}>
        {!channels.length && <option value="">Aucun canal disponible</option>}
        {channels.map(value => <option key={value} value={value}>{CHANNEL_LABELS[value]}{value === recommended ? ' · recommandé' : ''}</option>)}
      </select>
    </label>
    <Button size="sm" loading={busy === 'regenerate'} disabled={!!busy || !channel || protectedDraft}
      onClick={() => onGenerate(channel)}>{existing ? 'Régénérer ce canal' : 'Générer ce canal'}</Button>
    {protectedDraft && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Ce brouillon est protégé car tu l’as modifié ou approuvé.</span>}
  </div>
}
