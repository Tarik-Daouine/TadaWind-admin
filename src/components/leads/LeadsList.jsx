import React, { useState, useMemo } from 'react'
import LeadRow from './LeadRow.jsx'

const PAGE_SIZE = 15

const STATUT_OPTIONS = ['nouveau', 'Prospect contacté', 'Opportunité', 'Relancé', 'Converti', 'Perdu']
const SOURCE_OPTIONS  = ['tadawind_site', 'Autre', 'Réseau']
const PRIORITE_OPTIONS = ['Haute', 'Normale', 'Basse']
const CLIENT_OPTIONS  = ['Particulier', 'Professionnel']

const SOURCE_LABELS = {
  'tadawind_site': 'Site',
  'Autre':         'Terrain',
  'Réseau':        'Réseau',
}

function FilterDropdown({ label, value, options, onChange, labelMap }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          padding: '4px 10px', borderRadius: 6, fontSize: 11,
          border: value ? '1px solid var(--red)' : '1px solid var(--border-md)',
          background: value ? 'var(--red-dim)' : 'var(--s2)',
          color: value ? 'var(--red)' : 'var(--muted)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        {value ? (labelMap ? labelMap[value] || value : value) : label}
        <span style={{ fontSize: 8, opacity: 0.7 }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0,
            background: 'var(--s2)', border: '1px solid var(--border-md)',
            borderRadius: 8, zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            minWidth: 140, overflow: 'hidden',
          }}
          onMouseLeave={() => setOpen(false)}
        >
          <div
            onClick={() => { onChange(''); setOpen(false) }}
            style={{
              padding: '7px 12px', fontSize: 11, cursor: 'pointer',
              color: !value ? 'var(--text)' : 'var(--muted)',
              background: !value ? 'var(--s3)' : 'transparent',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--s3)'}
            onMouseLeave={e => { e.currentTarget.style.background = !value ? 'var(--s3)' : 'transparent' }}
          >
            Tous
          </div>
          {options.map(opt => (
            <div
              key={opt}
              onClick={() => { onChange(opt); setOpen(false) }}
              style={{
                padding: '7px 12px', fontSize: 11, cursor: 'pointer',
                color: value === opt ? 'var(--text)' : 'var(--muted)',
                background: value === opt ? 'var(--s3)' : 'transparent',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--s3)'}
              onMouseLeave={e => { e.currentTarget.style.background = value === opt ? 'var(--s3)' : 'transparent' }}
            >
              {labelMap ? labelMap[opt] || opt : opt}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const IconChevron = ({ dir }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    {dir === 'left'
      ? <polyline points="15 18 9 12 15 6" />
      : <polyline points="9 18 15 12 9 6" />}
  </svg>
)

export default function LeadsList({ leads, selectedId, onSelect, onStatutChange, onDelete, search }) {
  const [filters, setFilters] = useState({ statut: '', source: '', typeClient: '', priorite: '' })
  const [sort, setSort]       = useState({ field: 'date', dir: 'desc' })
  const [page, setPage]       = useState(1)

  const setFilter = (key, val) => { setFilters(prev => ({ ...prev, [key]: val })); setPage(1) }

  const processed = useMemo(() => {
    let list = [...leads]

    // Search
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(l =>
        [l.prenom, l.nom, l.email, l.nomEntreprise, l.ville].some(v => v?.toLowerCase().includes(q))
      )
    }

    // Filters
    if (filters.statut)     list = list.filter(l => l.statut === filters.statut)
    if (filters.source)     list = list.filter(l => l.source === filters.source)
    if (filters.typeClient) list = list.filter(l => l.typeClient === filters.typeClient)
    if (filters.priorite)   list = list.filter(l => l.priorite === filters.priorite)

    // Sort
    list.sort((a, b) => {
      let av, bv
      if (sort.field === 'date') { av = a.timestamp; bv = b.timestamp }
      else if (sort.field === 'nom') { av = (a.nom || a.prenom || '').toLowerCase(); bv = (b.nom || b.prenom || '').toLowerCase() }
      else if (sort.field === 'priorite') {
        const order = { 'Haute': 0, 'Normale': 1, 'Basse': 2 }
        av = order[a.priorite] ?? 3; bv = order[b.priorite] ?? 3
      }
      if (av < bv) return sort.dir === 'asc' ? -1 : 1
      if (av > bv) return sort.dir === 'asc' ? 1 : -1
      return 0
    })

    return list
  }, [leads, search, filters, sort])

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE))
  const paginated  = processed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const hasFilters = Object.values(filters).some(Boolean)
  const newCount   = leads.filter(l => l.statut === 'nouveau').length

  const SortBtn = ({ field, label }) => {
    const active = sort.field === field
    return (
      <button
        onClick={() => setSort(prev =>
          prev.field === field
            ? { ...prev, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
            : { field, dir: 'desc' }
        )}
        style={{
          padding: '3px 8px', borderRadius: 5, fontSize: 11,
          border: active ? '1px solid var(--border-strong)' : '1px solid transparent',
          background: active ? 'var(--s3)' : 'transparent',
          color: active ? 'var(--text)' : 'var(--muted)',
          cursor: 'pointer',
        }}
      >
        {label}{active && (sort.dir === 'asc' ? ' ↑' : ' ↓')}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 14px 8px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Leads</span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '1px 7px',
              borderRadius: 20, background: 'var(--s3)', color: 'var(--muted)',
            }}>
              {processed.length}
            </span>
            {newCount > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '1px 6px',
                borderRadius: 20, background: '#4f7ff322', color: '#4f7ff3',
                border: '1px solid #4f7ff344',
              }}>
                {newCount} nouveau{newCount > 1 ? 'x' : ''}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            <SortBtn field="date"     label="Date" />
            <SortBtn field="nom"      label="Nom" />
            <SortBtn field="priorite" label="Priorité" />
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          <FilterDropdown label="Statut"   value={filters.statut}     options={STATUT_OPTIONS}  onChange={v => setFilter('statut', v)} />
          <FilterDropdown label="Source"   value={filters.source}     options={SOURCE_OPTIONS}  onChange={v => setFilter('source', v)} labelMap={SOURCE_LABELS} />
          <FilterDropdown label="Client"   value={filters.typeClient} options={CLIENT_OPTIONS}  onChange={v => setFilter('typeClient', v)} />
          <FilterDropdown label="Priorité" value={filters.priorite}   options={PRIORITE_OPTIONS} onChange={v => setFilter('priorite', v)} />
          {hasFilters && (
            <button
              onClick={() => { setFilters({ statut: '', source: '', typeClient: '', priorite: '' }); setPage(1) }}
              style={{ fontSize: 10, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 4px' }}
            >
              ✕ Effacer
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {paginated.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--muted2)', fontSize: 12, gap: 6 }}>
            <span style={{ fontSize: 24 }}>📋</span>
            Aucun lead trouvé
          </div>
        ) : (
          paginated.map(lead => (
            <LeadRow
              key={lead.id}
              lead={lead}
              isSelected={lead.id === selectedId}
              onClick={() => onSelect(lead.id)}
              onStatutChange={onStatutChange}
              onDelete={onDelete}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          flexShrink: 0, borderTop: '1px solid var(--border)',
          padding: '8px 14px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ background: 'none', border: 'none', cursor: page === 1 ? 'default' : 'pointer', color: page === 1 ? 'var(--muted2)' : 'var(--muted)', padding: 4 }}
          >
            <IconChevron dir="left" />
          </button>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Page {page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{ background: 'none', border: 'none', cursor: page === totalPages ? 'default' : 'pointer', color: page === totalPages ? 'var(--muted2)' : 'var(--muted)', padding: 4 }}
          >
            <IconChevron dir="right" />
          </button>
        </div>
      )}
    </div>
  )
}
