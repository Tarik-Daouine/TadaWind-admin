import React, { useState, useEffect } from 'react'

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mobile
}
import StreamableImportModal from './components/projects/StreamableImportModal.jsx'
import { createStreamableImportSession, STREAMABLE_IDS_QUERY_PARAM } from './lib/streamableImport.js'
import { useAuth } from './hooks/useAuth.js'
import { useProjects } from './hooks/useProjects.js'
import { useLeads } from './hooks/useLeads.js'
import { useToast } from './hooks/useToast.js'
import LoginPage from './components/auth/LoginPage.jsx'
import Sidebar from './components/layout/Sidebar.jsx'
import Topbar from './components/layout/Topbar.jsx'
import ProjectList from './components/projects/ProjectList.jsx'
import ProjectDetail from './components/detail/ProjectDetail.jsx'
import Modal from './components/ui/Modal.jsx'
import Button from './components/ui/Button.jsx'
import Toast from './components/ui/Toast.jsx'
import MediaLibrary from './components/media/MediaLibrary.jsx'
import SettingsPage from './components/settings/SettingsPage.jsx'
import AnalyticsPage from './components/analytics/AnalyticsPage.jsx'
import LeadsList from './components/leads/LeadsList.jsx'
import LeadDetail from './components/leads/LeadDetail.jsx'
import LeadChatbot from './components/leads/LeadChatbot.jsx'

function LoadingScreen({ message = 'Chargement…' }) {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 16,
      background: 'var(--bg)',
    }}>
      <div style={{
        width: 32,
        height: 32,
        border: '2.5px solid var(--border-md)',
        borderTopColor: 'var(--red)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'var(--sans)' }}>
        {message}
      </span>
    </div>
  )
}

