import React, { useState } from 'react'
import Button from '../../ui/Button.jsx'
import Input from '../../ui/Input.jsx'
import { SectionCard, SectionTitle } from '../../ui/SectionCard.jsx'

const STATUS_CARDS = [
  {
    value: 'draft',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    ),
    label: 'Brouillon',
    desc: 'En préparation — Non visible sur le site',
  },
  {
    value: 'published',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    ),
    label: 'En ligne',
    desc: 'Publié — Visible sur le site',
  },
  {
    value: 'archived',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polyline points="21 8 21 21 3 21 3 8"/>
        <rect x="1" y="3" width="22" height="5"/>
        <line x1="10" y1="12" x2="14" y2="12"/>
      </svg>
    ),
    label: 'Archivé',
    desc: 'Archivé — Retiré du site',
  },
]

function StatusCard({ card, selected, onClick }) {
  const [hovered, setHovered] = useState(false)
  const isActive = selected === card.value

  return (
    <div
      onClick={() => onClick(card.value)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        padding: '16px 14px',
        borderRadius: 'var(--radius)',
        border: isActive ? '1px solid var(--red)' : `1px solid ${hovered ? 'var(--border-strong)' : 'var(--border-md)'}`,
        background: isActive ? 'var(--red-dim)' : hovered ? 'var(--s3)' : 'var(--s2)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ color: isActive ? 'var(--red)' : 'var(--muted)' }}>{card.icon}</div>
      <div style={{ fontWeight: 600, fontSize: 13, color: isActive ? 'var(--text)' : 'var(--muted)' }}>
        {card.label}
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted2)', lineHeight: 1.4 }}>{card.desc}</div>
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        background: checked ? 'var(--red)' : 'var(--s3)',
        border: '1px solid var(--border-md)',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 2,
        left: checked ? 20 : 2,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  )
}

