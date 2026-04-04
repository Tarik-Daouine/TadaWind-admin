import React, { useMemo, useState } from 'react'
import ProjectRow from './ProjectRow.jsx'
import { CATEGORIES, STATUSES } from '../../data/mockProjects.js'
import { useIsMobile } from '../../hooks/useIsMobile.js'

const PAGE_SIZE = 12

const IconEmpty = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
    <rect x="2" y="6" width="20" height="12" rx="2"/>
    <path d="M8 6V4M16 6V4M8 18v2M16 18v2"/>
  </svg>
)

const IconChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)

const IconChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)

function SelectFilter({ value, onChange, options, label, mobile = false }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        height: mobile ? 38 : 28,
        padding: mobile ? '0 10px' : '0 8px',
        fontSize: 12,
        border: '1px solid var(--border-md)',
        borderRadius: 6,
        background: 'var(--s3)',
        color: value !== 'all' ? 'var(--text)' : 'var(--muted)',
        cursor: 'pointer',
        fontFamily: 'var(--sans)',
      }}
    >
      <option value="all">{label}</option>
      {options.map(o => {
        const val = typeof o === 'string' ? o : o.value
        const lbl = typeof o === 'string' ? o : o.label
        return <option key={val} value={val}>{lbl}</option>
      })}
    </select>
  )
}

