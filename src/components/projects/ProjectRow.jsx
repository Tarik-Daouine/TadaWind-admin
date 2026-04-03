import React, { useEffect, useRef, useState } from 'react'
import Badge from '../ui/Badge.jsx'

const STATUS_OPTIONS = [
  { value: 'draft',     label: 'Brouillon' },
  { value: 'published', label: 'Publié'    },
  { value: 'archived',  label: 'Archivé'   },
]

function StatusDropdown({ value, onChange, fullWidth = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    if (!open) return
    const handler = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', width: fullWidth ? '100%' : 'auto' }}>
      <div
        onClick={e => { e.stopPropagation(); setOpen(p => !p) }}
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: fullWidth ? 'space-between' : 'flex-start',
          gap: 4,
          width: fullWidth ? '100%' : 'auto',
        }}
        title="Changer le statut"
      >
        <Badge variant="status" value={value} />
        <span style={{ fontSize: 8, color: 'var(--muted2)', lineHeight: 1 }}>▾</span>
      </div>
      {open && (
        <div style={{
          position: 'absolute', left: 0, top: 'calc(100% + 4px)',
          background: 'var(--s2)', border: '1px solid var(--border-md)',
          borderRadius: 8, overflow: 'hidden', zIndex: 100,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)', minWidth: 110,
        }}>
          {STATUS_OPTIONS.map(opt => (
            <div
              key={opt.value}
              onClick={e => { e.stopPropagation(); onChange(opt.value); setOpen(false) }}
              style={{
                padding: '7px 12px',
                fontSize: 11,
                fontWeight: opt.value === value ? 600 : 400,
                color: opt.value === value ? 'var(--text)' : 'var(--muted)',
                background: opt.value === value ? 'var(--s3)' : 'transparent',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--s3)'}
              onMouseLeave={e => { e.currentTarget.style.background = opt.value === value ? 'var(--s3)' : 'transparent' }}
            >
              <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: opt.value === value ? 'var(--text)' : 'transparent',
                border: '1px solid var(--muted2)',
              }} />
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

const IconCopy = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
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

const IconCamera = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
)

const IconGrip = () => (
  <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
    <circle cx="2.5" cy="2.5" r="1.5"/>
    <circle cx="7.5" cy="2.5" r="1.5"/>
    <circle cx="2.5" cy="7" r="1.5"/>
    <circle cx="7.5" cy="7" r="1.5"/>
    <circle cx="2.5" cy="11.5" r="1.5"/>
    <circle cx="7.5" cy="11.5" r="1.5"/>
  </svg>
)

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
  } catch {
    return dateStr
  }
}