export default function TabPublication({ project, onChange, onToast }) {
  const [publishLoading, setPublishLoading] = useState(false)

  const handlePublish = async () => {
    setPublishLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    setPublishLoading(false)
    onChange({ status: 'published' })
    onToast && onToast('Projet publié avec succès', 'success')
  }

  const seoTitleLen = (project.seoTitle || '').length
  const seoDescLen = (project.seoDesc || '').length

  return (
    <div>
      {/* ── Statut ───────────────────────────────────────────────── */}
      <SectionCard borderColor="var(--blue-dim)">
        <SectionTitle accent="var(--blue)" accentDim="var(--blue-dim)">Statut</SectionTitle>
        <div style={{ display: 'flex', gap: 10 }}>
          {STATUS_CARDS.map(card => (
            <StatusCard
              key={card.value}
              card={card}
              selected={project.status}
              onClick={v => onChange({ status: v })}
            />
          ))}
        </div>
      </SectionCard>

      {/* ── Mise en avant ────────────────────────────────────────── */}
      <SectionCard borderColor="var(--amber-dim)">
        <SectionTitle accent="var(--amber)" accentDim="var(--amber-dim)">Mise en avant</SectionTitle>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          background: 'var(--s3)',
          border: '1px solid var(--border-md)',
          borderRadius: 'var(--radius)',
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>Projet mis en avant</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Affiché en priorité sur la page d'accueil</div>
          </div>
          <Toggle
            checked={project.featured || false}
            onChange={v => onChange({ featured: v })}
          />
        </div>
      </SectionCard>

      {/* ── SEO ──────────────────────────────────────────────────── */}
      <SectionCard borderColor="var(--green-dim)">
        <SectionTitle accent="var(--green)" accentDim="var(--green-dim)">SEO</SectionTitle>

        {/* SEO Title */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={{
              fontSize: 11, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500,
            }}>
              Titre SEO
            </label>
            <span style={{ fontSize: 11, color: seoTitleLen > 60 ? 'var(--red)' : 'var(--muted2)' }}>
              {seoTitleLen}/60
            </span>
          </div>
          <input
            type="text"
            value={project.seoTitle || ''}
            onChange={e => onChange({ seoTitle: e.target.value })}
            placeholder="Titre pour les moteurs de recherche"
            maxLength={80}
            style={{
              width: '100%', height: 38, padding: '0 12px',
              background: 'var(--s3)',
              border: `1px solid ${seoTitleLen > 60 ? 'var(--red)' : 'var(--border-md)'}`,
              borderRadius: 'var(--radius)', color: 'var(--text)',
              fontSize: 13, fontFamily: 'var(--sans)', outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--red)'; e.target.style.boxShadow = '0 0 0 3px var(--red-dim)' }}
            onBlur={e => { e.target.style.borderColor = seoTitleLen > 60 ? 'var(--red)' : 'var(--border-md)'; e.target.style.boxShadow = 'none' }}
          />
        </div>

        {/* SEO Desc */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={{
              fontSize: 11, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500,
            }}>
              Méta-description
            </label>
            <span style={{ fontSize: 11, color: seoDescLen > 160 ? 'var(--red)' : 'var(--muted2)' }}>
              {seoDescLen}/160
            </span>
          </div>
          <textarea
            value={project.seoDesc || ''}
            onChange={e => onChange({ seoDesc: e.target.value })}
            placeholder="Description pour les résultats de recherche…"
            rows={3}
            maxLength={200}
            style={{
              width: '100%', padding: '8px 12px',
              background: 'var(--s3)',
              border: `1px solid ${seoDescLen > 160 ? 'var(--red)' : 'var(--border-md)'}`,
              borderRadius: 'var(--radius)', color: 'var(--text)',
              fontSize: 13, fontFamily: 'var(--sans)', outline: 'none',
              resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--red)'; e.target.style.boxShadow = '0 0 0 3px var(--red-dim)' }}
            onBlur={e => { e.target.style.borderColor = seoDescLen > 160 ? 'var(--red)' : 'var(--border-md)'; e.target.style.boxShadow = 'none' }}
          />
        </div>

        {/* Slug display */}
        <div style={{ marginBottom: 14 }}>
          <label style={{
            display: 'block', fontSize: 11, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500, marginBottom: 6,
          }}>
            URL (slug)
          </label>
          <div style={{
            padding: '7px 12px', background: 'var(--s3)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace',
          }}>
            tada-wind.fr/projets/<span style={{ color: 'var(--text)' }}>{project.slug || '—'}</span>
          </div>
        </div>

        {/* Google SERP preview */}
        <div>
          <div style={{
            fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--muted)', fontWeight: 500, marginBottom: 8,
          }}>
            Aperçu Google
          </div>
          <div style={{
            background: 'white', borderRadius: 8,
            padding: '16px 20px', fontFamily: 'Arial, sans-serif',
          }}>
            <div style={{ fontSize: 12, color: '#202124', marginBottom: 2 }}>
              tada-wind.fr › projets › {project.slug || 'projet'}
            </div>
            <div style={{ fontSize: 18, color: '#1a0dab', fontWeight: 400, marginBottom: 4, lineHeight: 1.3 }}>
              {project.seoTitle || project.title || 'Titre du projet'}
            </div>
            <div style={{ fontSize: 14, color: '#4d5156', lineHeight: 1.5 }}>
              {project.seoDesc || project.shortDesc || 'Description du projet. Cliquez pour en savoir plus sur ce projet de drone vidéo.'}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Publish button */}
      {project.status !== 'published' && (
        <Button
          variant="primary"
          size="md"
          loading={publishLoading}
          onClick={handlePublish}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          Publier maintenant
        </Button>
      )}

      {project.status === 'published' && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, padding: '12px 16px',
          background: 'var(--green-dim)', border: '1px solid rgba(34,197,94,0.2)',
          borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--green)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Ce projet est en ligne
        </div>
      )}
    </div>
  )
}
