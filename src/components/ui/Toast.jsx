import React from 'react'

const TYPE_COLORS = {
  success: 'var(--green)',
  error:   'var(--red)',
  info:    'var(--blue)',
}

function ToastItem({ toast, onRemove }) {
  const dotColor = TYPE_COLORS[toast.type] || TYPE_COLORS.info

  return (
    <div
      style={{
        background: 'var(--s2)',
        border: '1px solid var(--border-md)',
        borderRadius: 'var(--radius)',
        padding: '12px 16px',
        minWidth: 280,
        maxWidth: 380,
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        animation: 'toastIn 0.25s ease both',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
    >
      {/* Dot */}
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
        }}
      />

      {/* Message */}
      <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
        {toast.message}
      </span>

      {/* Dismiss */}
      <button
        onClick={() => onRemove(toast.id)}
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--muted)',
          cursor: 'pointer',
          fontSize: 14,
          flexShrink: 0,
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)' }}
      >
        ×
      </button>
    </div>
  )
}

export default function Toast({ toasts, onRemove }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(toast => (
        <div key={toast.id} style={{ pointerEvents: 'auto' }}>
          <ToastItem toast={toast} onRemove={onRemove} />
        </div>
      ))}
    </div>
  )
}
