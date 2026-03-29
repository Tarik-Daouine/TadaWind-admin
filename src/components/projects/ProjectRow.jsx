import React, { useState, useRef, useEffect } from 'react'
import Badge from '../ui/Badge.jsx'

const STATUS_OPTIONS = [
  { value: 'draft',     label: 'Brouillon' },
  { value: 'published', label: 'Publié'    },
  { value: 'archived',  label: 'Archivé'   },
]

function StatusDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()

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
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}
        title="Changer le statut"
      >
        <Badge variant="status" value={value} />
        <span style={{ fontSize: 8, color: 'var(--muted2)', lineHeight: 1 }}>▾</span>
      </div>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 4px)',
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

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
  } catch {
    return dateStr
  }
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

export default function ProjectRow({
  project, isSelected, onClick, onEdit, onDuplicate, onDelete,
  isDragOver, isDragging,
  onDragStart, onDragOver, onDragEnd, onDrop,
  onStatusChange,
  isChecked, onCheck, selectionActive,
}) {
  const [hovered, setHovered] = useState(false)
  const [imgError, setImgError] = useState(false)
  const showCheckbox = hovered || isChecked || selectionActive

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={e => { e.preventDefault(); onDragOver && onDragOver(e) }}
      onDragEnd={onDragEnd}
      onDrop={e => { e.preventDefault(); onDrop && onDrop(e) }}
      style={{
        position: 'relative',
        borderBottom: '1px solid var(--border)',
        borderLeft: isSelected ? '2px solid var(--red)' : '2px solid transparent',
        borderTop: isDragOver ? '2px solid var(--red)' : '2px solid transparent',
        background: isDragging ? 'var(--s3)' : isSelected ? 'var(--red-dim)' : hovered ? 'var(--s2)' : 'transparent',
        opacity: isDragging ? 0.5 : 1,
        transition: 'background 0.12s',
        cursor: 'grab',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Checkbox ou drag handle */}
      <div style={{
        position: 'absolute',
        left: 4,
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        alignItems: 'center',
        zIndex: 1,
      }}>
        {showCheckbox ? (
          <input
            type="checkbox"
            checked={!!isChecked}
            onChange={e => { e.stopPropagation(); onCheck && onCheck(project.id) }}
            onClick={e => e.stopPropagation()}
            style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--red)' }}
          />
        ) : (
          <div style={{ color: 'var(--muted2)', opacity: hovered ? 1 : 0, transition: 'opacity 0.15s', pointerEvents: 'none' }}>
            <IconGrip />
          </div>
        )}
      </div>

      {/* Main row */}
      <div
        onClick={onClick}
        style={{
          padding: '10px 14px 10px 20px',
          display: 'grid',
          gridTemplateColumns: 'auto 20px 48px 1fr auto',
          gap: 10,
          alignItems: 'center',
          paddingRight: hovered ? 100 : 14,
          transition: 'padding-right 0.15s',
        }}
      >
        {/* Status dropdown */}
        <StatusDropdown
          value={project.status}
          onChange={newStatus => onStatusChange && onStatusChange(project.id, newStatus)}
        />

        {/* Order number */}
        <span style={{
          fontSize: 10,
          color: 'var(--muted2)',
          fontVariantNumeric: 'tabular-nums',
          textAlign: 'right',
          userSelect: 'none',
        }}>
          {project.order ?? '–'}
        </span>

        {/* Thumbnail */}
        {project.cover && !imgError ? (
          <img
            src={project.cover}
            alt={project.title}
            onError={() => setImgError(true)}
            style={{
              width: 48,
              height: 36,
              objectFit: 'cover',
              borderRadius: 4,
              border: '1px solid var(--border)',
              flexShrink: 0,
            }}
          />
        ) : (
          <div style={{
            width: 48,
            height: 36,
            borderRadius: 4,
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

        {/* Info */}
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: 3,
          }}>
            {project.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {project.lieu && (
              <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80 }}>
                {project.lieu}
              </span>
            )}
            <Badge variant="category" value={project.category} small />
          </div>
        </div>

        {/* Date */}
        <span style={{ fontSize: 10, color: 'var(--muted2)', flexShrink: 0, textAlign: 'right' }}>
          {formatDate(project.date)}
        </span>
      </div>

      {/* Hover actions */}
      <div
        style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          gap: 4,
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.15s',
          pointerEvents: hovered ? 'auto' : 'none',
        }}
      >
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
  )
}
