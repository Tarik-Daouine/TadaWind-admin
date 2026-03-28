import React from 'react'

const STATUS_STYLES = {
  published: { bg: 'var(--green-dim)', color: 'var(--green)', label: 'Publié' },
  draft:     { bg: 'var(--amber-dim)', color: 'var(--amber)', label: 'Brouillon' },
  archived:  { bg: 'var(--gray-dim)',  color: 'var(--gray)',  label: 'Archivé' },
}

const CAT_COLORS = {
  Nature:     { bg: 'rgba(34,197,94,0.1)',  color: '#4ade80' },
  Immobilier: { bg: 'rgba(79,127,243,0.1)', color: '#818cf8' },
  Corporate:  { bg: 'rgba(245,158,11,0.1)', color: '#fbbf24' },
  Tourisme:   { bg: 'rgba(236,72,153,0.1)', color: '#f472b6' },
}

export default function Badge({ variant = 'status', value, small = false, label: customLabel, bg: customBg, color: customColor }) {
  let bg, color, label

  if (variant === 'status') {
    const s = STATUS_STYLES[value] || STATUS_STYLES.draft
    bg = s.bg
    color = s.color
    label = s.label
  } else if (variant === 'category') {
    const c = CAT_COLORS[value] || { bg: 'var(--gray-dim)', color: 'var(--gray)' }
    bg = c.bg
    color = c.color
    label = value
  } else {
    bg = customBg || 'var(--gray-dim)'
    color = customColor || 'var(--gray)'
    label = customLabel || value
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: small ? 10 : 11,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: small ? '1px 6px' : '2px 8px',
        borderRadius: 20,
        background: bg,
        color: color,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  )
}
