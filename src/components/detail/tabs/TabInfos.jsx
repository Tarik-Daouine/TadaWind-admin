import React, { useState } from 'react'
import Input from '../../ui/Input.jsx'
import Button from '../../ui/Button.jsx'
import { CATEGORIES } from '../../../data/mockProjects.js'

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function TabInfos({ project, onChange }) {
  const [tagInput, setTagInput] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

  const handleImport = async () => {
    setImportLoading(true)
    await new Promise(r => setTimeout(r, 1500))
    setImportLoading(false)
    onChange({
      shortDesc: 'Description importée depuis Notion — ' + (project.shortDesc || 'Vue aérienne spectaculaire réalisée par drone.'),
      longDesc: 'Contenu Notion importé : ' + (project.longDesc || 'Description complète du projet, réalisé par Tada-Wind en Nouvelle-Aquitaine.'),
      notionSync: true,
    })
  }

  const handlePush = async () => {
    setPushLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    setPushLoading(false)
    onChange({ notionSync: true })
  }

  const addTag = () => {
    const t = tagInput.trim()
    if (!t) return
    const tags = project.tags || []
    if (!tags.includes(t)) {
      onChange({ tags: [...tags, t] })
    }
    setTagInput('')
  }

  const removeTag = (tag) => {
    onChange({ tags: (project.tags || []).filter(t => t !== tag) })
  }

  const handleTitleChange = (val) => {
    onChange({ title: val, slug: slugify(val) })
  }

  return (
    <div>
      {/* Notion bar */}
      <div style={{
        background: 'var(--blue-dim)',
        border: '1px solid rgba(79,127,243,0.2)',
        borderRadius: 'var(--radius)',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 800,
            color: '#000',
            flexShrink: 0,
          }}>N</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            Champs Notion · Sync: {project.notionSync ? 'À jour' : 'Non synchronisé'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" size="sm" loading={importLoading} onClick={handleImport}>
            Importer
          </Button>
          <Button variant="ghost" size="sm" loading={pushLoading} onClick={handlePush}>
            Push
          </Button>
        </div>
      </div>

      {/* 2-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
        {/* Titre — full width */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Input
            label="Titre"
            value={project.title || ''}
            onChange={e => handleTitleChange(e.target.value)}
            placeholder="Nom du projet"
          />
        </div>

        {/* Slug — full width */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Input
            label="Slug"
            value={project.slug || ''}
            onChange={e => onChange({ slug: e.target.value })}
            placeholder="slug-du-projet"
            hint="Généré automatiquement depuis le titre"
          />
        </div>

        {/* Lieu */}
        <Input
          label="Lieu"
          value={project.lieu || ''}
          onChange={e => onChange({ lieu: e.target.value })}
          placeholder="Ville, commune"
        />

        {/* Région */}
        <Input
          label="Région"
          value={project.region || ''}
          onChange={e => onChange({ region: e.target.value })}
          placeholder="Région"
        />

        {/* Catégorie */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: 'block',
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: 6,
            fontWeight: 500,
          }}>
            Catégorie
          </label>
          <select
            value={project.category || 'Nature'}
            onChange={e => onChange({ category: e.target.value })}
            style={{
              width: '100%',
              height: 38,
              padding: '0 12px',
              background: 'var(--s3)',
              border: '1px solid var(--border-md)',
              borderRadius: 'var(--radius)',
              color: 'var(--text)',
              fontSize: 13,
              fontFamily: 'var(--sans)',
              cursor: 'pointer',
            }}
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Ordre */}
        <Input
          label="Ordre d'affichage"
          type="number"
          value={project.order !== undefined && project.order !== null ? project.order : ''}
          onChange={e => onChange({ order: e.target.value === '' ? 0 : parseInt(e.target.value, 10) })}
          placeholder="1"
          hint="1 = premier dans la liste"
        />

        {/* Date */}
        <Input
          label="Date de tournage"
          type="date"
          value={project.date || ''}
          onChange={e => onChange({ date: e.target.value })}
        />

        {/* Short desc — full width */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Input
            label="Description courte"
            value={project.shortDesc || ''}
            onChange={e => onChange({ shortDesc: e.target.value })}
            placeholder="Une ligne résumant le projet…"
            multiline
            rows={2}
          />
        </div>

        {/* Long desc — full width */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Input
            label="Description longue"
            value={project.longDesc || ''}
            onChange={e => onChange({ longDesc: e.target.value })}
            placeholder="Description complète…"
            multiline
            rows={4}
          />
        </div>
      </div>

      {/* Tags */}
      <div style={{ marginBottom: 16 }}>
        <label style={{
          display: 'block',
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          marginBottom: 6,
          fontWeight: 500,
        }}>
          Tags
        </label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            type="text"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
            placeholder="Ajouter un tag…"
            style={{
              flex: 1,
              height: 34,
              padding: '0 12px',
              background: 'var(--s3)',
              border: '1px solid var(--border-md)',
              borderRadius: 'var(--radius)',
              color: 'var(--text)',
              fontSize: 13,
              fontFamily: 'var(--sans)',
              outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--red)'; e.target.style.boxShadow = '0 0 0 3px var(--red-dim)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border-md)'; e.target.style.boxShadow = 'none' }}
          />
          <Button variant="ghost" size="sm" onClick={addTag}>Ajouter</Button>
        </div>
        {(project.tags || []).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(project.tags || []).map(tag => (
              <span
                key={tag}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 10px',
                  borderRadius: 20,
                  background: 'var(--s3)',
                  border: '1px solid var(--border-md)',
                  fontSize: 12,
                  color: 'var(--muted)',
                }}
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    fontSize: 12,
                    lineHeight: 1,
                    transition: 'color 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)' }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
