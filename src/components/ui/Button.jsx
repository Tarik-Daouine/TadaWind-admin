import React from 'react'

const VARIANTS = {
  primary: {
    background: 'var(--red)',
    color: '#fff',
    border: 'none',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text)',
    border: '1px solid var(--border-md)',
  },
  danger: {
    background: 'transparent',
    color: 'var(--red)',
    border: '1px solid rgba(191,24,24,0.3)',
  },
  subtle: {
    background: 'var(--s2)',
    color: 'var(--muted)',
    border: 'none',
  },
}

const SIZES = {
  sm: { padding: '5px 12px', fontSize: 12 },
  md: { padding: '7px 16px', fontSize: 13 },
}

function Spinner() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 14,
        height: 14,
        border: '2px solid rgba(255,255,255,0.2)',
        borderTopColor: 'currentColor',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        flexShrink: 0,
      }}
    />
  )
}

export default function Button({
  variant = 'ghost',
  size = 'md',
  icon,
  loading = false,
  children,
  style: extraStyle,
  ...rest
}) {
  const variantStyle = VARIANTS[variant] || VARIANTS.ghost
  const sizeStyle = SIZES[size] || SIZES.md

  const hoverStyles = {
    primary: { filter: 'brightness(1.12)' },
    ghost:   { background: 'var(--s2)' },
    danger:  { background: 'var(--red-dim)' },
    subtle:  { color: 'var(--text)' },
  }

  return (
    <button
      {...rest}
      disabled={loading || rest.disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 'var(--radius)',
        fontFamily: 'var(--sans)',
        fontWeight: 500,
        cursor: (loading || rest.disabled) ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
        opacity: (loading || rest.disabled) ? 0.7 : 1,
        ...variantStyle,
        ...sizeStyle,
        ...extraStyle,
      }}
      onMouseEnter={e => {
        if (!loading && !rest.disabled) {
          const h = hoverStyles[variant]
          if (h) Object.assign(e.currentTarget.style, h)
        }
      }}
      onMouseLeave={e => {
        if (!loading && !rest.disabled) {
          Object.assign(e.currentTarget.style, variantStyle)
          e.currentTarget.style.filter = ''
        }
      }}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  )
}