export default function App() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const { session, signIn, signOut, loading: authLoading } = useAuth()

  // ── Data ──────────────────────────────────────────────────────────────────
  const {
    projects,
    loading: projectsLoading,
    error: projectsError,
    createProject,
    updateProject,
    deleteProject,
    deleteProjects,
    duplicateProject,
    reorderProjects,
  } = useProjects()

  const { leads, loading: leadsLoading, createLead, updateLead, deleteLead, newLeadsCount } = useLeads()

  // ── UI state ──────────────────────────────────────────────────────────────
  const { toasts, addToast, removeToast } = useToast()
  const [view, setView]               = useState(() => window.innerWidth < 768 ? 'leads' : 'projects')
  const [selectedId, setSelectedId]   = useState(null)
  const [search, setSearch]           = useState('')
  const [filters, setFilters]         = useState({ status: 'all', category: 'all' })
  const [sort, setSort]               = useState({ field: 'date', dir: 'desc' })
  const [deleteModal, setDeleteModal]         = useState({ open: false, id: null, title: '' })
  const [deleting, setDeleting]               = useState(false)
  const [selectedLeadId, setSelectedLeadId]   = useState(null)
  const [deleteLeadModal, setDeleteLeadModal] = useState({ open: false, id: null, name: '' })
  const [deletingLead, setDeletingLead]       = useState(false)
  const mobile                                = useIsMobile()
  const [sidebarOpen, setSidebarOpen]         = useState(false)
  const [streamableImportSession, setStreamableImportSession] = useState(null)
  const [streamableImportOpen, setStreamableImportOpen]       = useState(false)

  // Flux officiel Streamable:
  // le bookmarklet ouvre l'admin avec ?streamable_ids=abc,def,ghi.
  // On normalise ces IDs, on les compare aux projets existants, puis on ouvre
  // la modale d'import. Aucun listing bulk via API n'est attendu ici.
  useEffect(() => {
    if (projectsLoading) return

    const session = createStreamableImportSession({
      search: window.location.search,
      projects,
    })
    if (!session) return

    const clean = new URL(window.location.href)
    clean.searchParams.delete(STREAMABLE_IDS_QUERY_PARAM)
    window.history.replaceState({}, '', clean.toString())

    setStreamableImportSession(session)
    setStreamableImportOpen(true)
  }, [projects, projectsLoading])

  // ── Gardes auth ───────────────────────────────────────────────────────────
  if (authLoading) return <LoadingScreen message="Initialisation…" />
  if (!session)    return <LoginPage onLogin={signIn} />

  // ── Helpers ───────────────────────────────────────────────────────────────
  const selectedProject = projects.find(p => p.id === selectedId) || null

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleNewProject = async () => {
    const p = await createProject({ title: 'Nouveau projet' })
    if (p) {
      setSelectedId(p.id)
      addToast('Nouveau projet créé', 'success')
    } else {
      addToast('Erreur lors de la création', 'error')
    }
  }

  const handleOpenStreamableImport = () => {
    setStreamableImportSession(prev => prev || {
      source: 'manual-open',
      receivedIds: [],
      invalidEntries: [],
      alreadyImported: [],
      videosToImport: [],
    })
    setStreamableImportOpen(true)
  }

  const handleStreamableImport = async (streamableId, title, meta) => {
    const p = await createProject({
      title:          title || streamableId,
      streamableId:   streamableId,
      streamableUrl:  `https://streamable.com/${streamableId}`,
      streamableMeta: meta ? { duration: meta.duration, width: meta.width, height: meta.height, source: meta.source } : null,
      cover:          meta?.thumbnail || null,
    })
    if (p) {
      addToast(`"${title || streamableId}" importé`, 'success')
      setStreamableImportSession(prev => prev ? ({
        ...prev,
        alreadyImported: [...prev.alreadyImported, { streamableId, project: p }],
        videosToImport: prev.videosToImport.filter(video => video.streamableId !== streamableId),
      }) : null)
    } else {
      addToast('Erreur lors de l\'import Streamable', 'error')
    }
  }

  const handleDelete = (id) => {
    const p = projects.find(x => x.id === id)
    setDeleteModal({ open: true, id, title: p?.title || '' })
  }

  const confirmDelete = async () => {
    setDeleting(true)
    const { error } = await deleteProject(deleteModal.id)
    setDeleting(false)

    if (error) {
      addToast('Erreur lors de la suppression', 'error')
    } else {
      if (selectedId === deleteModal.id) setSelectedId(null)
      addToast('Projet supprimé', 'success')
    }
    setDeleteModal({ open: false, id: null, title: '' })
  }

  const handleDeleteLead = (id) => {
    const l = leads.find(x => x.id === id)
    const name = [l?.prenom, l?.nom].filter(Boolean).join(' ') || l?.nomEntreprise || l?.email || 'ce lead'
    setDeleteLeadModal({ open: true, id, name })
  }

  const confirmDeleteLead = async () => {
    setDeletingLead(true)
    const { error } = await deleteLead(deleteLeadModal.id)
    setDeletingLead(false)
    if (error) {
      addToast('Erreur lors de la suppression', 'error')
    } else {
      if (selectedLeadId === deleteLeadModal.id) setSelectedLeadId(null)
      addToast('Lead supprimé', 'success')
    }
    setDeleteLeadModal({ open: false, id: null, name: '' })
  }

  const handleStatusChange = async (id, newStatus) => {
    const { error } = await updateProject(id, { status: newStatus })
    if (error) addToast('Erreur lors du changement de statut', 'error')
    else addToast('Statut mis à jour', 'success')
  }

  const handleDuplicate = async (id) => {
    const copy = await duplicateProject(id)
    if (copy) {
      setSelectedId(copy.id)
      addToast('Projet dupliqué', 'success')
    } else {
      addToast('Erreur lors de la duplication', 'error')
    }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', paddingTop: 'env(safe-area-inset-top)', boxSizing: 'border-box' }}>
      {/* Overlay sidebar mobile */}
      {mobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.5)' }}
        />
      )}
      <div style={{
        position: mobile ? 'fixed' : 'relative',
        top: 0, left: 0, height: '100vh',
        zIndex: mobile ? 60 : 'auto',
        transform: mobile && !sidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
        transition: 'transform 0.25s ease',
      }}>
        <Sidebar view={view} onView={(v) => { setView(v); if (mobile) setSidebarOpen(false) }} onSignOut={signOut} newLeadsCount={newLeadsCount} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar
          search={search}
          onSearch={setSearch}
          onNewProject={handleNewProject}
          mobile={mobile}
          onMenuToggle={() => setSidebarOpen(p => !p)}
          onOpenStreamableImport={handleOpenStreamableImport}
          hasPendingStreamableImports={(streamableImportSession?.videosToImport?.length ?? 0) > 0}
        />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Projects view */}
          {view === 'projects' && (
            <>
              {projectsLoading ? (
                <div style={{
                  flex: 1, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexDirection: 'column', gap: 12,
                }}>
                  <div style={{
                    width: 24, height: 24,
                    border: '2px solid var(--border-md)',
                    borderTopColor: 'var(--red)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Chargement des projets…
                  </span>
                </div>
              ) : projectsError ? (
                <div style={{
                  flex: 1, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ fontSize: 13, color: '#e57373' }}>Erreur de chargement</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 320, textAlign: 'center' }}>
                    {projectsError}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 4 }}>
                    Vérifiez les policies RLS dans Supabase.
                  </div>
                </div>
              ) : (
                <>
                  <div style={{
                    width: selectedId ? 380 : '100%',
                    flexShrink: 0,
                    borderRight: selectedId ? '1px solid var(--border)' : 'none',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'width 0.25s ease',
                  }}>
                    <ProjectList
                      projects={projects}
                      selectedId={selectedId}
                      onSelect={setSelectedId}
                      onDelete={handleDelete}
                      onDuplicate={handleDuplicate}
                      onBulkDelete={async (ids) => {
                        const { error } = await deleteProjects(ids)
                        if (error) addToast('Erreur lors de la suppression', 'error')
                        else {
                          if (ids.includes(selectedId)) setSelectedId(null)
                          addToast(`${ids.length} projet${ids.length > 1 ? 's' : ''} supprimé${ids.length > 1 ? 's' : ''}`, 'success')
                        }
                      }}
                      search={search}
                      filters={filters}
                      sort={sort}
                      onFilterChange={setFilters}
                      onSortChange={setSort}
                      onReorder={reorderProjects}
                      onStatusChange={handleStatusChange}
                    />
                  </div>

                  {selectedId && selectedProject && (
                    <div style={{
                      flex: 1, overflow: 'hidden',
                      animation: 'slideRight 0.2s ease both',
                    }}>
                      <ProjectDetail
                        project={selectedProject}
                        projects={projects}
                        onUpdate={updateProject}
                        onClose={() => setSelectedId(null)}
                        onToast={addToast}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Leads view */}
          {view === 'leads' && (
            leadsLoading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
                <div style={{ width: 24, height: 24, border: '2px solid var(--border-md)', borderTopColor: 'var(--red)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Chargement des leads…</span>
              </div>
            ) : (
              <>
                {/* Liste — masquée sur mobile si un lead est sélectionné */}
                {(!mobile || !selectedLeadId) && (
                  <div style={{
                    width: (!mobile && selectedLeadId) ? 420 : '100%',
                    flexShrink: 0,
                    borderRight: (!mobile && selectedLeadId) ? '1px solid var(--border)' : 'none',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'width 0.25s ease',
                  }}>
                    <LeadsList
                      leads={leads}
                      selectedId={selectedLeadId}
                      onSelect={setSelectedLeadId}
                      onDelete={handleDeleteLead}
                      onStatutChange={async (id, statut) => {
                        const { error } = await updateLead(id, { statut })
                        if (error) addToast('Erreur lors du changement de statut', 'error')
                        else addToast('Statut mis à jour', 'success')
                      }}
                      search={search}
                    />
                  </div>
                )}
                {/* Détail — plein écran sur mobile */}
                {selectedLeadId && (
                  <div style={{ flex: 1, overflow: 'hidden', animation: 'slideRight 0.2s ease both' }}>
                    <LeadDetail
                      lead={leads.find(l => l.id === selectedLeadId)}
                      onUpdate={async (id, data) => {
                        const { error } = await updateLead(id, data)
                        if (error) addToast('Erreur lors de la sauvegarde', 'error')
                        else addToast('Lead mis à jour', 'success')
                        return { error }
                      }}
                      onDelete={handleDeleteLead}
                      onClose={() => setSelectedLeadId(null)}
                    />
                  </div>
                )}
              </>
            )
          )}

          {/* Lead chatbot flottant */}
          {view === 'leads' && (
            <LeadChatbot
              hasDetail={!!selectedLeadId}
              onCreateLead={async (data) => {
                const { error } = await createLead(data)
                if (error) addToast('Erreur lors de la création', 'error')
                else addToast('Lead créé avec succès', 'success')
                return { error }
              }}
            />
          )}

          {/* Medias view */}
          {view === 'medias' && <MediaLibrary />}

          {/* Settings view */}
          {view === 'settings' && <SettingsPage onToast={addToast} />}

          {/* Analytics view */}
          {view === 'analytics' && <AnalyticsPage />}
        </div>
      </div>

      {/* Streamable import modal */}
      {streamableImportSession && streamableImportOpen && (
        <StreamableImportModal
          session={streamableImportSession}
          onClose={() => setStreamableImportOpen(false)}
          onImport={handleStreamableImport}
        />
      )}

      {/* Delete confirmation modal */}
      <Modal
        open={deleteModal.open}
        onClose={() => !deleting && setDeleteModal({ open: false, id: null, title: '' })}
        title="Supprimer le projet"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setDeleteModal({ open: false, id: null, title: '' })}
              disabled={deleting}
            >
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              loading={deleting}
            >
              Supprimer définitivement
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
          Êtes-vous sûr de vouloir supprimer{' '}
          <strong style={{ color: 'var(--text)' }}>"{deleteModal.title}"</strong> ?
          Cette action est irréversible.
        </p>
      </Modal>

      {/* Delete lead confirmation modal */}
      <Modal
        open={deleteLeadModal.open}
        onClose={() => !deletingLead && setDeleteLeadModal({ open: false, id: null, name: '' })}
        title="Supprimer le lead"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setDeleteLeadModal({ open: false, id: null, name: '' })}
              disabled={deletingLead}
            >
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={confirmDeleteLead}
              loading={deletingLead}
            >
              Supprimer définitivement
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
          Êtes-vous sûr de vouloir supprimer{' '}
          <strong style={{ color: 'var(--text)' }}>"{deleteLeadModal.name}"</strong> ?
          Cette action est irréversible.
        </p>
      </Modal>

      {/* Toast notifications */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
