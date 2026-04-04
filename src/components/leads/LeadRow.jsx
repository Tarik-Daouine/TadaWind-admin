import React, { useState, useRef, useEffect } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile.js'

const STATUT_OPTIONS = [
  { value: 'nouveau',           label: 'Nouveau',           color: '#4f7ff3' },
  { value: 'Prospect contacté', label: 'Prospect contacté', color: '#f59e0b' },
  { value: 'À relancer',        label: 'À relancer',        color: '#f97316' },
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

export default function LeadRow({ lead, isSelected, onClick, onStatutChange, onDelete, mobile: mobileProp = false }) {
  const hookMobile = useIsMobile()
  const mobile = mobileProp || hookMobile
  const [hovered, setHovered] = useState(false)
  const displayName = [lead.prenom, lead.nom].filter(Boolean).join(' ') || lead.email || lead.nomEntreprise || 'Sans nom'
  const nextStep = lead.nextStep || ''
  const relanceDate = formatDate(lead.dateRelance)

  return (
    <div style={{ padding: '0 0 8px' }}>
      <div
        style={{
          position: 'relative',
          border: isSelected ? '1px solid var(--select-border)' : '1px solid var(--border)',
          borderLeft: isSelected ? '3px solid var(--select-accent)' : '3px solid transparent',
          borderRadius: 14,
          background: isSelected
            ? 'linear-gradient(180deg, rgba(79,127,243,0.16), rgba(79,127,243,0.05))'
            : hovered
              ? 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))'
              : 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
          boxShadow: isSelected ? 'var(--shadow-soft)' : hovered ? '0 16px 30px rgba(0,0,0,0.18)' : 'none',
          transition: 'background 0.12s, transform 0.12s, box-shadow 0.12s',
          cursor: 'pointer',
          transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          onClick={onClick}
          style={{
            padding: mobile ? '12px' : '12px 14px',
            display: mobile ? 'block' : 'grid',
            gridTemplateColumns: mobile ? undefined : 'auto 1fr auto',
            gap: mobile ? 10 : 12,
            alignItems: mobile ? undefined : 'center',
            paddingRight: mobile ? 12 : 84,
          }}
        >
          {mobile ? (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                <div onClick={e => e.stopPropagation()}>
                  <StatutDropdown
                    value={lead.statut}
                    onChange={newStatut => onStatutChange && onStatutChange(lead.id, newStatut)}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {lead.typeClient && (
                    <span style={{
                      fontSize: 10,
                      color: 'var(--blue)',
                      padding: '3px 7px',
                      borderRadius: 999,
                      border: '1px solid rgba(79,127,243,0.16)',
                      background: 'rgba(79,127,243,0.08)',
                    }}>
                      {lead.typeClient}
                    </span>
                  )}
                  <span style={{
                    fontSize: 10,
                    color: 'var(--muted2)',
                    padding: '4px 8px',
                    borderRadius: 999,
                    border: '1px solid var(--border)',
                    background: 'rgba(255,255,255,0.02)',
                    flexShrink: 0,
                  }}>
                    {formatDate(lead.timestamp)}
                  </span>
                </div>
              </div>

              <div style={{
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--text)',
                lineHeight: 1.28,
                marginBottom: 6,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {displayName}
              </div>

              {lead.nomEntreprise && (
                <div style={{
                  fontSize: 12,
                  color: 'var(--muted)',
                  lineHeight: 1.4,
                  marginBottom: 8,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {lead.nomEntreprise}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: nextStep || relanceDate ? 8 : 0 }}>
                {lead.ville && (
                  <span style={{
                    fontSize: 11,
                    color: 'var(--muted)',
                    padding: '2px 7px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border)',
                  }}>
                    {lead.ville}
                  </span>
                )}
                <SourceBadge value={lead.source} />
                <PrioriteBadge value={lead.priorite} />
              </div>

              {(nextStep || relanceDate) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {nextStep && (
                    <span style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.45 }}>
                      Prochaine action: <span style={{ color: 'var(--text)' }}>{nextStep}</span>
                    </span>
                  )}
                  {relanceDate && (
                    <span style={{
                      alignSelf: 'flex-start',
                      fontSize: 10,
                      color: 'var(--amber)',
                      padding: '3px 7px',
                      borderRadius: 999,
                      background: 'rgba(245,158,11,0.12)',
                      border: '1px solid rgba(245,158,11,0.18)',
                    }}>
                      Relance {relanceDate}
                    </span>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div onClick={e => e.stopPropagation()}>
                <StatutDropdown
                  value={lead.statut}
                  onChange={newStatut => onStatutChange && onStatutChange(lead.id, newStatut)}
                />
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginBottom: 5,
                }}>
                  {displayName}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: nextStep || relanceDate ? 6 : 0 }}>
                  {lead.nomEntreprise && (
                    <span style={{
                      maxWidth: 180,
                      fontSize: 11,
                      color: 'var(--muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {lead.nomEntreprise}
                    </span>
                  )}
                  {lead.ville && (
                    <span style={{
                      fontSize: 11,
                      color: 'var(--muted)',
                      padding: '2px 7px',
                      borderRadius: 999,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border)',
                    }}>
                      {lead.ville}
                    </span>
                  )}
                  <SourceBadge value={lead.source} />
                  <PrioriteBadge value={lead.priorite} />
                </div>

                {(nextStep || relanceDate) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {nextStep && (
                      <span style={{
                        fontSize: 11,
                        color: 'var(--muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 220,
                      }}>
                        Prochaine action: <span style={{ color: 'var(--text)' }}>{nextStep}</span>
                      </span>
                    )}
                    {relanceDate && (
                      <span style={{
                        fontSize: 10,
                        color: 'var(--amber)',
                        padding: '3px 7px',
                        borderRadius: 999,
                        background: 'rgba(245,158,11,0.12)',
                        border: '1px solid rgba(245,158,11,0.18)',
                      }}>
                        Relance {relanceDate}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span style={{
                  fontSize: 10,
                  color: 'var(--muted2)',
                  flexShrink: 0,
                  textAlign: 'right',
                  padding: '4px 8px',
                  borderRadius: 999,
                  border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.02)',
                }}>
                  {formatDate(lead.timestamp)}
                </span>
                {lead.typeClient && (
                  <span style={{
                    fontSize: 10,
                    color: 'var(--blue)',
                    padding: '3px 7px',
                    borderRadius: 999,
                    border: '1px solid rgba(79,127,243,0.16)',
                    background: 'rgba(79,127,243,0.08)',
                  }}>
                    {lead.typeClient}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        <div style={{
          position: 'absolute',
          right: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'grid',
          gap: 4,
          opacity: !mobile && (hovered || isSelected) ? 1 : 0,
          transition: 'opacity 0.15s',
          pointerEvents: !mobile && (hovered || isSelected) ? 'auto' : 'none',
        }}>
          <ActionBtn onClick={() => onClick && onClick()} title="Modifier">
            <IconEdit />
          </ActionBtn>
          <ActionBtn onClick={() => onDelete && onDelete(lead.id)} title="Supprimer" danger>
            <IconTrash />
          </ActionBtn>
        </div>
      </div>
    </div>
  )
}
