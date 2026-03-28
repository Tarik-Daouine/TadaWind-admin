import React, { useState, useRef, useEffect } from 'react'

const STATUT_OPTIONS = [
  { value: 'nouveau',           label: 'Nouveau',           color: '#4f7ff3' },
  { value: 'Prospect contacté', label: 'Prospect contacté', color: '#f59e0b' },
  { value: 'Opportunité',       label: 'Opportunité',       color: '#22c55e' },
  { value: 'Relancé',           label: 'Relancé',           color: '#f59e0b' },
  { value: 'Converti',          label: 'Converti',          color: '#16a34a' },
  { value: 'Perdu',             label: 'Perdu',             color: '#6b7280' },
]

const PRIORITE_COLORS = {
  'Haute':   '#bf1818',
  'Normale': '#f59e0b',
  'Basse':   '#6b7280',
}

const SOURCE_LABELS = {
  'tadawind_site': 'Site',
  'Autre':         'Terrain',
  'Réseau':        'Réseau',
}

function StatutDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const current = STATUT_OPTIONS.find(o => o.value === value) || STATUT_OPTIONS[0]

  useEffect(() => {
    if (!open) return
    const handler = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={e => { e.stopPropagation(); setOpen(p => !p) }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '2px 7px', borderRadius: 20,
          border: `1px solid ${current.color}33`,
          background: `${current.color}18`,
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}
        title="Changer le statut"
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: current.color, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 500, color: current.color }}>{current.label}</span>
        <span style={{ fontSize: 8, color: current.color, opacity: 0.7 }}>▾</span>
      </div>
      {open && (
        <div style={{
          position: 'absolute', left: 0, top: 'calc(100% + 4px)',
          background: 'var(--s2)', border: '1px solid var(--border-md)',
          borderRadius: 8, overflow: 'hidden', zIndex: 200,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)', minWidth: 150,
        }}>
          {STATUT_OPTIONS.map(opt => (
            <div
              key={opt.value}
              onClick={e => { e.stopPropagation(); onChange(opt.value); setOpen(false) }}
              style={{
                padding: '7px 12px', fontSize: 11,
                color: opt.value === value ? 'var(--text)' : 'var(--muted)',
                background: opt.value === value ? 'var(--s3)' : 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--s3)'}
              onMouseLeave={e => { e.currentTarget.style.background = opt.value === value ? 'var(--s3)' : 'transparent' }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: opt.color, flexShrink: 0 }} />
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PrioriteBadge({ value }) {
  const color = PRIORITE_COLORS[value] || 'var(--muted2)'
  return (
    <span style={{
      fontSize: 10, fontWeight: 500, padding: '1px 6px',
      borderRadius: 4, border: `1px solid ${color}44`,
      background: `${color}15`, color,
    }}>
      {value || '—'}
    </span>
  )
}

function SourceBadge({ value }) {
  return (
    <span style={{
      fontSize: 10, padding: '1px 6px', borderRadius: 4,
      border: '1px solid var(--border-md)',
      background: 'var(--s3)', color: 'var(--muted)',
    }}>
      {SOURCE_LABELS[value] || value || '—'}
    </span>
  )
}

function formatDate(str) {
  if (!str) return ''
  try {
    return new Date(str).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
  } catch { return '' }
}

const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)

function ActionBtn({ onClick, title, children, danger }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      title={title}
      style={{
        width: 26, height: 26, borderRadius: 5,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid var(--border-md)', background: 'var(--s1)',
        color: danger ? 'var(--red)' : 'var(--muted)', cursor: 'pointer', transition: 'all 0.12s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = danger ? 'var(--red-dim)' : 'var(--s2)'
        e.currentTarget.style.color = danger ? 'var(--red)' : 'var(--text)'
        e.currentTarget.style.borderColor = danger ? 'rgba(191,24,24,0.3)' : 'var(--border-strong)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--s1)'
        e.currentTarget.style.color = danger ? 'var(--red)' : 'var(--muted)'
        e.currentTarget.style.borderColor = 'var(--border-md)'
      }}
    >
      {children}
    </button>
  )
}

export default function LeadRow({ lead, isSelected, onClick, onStatutChange, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const displayName = [lead.prenom, lead.nom].filter(Boolean).join(' ') || lead.email || lead.nomEntreprise || 'Sans nom'

  return (
    <div
      style={{
        position: 'relative',
        borderBottom: '1px solid var(--border)',
        borderLeft: isSelected ? '2px solid var(--red)' : '2px solid transparent',
        background: isSelected ? 'var(--red-dim)' : hovered ? 'var(--s2)' : 'transparent',
        transition: 'background 0.12s',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        onClick={onClick}
        style={{
          padding: '10px 14px',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gap: 10,
          alignItems: 'center',
          paddingRight: hovered ? 80 : 14,
          transition: 'padding-right 0.15s',
        }}
      >
        {/* Statut dropdown */}
        <div onClick={e => e.stopPropagation()}>
          <StatutDropdown
            value={lead.statut}
            onChange={newStatut => onStatutChange && onStatutChange(lead.id, newStatut)}
          />
        </div>

        {/* Info */}
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 500, color: 'var(--text)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            marginBottom: 3,
          }}>
            {displayName}
            {lead.nomEntreprise && lead.nom && (
              <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400, marginLeft: 6 }}>
                {lead.nomEntreprise}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'nowrap' }}>
            {lead.ville && (
              <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>
                {lead.ville}
              </span>
            )}
            <SourceBadge value={lead.source} />
            <PrioriteBadge value={lead.priorite} />
          </div>
        </div>

        {/* Date */}
        <span style={{ fontSize: 10, color: 'var(--muted2)', flexShrink: 0, textAlign: 'right' }}>
          {formatDate(lead.timestamp)}
        </span>
      </div>

      {/* Hover actions */}
      <div style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        display: 'flex', gap: 4,
        opacity: hovered ? 1 : 0, transition: 'opacity 0.15s',
        pointerEvents: hovered ? 'auto' : 'none',
      }}>
        <ActionBtn onClick={() => onClick && onClick()} title="Modifier">
          <IconEdit />
        </ActionBtn>
        <ActionBtn onClick={() => onDelete && onDelete(lead.id)} title="Supprimer" danger>
          <IconTrash />
        </ActionBtn>
      </div>
    </div>
  )
}