export default function ProjectList({
  projects,
  selectedId,
  onSelect,
  onDelete,
  onDuplicate,
  onBulkDelete,
  filters,
  sort,
  search,
  onFilterChange,
  onSortChange,
  onReorder,
  onStatusChange,
  mobile: mobileProp = false,
}) {
  const hookMobile = useIsMobile()
  const mobile = mobileProp || hookMobile
  const isArchivedProject = (project) => project.status === 'archived'
  const organizeSort = (list) => [...list].sort((a, b) => {
    const bucketA = isArchivedProject(a) ? 1 : 0
    const bucketB = isArchivedProject(b) ? 1 : 0
    if (bucketA !== bucketB) return bucketA - bucketB
    return (a.order ?? 999) - (b.order ?? 999)
  })

  const [page, setPage] = useState(1)
  const [dragSrc, setDragSrc] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [checkedIds, setCheckedIds] = useState(new Set())
  const [organizeMode, setOrganizeMode] = useState(false)
  const detailOpen = !!selectedId

  const toggleCheck = (id) => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    setCheckedIds(prev =>
      prev.size === paginated.length
        ? new Set()
        : new Set(paginated.map(p => p.id))
    )
  }
  const clearSelection = () => setCheckedIds(new Set())

  // Filter + sort
  const filtered = useMemo(() => {
    if (organizeMode) {
      return organizeSort(projects)
    }

    let list = [...projects]

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.title.toLowerCase().includes(q) ||
        (p.lieu || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.slug || '').toLowerCase().includes(q) ||
        (p.region || '').toLowerCase().includes(q) ||
        (p.status || '').toLowerCase().includes(q) ||
        (p.streamableId || '').toLowerCase().includes(q) ||
        (p.tags || []).some(tag => tag.toLowerCase().includes(q))
      )
    }

    // Status filter
    if (filters.status !== 'all') {
      list = list.filter(p => p.status === filters.status)
    }

    // Category filter
    if (filters.category !== 'all') {
      list = list.filter(p => (p.category || '').toLowerCase() === filters.category.toLowerCase())
    }

    // Sort
    list.sort((a, b) => {
      let va, vb
      if (sort.field === 'date') {
        va = a.date || a.createdAt || ''
        vb = b.date || b.createdAt || ''
      } else if (sort.field === 'order') {
        va = a.order ?? 99
        vb = b.order ?? 99
      } else {
        va = (a.title || '').toLowerCase()
        vb = (b.title || '').toLowerCase()
      }
      if (va < vb) return sort.dir === 'asc' ? -1 : 1
      if (va > vb) return sort.dir === 'asc' ? 1 : -1
      return 0
    })

    return list
  }, [projects, search, filters, sort, organizeMode])

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const safePage = Math.min(page, Math.max(1, totalPages))
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const visibleProjects = organizeMode ? filtered : paginated

  const toggleSortDir = () => {
    onSortChange({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })
  }

  const handleDragStart = (idx) => setDragSrc(idx)
  const handleDragOver  = (idx) => setDragOver(idx)
  const handleDragEnd   = () => { setDragSrc(null); setDragOver(null) }
  const handleDrop      = (idx) => {
    if (!organizeMode) { handleDragEnd(); return }
    if (dragSrc === null || dragSrc === idx) { handleDragEnd(); return }
    const reordered = [...visibleProjects]
    const [moved] = reordered.splice(dragSrc, 1)
    reordered.splice(idx, 0, moved)
    const activeProjects = reordered.filter(project => !isArchivedProject(project))
    const archivedProjects = reordered.filter(project => isArchivedProject(project))
    const orderedItems = [...activeProjects, ...archivedProjects].map((p, i) => ({ id: p.id, order: i + 1 }))
    onReorder && onReorder(orderedItems)
    handleDragEnd()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: mobile ? '12px 12px 10px' : (detailOpen ? '12px 14px 10px' : '14px 16px 10px'),
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Projets</span>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '1px 7px',
              borderRadius: 20,
              background: 'var(--s3)',
              color: 'var(--muted)',
            }}>
              {filtered.length}
            </span>
          </div>

          {/* Sort */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 6,
            flexWrap: mobile ? 'nowrap' : 'wrap',
            overflowX: mobile ? 'auto' : 'visible',
            width: mobile ? '100%' : 'auto',
            paddingBottom: mobile ? 2 : 0,
          }}>
            <button
              onClick={() => {
                setOrganizeMode(prev => !prev)
                setCheckedIds(new Set())
                setPage(1)
              }}
              style={{
                fontSize: 11,
                padding: '3px 9px',
                borderRadius: 999,
                border: organizeMode ? '1px solid var(--select-accent)' : '1px solid var(--border-md)',
                background: organizeMode ? 'var(--select-bg)' : 'transparent',
                color: organizeMode ? 'var(--select-accent)' : 'var(--muted)',
                cursor: 'pointer',
                fontFamily: 'var(--sans)',
                flexShrink: 0,
              }}
            >
              {organizeMode ? (mobile ? 'Quitter' : 'Quitter organisation') : (mobile ? 'Organiser' : 'Mode organiser')}
            </button>
            {!organizeMode && !mobile && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Trier par</span>}
            {!organizeMode && <>
            <button
              onClick={() => onSortChange({ ...sort, field: 'date' })}
              style={{
                fontSize: 11,
                padding: '2px 7px',
                borderRadius: 5,
                border: '1px solid var(--border-md)',
                background: sort.field === 'date' ? 'var(--s2)' : 'transparent',
                color: sort.field === 'date' ? 'var(--text)' : 'var(--muted)',
                cursor: 'pointer',
                fontFamily: 'var(--sans)',
                flexShrink: 0,
              }}
            >
              Date
            </button>
            <button
              onClick={() => onSortChange({ ...sort, field: 'title' })}
              style={{
                fontSize: 11,
                padding: '2px 7px',
                borderRadius: 5,
                border: '1px solid var(--border-md)',
                background: sort.field === 'title' ? 'var(--s2)' : 'transparent',
                color: sort.field === 'title' ? 'var(--text)' : 'var(--muted)',
                cursor: 'pointer',
                fontFamily: 'var(--sans)',
                flexShrink: 0,
              }}
            >
              Titre
            </button>
            <button
              onClick={() => onSortChange({ ...sort, field: 'order' })}
              style={{
                fontSize: 11,
                padding: '2px 7px',
                borderRadius: 5,
                border: '1px solid var(--border-md)',
                background: sort.field === 'order' ? 'var(--s2)' : 'transparent',
                color: sort.field === 'order' ? 'var(--text)' : 'var(--muted)',
                cursor: 'pointer',
                fontFamily: 'var(--sans)',
                flexShrink: 0,
              }}
            >
              Ordre
            </button>
            <button
              onClick={toggleSortDir}
              style={{
                fontSize: 11,
                padding: '2px 6px',
                borderRadius: 5,
                border: '1px solid var(--border-md)',
                background: 'transparent',
                color: 'var(--muted)',
                cursor: 'pointer',
                fontFamily: 'var(--sans)',
                flexShrink: 0,
              }}
              title={sort.dir === 'asc' ? 'Croissant' : 'Décroissant'}
            >
              {sort.dir === 'asc' ? '↑' : '↓'}
            </button>
            </>}
          </div>
        </div>

        {/* Barre de sélection */}
        {checkedIds.size > 0 && !organizeMode && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 8,
            background: 'var(--select-bg)', borderRadius: 'var(--radius)',
            padding: '6px 10px', border: '1px solid var(--select-border)',
            gap: 10,
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={checkedIds.size === paginated.length}
                onChange={toggleAll}
                style={{ width: 14, height: 14, accentColor: 'var(--select-accent)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
                {checkedIds.size} sélectionné{checkedIds.size > 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={clearSelection}
                style={{
                  fontSize: 11, padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
                  border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--muted)',
                  fontFamily: 'var(--sans)',
                }}
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  const ids = Array.from(checkedIds)
                  clearSelection()
                  onBulkDelete && onBulkDelete(ids)
                }}
                style={{
                  fontSize: 11, padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
                  border: '1px solid rgba(191,24,24,0.4)', background: 'var(--red)', color: '#fff',
                  fontFamily: 'var(--sans)', fontWeight: 600,
                }}
              >
                Supprimer {checkedIds.size}
              </button>
            </div>
          </div>
        )}

        {organizeMode && (
          <div style={{
            marginBottom: 10,
            padding: '8px 10px',
            borderRadius: 'var(--radius)',
            background: 'var(--select-bg)',
            border: '1px solid var(--select-border)',
            fontSize: 11,
            color: 'var(--select-accent)',
            lineHeight: 1.5,
          }}>
            {mobile
              ? 'Mode organisation actif: les archives restent en fin de liste pour garder l’ordre continu des projets publies.'
              : 'Mode organisation actif: la liste est globale et triee par ordre. Les projets archives restent automatiquement en fin de liste pour conserver l\'ordre 1, 2, 3... des projets actifs.'}
          </div>
        )}

        {/* Filter bar */}
        {!organizeMode && (
        <div style={{
          display: 'flex',
          gap: 6,
          flexWrap: mobile ? 'nowrap' : 'wrap',
          overflowX: mobile ? 'auto' : 'visible',
          paddingBottom: mobile ? 2 : 0,
        }}>
          <SelectFilter
            value={filters.status}
            onChange={v => { onFilterChange({ ...filters, status: v }); setPage(1) }}
            options={STATUSES.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
            label="Statut"
            mobile={mobile}
          />
          <SelectFilter
            value={filters.category}
            onChange={v => { onFilterChange({ ...filters, category: v }); setPage(1) }}
            options={CATEGORIES}
            label="Catégorie"
            mobile={mobile}
          />
          {(filters.status !== 'all' || filters.category !== 'all') && (
            <button
              onClick={() => { onFilterChange({ status: 'all', category: 'all' }); setPage(1) }}
              style={{
                fontSize: 11,
                padding: '0 8px',
                borderRadius: 5,
                border: '1px solid var(--border-md)',
                background: 'transparent',
                color: 'var(--red)',
                cursor: 'pointer',
                fontFamily: 'var(--sans)',
                flexShrink: 0,
              }}
            >
              Effacer
            </button>
          )}
        </div>
        )}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: mobile ? '8px 10px 14px' : '10px 12px 16px' }}>
        {visibleProjects.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: 240,
            gap: 12,
            color: 'var(--muted2)',
            border: '1px dashed var(--border-md)',
            borderRadius: 18,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
          }}>
            <IconEmpty />
            <span style={{ fontSize: 13 }}>Aucun projet trouvé</span>
          </div>
        ) : (
          visibleProjects.map((project, idx) => (
            <ProjectRow
              key={project.id}
              project={project}
              isSelected={project.id === selectedId}
              displayOrder={organizeMode ? idx + 1 : project.order}
              onClick={() => checkedIds.size > 0 ? toggleCheck(project.id) : onSelect(project.id === selectedId ? null : project.id)}
              onEdit={() => onSelect(project.id)}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              isDragging={dragSrc === idx}
              isDragOver={dragOver === idx && dragSrc !== idx}
              onDragStart={organizeMode ? () => handleDragStart(idx) : undefined}
              onDragOver={organizeMode ? () => handleDragOver(idx) : undefined}
              onDragEnd={organizeMode ? handleDragEnd : undefined}
              onDrop={organizeMode ? () => handleDrop(idx) : undefined}
              onStatusChange={onStatusChange}
              isChecked={checkedIds.has(project.id)}
              onCheck={toggleCheck}
              selectionActive={!organizeMode && checkedIds.size > 0}
              draggableEnabled={organizeMode}
              showDragHandle={organizeMode}
              mobile={mobile}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {!organizeMode && totalPages > 1 && (
        <div style={{
          padding: mobile ? '10px 12px' : '10px 16px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 6,
              border: '1px solid var(--border-md)',
              background: 'transparent',
              color: safePage <= 1 ? 'var(--muted2)' : 'var(--muted)',
              cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
            }}
          >
            <IconChevronLeft />
          </button>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            Page {safePage} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 6,
              border: '1px solid var(--border-md)',
              background: 'transparent',
              color: safePage >= totalPages ? 'var(--muted2)' : 'var(--muted)',
              cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
            }}
          >
            <IconChevronRight />
          </button>
        </div>
      )}
    </div>
  )
}
