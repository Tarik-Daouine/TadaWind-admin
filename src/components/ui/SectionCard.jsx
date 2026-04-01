import React from 'react'

export function SectionTitle({ children, accent, accentDim }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: accent || 'var(--muted2)',
      marginBottom: 12, paddingBottom: 8,
      borderBottom: `1px solid ${accentDim || 'var(--border)'}`,
      display: 'flex', alignItems: 'center', gap: 7,
    }}>
      {accent && (
        <span style={{
          width: 3, height: 12, borderRadius: 2,
          background: accent, flexShrink: 0, display: 'inline-block',
        }} />
      )}
      {children}
    </div>
  )
}

export function SectionCard({ children, borderColor }) {
  return (
    <div style={{
      background: 'var(--s2)',
      border: `1px solid ${borderColor || 'var(--border)'}`,
      borderRadius: 'var(--radius)',
      padding: '14px 16px',
      marginBottom: 12,
    }}>
      {children}
    </div>
  )
}
