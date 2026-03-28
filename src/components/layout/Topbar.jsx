import React, { useState } from 'react'
import Button from '../ui/Button.jsx'

const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/>
    <path d="M21 21l-4.35-4.35"/>
  </svg>
)

const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M12 5v14M5 12h14"/>
  </svg>
)

function SyncButton({ label, icon, onClick, loading, synced }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '5px 11px',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border-md)',
        background: 'transparent',
        color: 'var(--muted)',
        fontSize: 12,
        fontFamily: 'var(--sans)',
        cursor: loading ? 'wait' : 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'var(--s2)'; e.currentTarget.style.color = 'var(--text)' } }}
      onMouseLeave={e => { if (!loading) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)' } }}
    >
      {loading ? (
        <span style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          border: '1.5px solid rgba(255,255,255,0.2)',
          borderTopColor: 'var(--blue)',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
      ) : icon}
      {label}
      {!loading && (
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: synced ? 'var(--green)' : 'var(--amber)',
          animation: synced ? 'none' : 'pulse 2s ease infinite',
        }} />
      )}
    </button>
  )
}

export default function Topbar({ search, onSearch, onNewProject }) {
  const [notionLoading, setNotionLoading] = useState(false)
  const [notionSynced, setNotionSynced] = useState(true)
  const [streamableLoading, setStreamableLoading] = useState(false)
  const [streamableSynced, setStreamableSynced] = useState(true)

  const handleNotionSync = async () => {
    setNotionLoading(true)
    setNotionSynced(false)
    await new Promise(r => setTimeout(r, 2000))
    setNotionLoading(false)
    setNotionSynced(true)
  }

  const handleStreamableSync = async () => {
    setStreamableLoading(true)
    setStreamableSynced(false)
    await new Promise(r => setTimeout(r, 2000))
    setStreamableLoading(false)
    setStreamableSynced(true)
  }

  return (
    <div
      style={{
        height: 'var(--topbar-h)',
        background: 'var(--s1)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 12,
        flexShrink: 0,
      }}
    >
      {/* Search */}
      <div style={{ position: 'relative', width: 260 }}>
        <span
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--muted)',
            pointerEvents: 'none',
          }}
        >
          <IconSearch />
        </span>
        <input
          type="text"
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Rechercher un projet…"
          style={{
            width: '100%',
            height: 34,
            background: 'var(--s3)',
            border: '1px solid var(--border-md)',
            borderRadius: 'var(--radius)',
            color: 'var(--text)',
            fontSize: 13,
            paddingLeft: 32,
            paddingRight: 12,
            fontFamily: 'var(--sans)',
            outline: 'none',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--red)'; e.target.style.boxShadow = '0 0 0 3px var(--red-dim)' }}
          onBlur={e => { e.target.style.borderColor = 'var(--border-md)'; e.target.style.boxShadow = 'none' }}
        />
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Sync buttons */}
      <SyncButton
        label="Notion"
        icon={
          <span style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 800,
            color: '#000',
            flexShrink: 0,
          }}>N</span>
        }
        onClick={handleNotionSync}
        loading={notionLoading}
        synced={notionSynced}
      />

      <SyncButton
        label="Streamable"
        icon={
          <span style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: 'var(--blue-dim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 9,
            color: 'var(--blue)',
            flexShrink: 0,
          }}>▶</span>
        }
        onClick={handleStreamableSync}
        loading={streamableLoading}
        synced={streamableSynced}
      />

      {/* New project */}
      <Button variant="primary" size="sm" icon={<IconPlus />} onClick={onNewProject}>
        Nouveau projet
      </Button>
    </div>
  )
}