function MetaChip({ children, tone = 'neutral' }) {
  const tones = {
    neutral: {
      border: '1px solid var(--border)',
      background: 'rgba(255,255,255,0.03)',
      color: 'var(--muted)',
    },
    blue: {
      border: '1px solid rgba(79,127,243,0.18)',
      background: 'rgba(79,127,243,0.08)',
      color: 'var(--blue)',
    },
  }
  const palette = tones[tone] || tones.neutral

  return (
    <span style={{
      fontSize: 10,
      padding: '2px 8px',
      borderRadius: 999,
      border: palette.border,
      background: palette.background,
      color: palette.color,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

function ActionBtn({ onClick, title, children, danger }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      title={title}
      style={{
        width: 26,
        height: 26,
        borderRadius: 5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid var(--border-md)',
        background: 'var(--s1)',
        color: danger ? 'var(--red)' : 'var(--muted)',
        cursor: 'pointer',
        transition: 'all 0.12s',
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

export default function ProjectRow({
  project, isSelected, onClick, onEdit, onDuplicate, onDelete,
  isDragOver, isDragging,
  onDragStart, onDragOver, onDragEnd, onDrop,
  onStatusChange,
  displayOrder,
  isChecked, onCheck, selectionActive,
  draggableEnabled = true,
  showDragHandle = false,
}) {
  const [hovered, setHovered] = useState(false)
  const [imgError, setImgError] = useState(false)
  const showCheckbox = !showDragHandle && (hovered || isChecked || selectionActive)

  return (
    <div style={{ padding: '0 0 8px' }}>
      <div
        draggable={draggableEnabled}
        onDragStart={draggableEnabled ? onDragStart : undefined}
        onDragOver={draggableEnabled ? (e => { e.preventDefault(); onDragOver && onDragOver(e) }) : undefined}
        onDragEnd={draggableEnabled ? onDragEnd : undefined}
        onDrop={draggableEnabled ? (e => { e.preventDefault(); onDrop && onDrop(e) }) : undefined}
        style={{
          position: 'relative',
          border: isSelected ? '1px solid var(--select-border)' : '1px solid var(--border)',
          borderLeft: isSelected ? '3px solid var(--select-accent)' : '3px solid transparent',
          borderTopColor: isDragOver ? 'var(--select-accent)' : (isSelected ? 'var(--select-border)' : 'var(--border)'),
          borderRadius: 14,
          background: isSelected
            ? 'linear-gradient(180deg, rgba(79,127,243,0.16), rgba(79,127,243,0.05))'
            : hovered
              ? 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))'
              : 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
          boxShadow: isSelected ? 'var(--shadow-soft)' : hovered ? '0 16px 30px rgba(0,0,0,0.18)' : 'none',
          transition: 'background 0.12s, transform 0.12s, box-shadow 0.12s, border-color 0.12s',
          cursor: draggableEnabled ? 'grab' : 'pointer',
          transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
          opacity: isDragging ? 0.55 : 1,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          onClick={onClick}
          style={{
            padding: '12px 14px',
            paddingRight: showDragHandle ? 14 : 84,
            display: 'grid',
            gridTemplateColumns: '80px minmax(0, 1fr) auto',
            gap: 12,
            alignItems: 'flex-start',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {showDragHandle ? (
                <div style={{ width: 12, color: 'var(--muted2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <IconGrip />
                </div>
              ) : showCheckbox ? (
                <input
                  type="checkbox"
                  checked={!!isChecked}
                  onChange={e => { e.stopPropagation(); onCheck && onCheck(project.id) }}
                  onClick={e => e.stopPropagation()}
                  style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--select-accent)', flexShrink: 0 }}
                />
              ) : (
                <div style={{ width: 14, flexShrink: 0 }} />
              )}
              <StatusDropdown
                value={project.status}
                onChange={newStatus => onStatusChange && onStatusChange(project.id, newStatus)}
                fullWidth
              />
            </div>
            <div style={{ paddingLeft: 22 }}>
              <MetaChip>Ordre {displayOrder ?? project.order ?? '—'}</MetaChip>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
            {project.cover && !imgError ? (
              <img
                src={project.cover}
                alt={project.title}
                onError={() => setImgError(true)}
                style={{
                  width: 54,
                  height: 40,
                  objectFit: 'cover',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div style={{
                width: 54,
                height: 40,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--s3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--muted2)',
                flexShrink: 0,
              }}>
                <IconCamera />
              </div>
            )}

            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text)',
                lineHeight: 1.3,
                marginBottom: 6,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {project.title}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {project.lieu && (
                  <span style={{
                    fontSize: 11,
                    color: 'var(--muted)',
                    lineHeight: 1.35,
                  }}>
                    {project.lieu}
                  </span>
                )}
                {project.region && <MetaChip>{project.region}</MetaChip>}
                {project.category && <Badge variant="category" value={project.category} small />}
                <MetaChip tone="blue">{formatDate(project.date) || 'Sans date'}</MetaChip>
                {project.streamableId && <MetaChip>Streamable</MetaChip>}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, minWidth: 26 }}>
            {!showDragHandle && isSelected && (
              <span style={{ width: 26, height: 2, borderRadius: 999, background: 'var(--select-accent)', opacity: 0.6 }} />
            )}
          </div>
        </div>

        <div style={{
          position: 'absolute',
          right: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'grid',
          gap: 4,
          opacity: (hovered || isSelected) && !showDragHandle ? 1 : 0,
          transition: 'opacity 0.15s',
          pointerEvents: (hovered || isSelected) && !showDragHandle ? 'auto' : 'none',
        }}>
          <ActionBtn onClick={() => onEdit && onEdit(project.id)} title="Modifier">
            <IconEdit />
          </ActionBtn>
          <ActionBtn onClick={() => onDuplicate(project.id)} title="Dupliquer">
            <IconCopy />
          </ActionBtn>
          <ActionBtn onClick={() => onDelete(project.id)} title="Supprimer" danger>
            <IconTrash />
          </ActionBtn>
        </div>
      </div>
    </div>
  )
}
