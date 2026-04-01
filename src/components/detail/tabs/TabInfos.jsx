import React, { useState } from 'react'
import Input from '../../ui/Input.jsx'
import Button from '../../ui/Button.jsx'
import { SectionCard, SectionTitle } from '../../ui/SectionCard.jsx'
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
      {/* ── Identité ─────────────────────────────────────────────── */}
      <SectionCard borderColor="var(--blue-dim)">
        <SectionTitle accent="var(--blue)" accentDim="var(--blue-dim)">Identité</SectionTitle>
        <Input
          label="Titre"
          value={project.title || ''}
          onChange={e => handleTitleChange(e.target.value)}
          placeholder="Nom du projet"
        />
        <Input
          label="Slug"
          value={project.slug || ''}
          onChange={e => onChange({ slug: e.target.value })}
          placeholder="slug-du-projet"
          hint="Généré automatiquement depuis le titre"
        />
      </SectionCard>

      {/* ── Contexte ─────────────────────────────────────────────── */}
      <SectionCard borderColor="var(--amber-dim)">
        <SectionTitle accent="var(--amber)" accentDim="var(--amber-dim)">Contexte</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <Input
            label="Lieu"
            value={project.lieu || ''}
            onChange={e => onChange({ lieu: e.target.value })}
            placeholder="Ville, commune"
          />
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

          <Input
            label="Ordre d'affichage"
            type="number"
            value={project.order !== undefined && project.order !== null ? project.order : ''}
            onChange={e => onChange({ order: e.target.value === '' ? 0 : parseInt(e.target.value, 10) })}
            placeholder="1"
            hint="1 = premier dans la liste"
          />

          <div style={{ gridColumn: '1 / -1' }}>
            <Input
              label="Date de tournage"
              type="date"
              value={project.date || ''}
              onChange={e => onChange({ date: e.target.value })}
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Contenu ──────────────────────────────────────────────── */}
      <SectionCard borderColor="var(--green-dim)">
        <SectionTitle accent="var(--green)" accentDim="var(--green-dim)">Contenu</SectionTitle>
        <Input
          label="Description courte"
          value={project.shortDesc || ''}
          onChange={e => onChange({ shortDesc: e.target.value })}
          placeholder="Une ligne résumant le projet…"
          multiline
          rows={2}
        />
        <Input
          label="Description longue"
          value={project.longDesc || ''}
          onChange={e => onChange({ longDesc: e.target.value })}
          placeholder="Description complète…"
          multiline
          rows={4}
        />

        {/* Tags */}
        <div style={{ marginBottom: 4 }}>
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
      </SectionCard>
    </div>
  )
}
