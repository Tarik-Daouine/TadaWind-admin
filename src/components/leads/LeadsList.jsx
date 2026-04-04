import React, { useEffect, useMemo, useRef, useState } from 'react'
import LeadRow from './LeadRow.jsx'
import { LEAD_QUICK_VIEWS, countLeadsForQuickView, matchesLeadQuickView } from '../../lib/leadViews.js'
import { useIsMobile } from '../../hooks/useIsMobile.js'

const PAGE_SIZE = 15

const STATUT_OPTIONS = ['nouveau', 'Prospect contacté', 'À relancer', 'Opportunité', 'Relancé', 'Converti', 'Perdu']
const SOURCE_OPTIONS = ['tadawind_site', 'Autre', 'Réseau']
const PRIORITE_OPTIONS = ['Haute', 'Normale', 'Basse']
const CLIENT_OPTIONS = ['Particulier', 'Professionnel']

const SOURCE_LABELS = {
  'tadawind_site': 'Site',
  'Autre': 'Terrain',
  'Réseau': 'Réseau',
}

function FilterDropdown({ label, value, options, onChange, labelMap }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          padding: '6px 11px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 500,
          border: value ? '1px solid var(--select-accent)' : '1px solid var(--border-md)',
          background: value ? 'linear-gradient(180deg, rgba(79,127,243,0.18), rgba(79,127,243,0.08))' : 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
          color: value ? 'var(--select-accent)' : 'var(--muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        {value ? (labelMap ? labelMap[value] || value : value) : label}
        <span style={{ fontSize: 8, opacity: 0.7 }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            background: 'var(--s2)',
            border: '1px solid var(--border-md)',
            borderRadius: 10,
            zIndex: 100,
            boxShadow: 'var(--shadow-soft)',
            minWidth: 150,
            overflow: 'hidden',
          }}
        >
          <div
            onClick={() => { onChange(''); setOpen(false) }}
            style={{
              padding: '8px 12px',
              fontSize: 11,
              cursor: 'pointer',
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
                padding: '8px 12px',
                fontSize: 11,
                cursor: 'pointer',
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

function SummaryBadge({ label, value, tone = 'neutral', compact = false }) {
  const tones = {
    neutral: {
      background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
      border: '1px solid var(--border)',
      color: 'var(--text)',
      sub: 'var(--muted2)',
    },
    blue: {
      background: 'linear-gradient(180deg, rgba(79,127,243,0.18), rgba(79,127,243,0.06))',
      border: '1px solid rgba(79,127,243,0.24)',
      color: 'var(--blue)',
      sub: 'rgba(79,127,243,0.72)',
    },
  }

  const palette = tones[tone] || tones.neutral

  return (
    <div style={{
      minWidth: compact ? 82 : 98,
      padding: compact ? '7px 9px' : '8px 10px',
      borderRadius: 999,
      background: palette.background,
      border: palette.border,
    }}>
      <div style={{ fontSize: compact ? 9 : 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: palette.sub, marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ fontSize: compact ? 15 : 16, fontWeight: 700, color: palette.color, lineHeight: 1 }}>
        {value}
      </div>
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

const DEFAULT_FILTERS = { statut: '', source: '', typeClient: '', priorite: '' }
const DEFAULT_SORT = { field: 'date', dir: 'desc' }

export default function LeadsList({
  leads,
  selectedId,
  onSelect,
  onStatutChange,
  onDelete,
  search,
  filters = DEFAULT_FILTERS,
  onFilterChange,
  sort = DEFAULT_SORT,
  onSortChange,
  quickView = 'all',
  onQuickViewChange,
}) {
  const mobile = useIsMobile()
  const [page, setPage] = useState(1)

  const setFilter = (key, val) => {
    onFilterChange?.({ ...filters, [key]: val })
    setPage(1)
  }

  const processed = useMemo(() => {
    let list = [...leads]

    if (quickView && quickView !== 'all') {
      list = list.filter(lead => matchesLeadQuickView(lead, quickView))
    }

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(l =>
        [
          l.prenom,
          l.nom,
          l.email,
          l.telephone,
          l.nomEntreprise,
          l.ville,
          l.typeBesoin,
          l.nextStep,
          l.typeClient,
          l.priorite,
          l.statut,
          SOURCE_LABELS[l.source] || l.source,
        ].some(v => v?.toLowerCase().includes(q))
      )
    }

    if (filters.statut) list = list.filter(l => l.statut === filters.statut)
    if (filters.source) list = list.filter(l => l.source === filters.source)
    if (filters.typeClient) list = list.filter(l => l.typeClient === filters.typeClient)
    if (filters.priorite) list = list.filter(l => l.priorite === filters.priorite)

    list.sort((a, b) => {
      let av, bv
      if (sort.field === 'date') { av = a.timestamp; bv = b.timestamp }
      else if (sort.field === 'nom') { av = (a.nom || a.prenom || '').toLowerCase(); bv = (b.nom || b.prenom || '').toLowerCase() }
      else if (sort.field === 'priorite') {
        const order = { 'Haute': 0, 'Normale': 1, 'Basse': 2 }
        av = order[a.priorite] ?? 3
        bv = order[b.priorite] ?? 3
      }
      if (av < bv) return sort.dir === 'asc' ? -1 : 1
      if (av > bv) return sort.dir === 'asc' ? 1 : -1
      return 0
    })

    return list
  }, [leads, search, filters, sort, quickView])

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginated = processed.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const hasFilters = Object.values(filters).some(Boolean) || quickView !== 'all'
  const newCount = leads.filter(l => l.statut === 'nouveau').length
  const quickViewCounts = LEAD_QUICK_VIEWS.map(view => ({
    ...view,
    count: countLeadsForQuickView(leads, view.key),
  }))
  const activeVisibleQuickView = LEAD_QUICK_VIEWS.find(view => view.key === quickView)
  const hasHiddenQuickView = quickView !== 'all' && !activeVisibleQuickView
  const activeQuickViewLabel = activeVisibleQuickView?.label || (hasHiddenQuickView ? 'Vue analytics' : 'Tous les leads')
  const helperText = processed.length === leads.length
    ? `${processed.length} lead${processed.length > 1 ? 's' : ''} visibles`
    : `${processed.length} / ${leads.length} lead${leads.length > 1 ? 's' : ''}`

  const SortBtn = ({ field, label }) => {
    const active = sort.field === field
    return (
      <button
        onClick={() => onSortChange?.(
          sort.field === field
            ? { ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' }
            : { field, dir: 'desc' }
        )}
        style={{
          padding: '6px 10px',
          borderRadius: 999,
          fontSize: 11,
          border: active ? '1px solid var(--border-strong)' : '1px solid transparent',
          background: active ? 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))' : 'transparent',
          color: active ? 'var(--text)' : 'var(--muted)',
          cursor: 'pointer',
          minWidth: 68,
          fontWeight: active ? 600 : 500,
        }}
      >
        {label}{active && (sort.dir === 'asc' ? ' ↑' : ' ↓')}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        padding: mobile ? '12px 12px 10px' : '14px 16px 12px',
        flexShrink: 0,
        borderBottom: '1px solid var(--border)',
        background: 'linear-gradient(180deg, rgba(79,127,243,0.06), rgba(13,17,17,0) 58%)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 10,
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--blue)', marginBottom: 6 }}>
              CRM Workspace
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              Leads
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              {activeQuickViewLabel} · {helperText}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <SummaryBadge label="Affichés" value={processed.length} compact={mobile} />
            <SummaryBadge label="Nouveaux" value={newCount} tone="blue" compact={mobile} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            gap: 6,
            flexWrap: mobile ? 'nowrap' : 'wrap',
            overflowX: mobile ? 'auto' : 'visible',
            width: mobile ? '100%' : 'auto',
            paddingBottom: mobile ? 2 : 0,
          }}>
            {quickViewCounts.map(view => (
              <button
                key={view.key}
                onClick={() => { onQuickViewChange?.(view.key); setPage(1) }}
                style={{
                  fontSize: 11,
                  padding: '6px 11px',
                  borderRadius: 999,
                  border: quickView === view.key ? '1px solid var(--select-accent)' : '1px solid var(--border-md)',
                  background: quickView === view.key ? 'linear-gradient(180deg, rgba(79,127,243,0.18), rgba(79,127,243,0.08))' : 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                  color: quickView === view.key ? 'var(--select-accent)' : 'var(--muted)',
                  cursor: 'pointer',
                  fontFamily: 'var(--sans)',
                  fontWeight: quickView === view.key ? 600 : 500,
                  flexShrink: 0,
                }}
              >
                {view.label} ({view.count})
              </button>
            ))}
            {hasHiddenQuickView && (
              <span style={{
                fontSize: 11,
                padding: '6px 11px',
                borderRadius: 999,
                border: '1px solid var(--blue)',
                background: 'linear-gradient(180deg, rgba(79,127,243,0.18), rgba(79,127,243,0.08))',
                color: 'var(--blue)',
                fontWeight: 600,
                flexShrink: 0,
              }}>
                Vue ciblée analytics
              </span>
            )}
          </div>

          <div style={{
            display: 'inline-flex',
            gap: 4,
            padding: 3,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            overflowX: mobile ? 'auto' : 'visible',
          }}>
            <SortBtn field="date" label="Date" />
            <SortBtn field="nom" label="Nom" />
            <SortBtn field="priorite" label="Priorité" />
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: 6,
          flexWrap: mobile ? 'nowrap' : 'wrap',
          alignItems: 'center',
          overflowX: mobile ? 'auto' : 'visible',
          padding: mobile ? '8px' : '10px',
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'rgba(255,255,255,0.025)',
        }}>
          <FilterDropdown label="Statut" value={filters.statut} options={STATUT_OPTIONS} onChange={v => setFilter('statut', v)} />
          <FilterDropdown label="Source" value={filters.source} options={SOURCE_OPTIONS} onChange={v => setFilter('source', v)} labelMap={SOURCE_LABELS} />
          <FilterDropdown label="Client" value={filters.typeClient} options={CLIENT_OPTIONS} onChange={v => setFilter('typeClient', v)} />
          <FilterDropdown label="Priorité" value={filters.priorite} options={PRIORITE_OPTIONS} onChange={v => setFilter('priorite', v)} />
          {hasFilters && (
            <button
              onClick={() => {
                onFilterChange?.({ ...DEFAULT_FILTERS })
                onQuickViewChange?.('all')
                setPage(1)
              }}
              style={{
                fontSize: 11,
                color: 'var(--muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 8px',
                marginLeft: 'auto',
                flexShrink: 0,
              }}
            >
              ✕ Effacer
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: mobile ? '8px 10px 12px' : '10px 12px 16px' }}>
        {paginated.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: 240,
            color: 'var(--muted2)',
            fontSize: 12,
            gap: 10,
            border: '1px dashed var(--border-md)',
            borderRadius: 18,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
          }}>
            <span style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border)',
              fontSize: 20,
            }}>
              📋
            </span>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>Aucun lead trouvé</div>
            <div style={{ maxWidth: 240, textAlign: 'center', lineHeight: 1.5 }}>
              Essaie une autre combinaison de filtres ou reviens sur la vue complète.
            </div>
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
              mobile={mobile}
            />
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div style={{
          flexShrink: 0,
          borderTop: '1px solid var(--border)',
          padding: mobile ? '10px 12px' : '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage === 1}
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: safePage === 1 ? 'transparent' : 'rgba(255,255,255,0.04)',
              border: safePage === 1 ? '1px solid transparent' : '1px solid var(--border)',
              cursor: safePage === 1 ? 'default' : 'pointer',
              color: safePage === 1 ? 'var(--muted2)' : 'var(--muted)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <IconChevron dir="left" />
          </button>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Page {safePage} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: safePage === totalPages ? 'transparent' : 'rgba(255,255,255,0.04)',
              border: safePage === totalPages ? '1px solid transparent' : '1px solid var(--border)',
              cursor: safePage === totalPages ? 'default' : 'pointer',
              color: safePage === totalPages ? 'var(--muted2)' : 'var(--muted)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <IconChevron dir="right" />
          </button>
        </div>
      )}
    </div>
  )
}
