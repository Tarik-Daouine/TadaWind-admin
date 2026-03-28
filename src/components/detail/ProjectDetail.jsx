import React, { useState, useEffect } from 'react'
import Button from '../ui/Button.jsx'
import Badge from '../ui/Badge.jsx'
import TabInfos from './tabs/TabInfos.jsx'
import TabVideo from './tabs/TabVideo.jsx'
import TabGallery from './tabs/TabGallery.jsx'
import TabPublication from './tabs/TabPublication.jsx'

const TABS = [
  { id: 'infos',       label: 'Infos' },
  { id: 'video',       label: 'Vidéo' },
  { id: 'gallery',     label: 'Galerie' },
  { id: 'publication', label: 'Publication' },
]

function wordCount(text) {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(Boolean).length
}

function formatDateTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function ProjectDetail({ project, onUpdate, onClose, onToast }) {
  const [tab, setTab] = useState('infos')
  const [editedProject, setEditedProject] = useState({ ...project })
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  // Reset when project changes
  useEffect(() => {
    setEditedProject({ ...project })
    setIsDirty(false)
  }, [project.id])

  const handleChange = (data) => {
    setEditedProject(prev => ({ ...prev, ...data }))
    setIsDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const result = await onUpdate(project.id, editedProject)
    setSaving(false)
    if (result?.error) {
      onToast('Erreur lors de la sauvegarde', 'error')
    } else {
      setIsDirty(false)
      onToast('Projet sauvegardé', 'success')
    }
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: 'var(--bg)',
    }}>
      {/* Header */}
      <div style={{
        padding: '0 24px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--s1)',
        flexShrink: 0,
      }}>
        {/* Top row */}
        <div style={{
          height: 'var(--topbar-h)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          {/* Title */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--serif)',
              fontSize: 18,
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {editedProject.title}
            </div>
          </div>

          {/* Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <Badge variant="status" value={editedProject.status} />
            {editedProject.notionSync && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 20,
                background: 'var(--blue-dim)',
                color: 'var(--blue)',
                fontWeight: 600,
              }}>
                <span style={{ fontWeight: 800, fontSize: 10 }}>N</span>
                Notion
              </span>
            )}
          </div>

          {/* Save button (only when dirty) */}
          {isDirty && (
            <Button
              variant="primary"
              size="sm"
              loading={saving}
              onClick={handleSave}
              style={{ animation: 'fadeIn 0.15s ease both' }}
            >
              Sauvegarder
            </Button>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border-md)',
              background: 'transparent',
              color: 'var(--muted)',
              fontSize: 18,
              cursor: 'pointer',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--s2)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)' }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                border: 'none',
                borderBottom: tab === t.id ? '2px solid var(--red)' : '2px solid transparent',
                background: 'transparent',
                color: tab === t.id ? 'var(--text)' : 'var(--muted)',
                fontFamily: 'var(--sans)',
                transition: 'color 0.15s',
                marginBottom: -1,
              }}
              onMouseEnter={e => { if (tab !== t.id) e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { if (tab !== t.id) e.currentTarget.style.color = 'var(--muted)' }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {tab === 'infos' && (
          <TabInfos project={editedProject} onChange={handleChange} />
        )}
        {tab === 'video' && (
          <TabVideo project={editedProject} onChange={handleChange} onToast={onToast} />
        )}
        {tab === 'gallery' && (
          <TabGallery project={editedProject} onChange={handleChange} />
        )}
        {tab === 'publication' && (
          <TabPublication project={editedProject} onChange={handleChange} onToast={onToast} />
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 24px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--s1)',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 11, color: 'var(--muted2)' }}>
          Mis à jour : {formatDateTime(project.updatedAt)}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted2)' }}>
          {wordCount(editedProject.longDesc)} mots
          {isDirty && (
            <span style={{ marginLeft: 8, color: 'var(--amber)', fontWeight: 500 }}>· Modifications non sauvegardées</span>
          )}
        </div>
      </div>
    </div>
  )
}
