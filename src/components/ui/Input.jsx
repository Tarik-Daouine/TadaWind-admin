import React, { useState } from 'react'

export default function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
  error,
  multiline = false,
  rows = 3,
  style: extraStyle,
  ...rest
}) {
  const [focused, setFocused] = useState(false)

  const inputStyle = {
    width: '100%',
    background: 'var(--s3)',
    border: `1px solid ${error ? 'var(--red)' : focused ? 'var(--red)' : 'var(--border-md)'}`,
    color: 'var(--text)',
    borderRadius: 'var(--radius)',
    padding: '8px 12px',
    fontSize: 13,
    lineHeight: 1.5,
    fontFamily: 'var(--sans)',
    outline: 'none',
    boxShadow: focused ? '0 0 0 3px var(--red-dim)' : 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    resize: multiline ? 'vertical' : undefined,
    ...extraStyle,
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label
          style={{
            display: 'block',
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: 6,
            fontWeight: 500,
          }}
        >
          {label}
        </label>
      )}
      {multiline ? (
        <textarea
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={rows}
          style={inputStyle}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={inputStyle}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
      )}
      {error && (
        <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{error}</div>
      )}
      {hint && !error && (
        <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 4 }}>{hint}</div>
      )}
    </div>
  )
}
