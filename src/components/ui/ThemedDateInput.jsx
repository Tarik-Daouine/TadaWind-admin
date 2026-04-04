import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile.js'

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function pad(value) {
  return String(value).padStart(2, '0')
}

function getTodayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function parseIsoDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

function parseDisplayDate(value) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  const match = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/)
  if (!match) return null

  const [, day, month, year] = match
  const iso = `${year}-${pad(month)}-${pad(day)}`
  return parseIsoDate(iso) ? iso : null
}

function formatDisplayDate(value) {
  const date = parseIsoDate(value)
  if (!date) return value || ''
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

function getMonthDays(viewDate) {
  const monthStart = startOfMonth(viewDate)
  const monthIndex = monthStart.getMonth()
  const offset = (monthStart.getDay() + 6) % 7
  const firstVisible = new Date(monthStart)
  firstVisible.setDate(monthStart.getDate() - offset)

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstVisible)
    day.setDate(firstVisible.getDate() + index)
    return {
      key: day.toISOString(),
      iso: `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`,
      label: day.getDate(),
      isCurrentMonth: day.getMonth() === monthIndex,
      isToday: `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}` === getTodayIso(),
    }
  })
}

const IconCalendar = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
)

const IconChevron = ({ dir }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    {dir === 'left'
      ? <polyline points="15 18 9 12 15 6" />
      : <polyline points="9 18 15 12 9 6" />}
  </svg>
)

const IconClose = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)

export default function ThemedDateInput({
  value,
  onChange,
  placeholder = 'jj/mm/aaaa',
  disabled = false,
  style,
  min,
  max,
  ...rest
}) {
  const mobile = useIsMobile()
  const rootRef = useRef(null)
  const selectedDate = useMemo(() => parseIsoDate(value), [value])
  const [inputValue, setInputValue] = useState(() => formatDisplayDate(value))
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [viewDate, setViewDate] = useState(() => selectedDate || new Date())
  const [placement, setPlacement] = useState('bottom')

  useEffect(() => {
    setInputValue(formatDisplayDate(value))
    if (selectedDate) setViewDate(selectedDate)
  }, [value, selectedDate])

  useEffect(() => {
    if (!open) return
    if (mobile) {
      setPlacement('sheet')
    } else {
      const rect = rootRef.current?.getBoundingClientRect()
      if (rect) {
        const spaceBelow = window.innerHeight - rect.bottom
        const spaceAbove = rect.top
        setPlacement(spaceBelow < 320 && spaceAbove > 320 ? 'top' : 'bottom')
      }
    }

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [mobile, open])

  const monthDays = useMemo(() => getMonthDays(viewDate), [viewDate])
  const minDate = parseIsoDate(min)
  const maxDate = parseIsoDate(max)

  const emitValue = (nextValue) => {
    onChange?.(nextValue)
  }

  const commitInputValue = (rawValue) => {
    const parsed = parseDisplayDate(rawValue)
    if (parsed === '') {
      setInputValue('')
      emitValue('')
      return
    }
    if (parsed) {
      setInputValue(formatDisplayDate(parsed))
      emitValue(parsed)
      const nextDate = parseIsoDate(parsed)
      if (nextDate) setViewDate(nextDate)
      return
    }
    setInputValue(formatDisplayDate(value))
  }

  const isDisabledDate = (iso) => {
    const date = parseIsoDate(iso)
    if (!date) return true
    if (minDate && date < minDate) return true
    if (maxDate && date > maxDate) return true
    return false
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <div
        style={{
          width: '100%',
          minHeight: 34,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 10px 0 12px',
          background: 'var(--s3)',
          border: `1px solid ${focused || open ? 'var(--blue)' : 'var(--border-md)'}`,
          color: 'var(--text)',
          borderRadius: 'var(--radius)',
          boxShadow: focused || open ? '0 0 0 3px var(--blue-dim)' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          opacity: disabled ? 0.6 : 1,
          ...style,
        }}
      >
        <input
          type="text"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onFocus={() => {
            setFocused(true)
            if (!disabled) setOpen(true)
          }}
          onBlur={() => {
            setFocused(false)
            commitInputValue(inputValue)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && !disabled) {
              event.preventDefault()
              setOpen(true)
            }
            if (event.key === 'Escape') {
              setOpen(false)
            }
            if (event.key === 'Enter') {
              commitInputValue(inputValue)
              setOpen(false)
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            fontSize: 13,
            padding: '8px 0',
            boxShadow: 'none',
          }}
          {...rest}
        />
        {!!value && !disabled && (
          <button
            type="button"
            onClick={() => {
              setInputValue('')
              emitValue('')
            }}
            style={{
              width: 22,
              height: 22,
              borderRadius: 999,
              display: 'grid',
              placeItems: 'center',
              color: 'var(--muted)',
              background: 'transparent',
              flexShrink: 0,
            }}
            aria-label="Effacer la date"
          >
            <IconClose />
          </button>
        )}
        <button
          type="button"
          onClick={() => !disabled && setOpen(prev => !prev)}
          disabled={disabled}
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            display: 'grid',
            placeItems: 'center',
            color: open ? 'var(--blue)' : 'var(--muted)',
            background: open ? 'rgba(79,127,243,0.08)' : 'transparent',
            border: `1px solid ${open ? 'rgba(79,127,243,0.16)' : 'transparent'}`,
            flexShrink: 0,
          }}
          aria-label="Ouvrir le calendrier"
        >
          <IconCalendar />
        </button>
      </div>

      {open && !disabled && (
        <>
          {mobile && (
            <div
              onClick={() => setOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.35)',
                zIndex: 299,
              }}
            />
          )}
        <div
          style={{
            position: mobile ? 'fixed' : 'absolute',
            top: mobile ? 'auto' : (placement === 'bottom' ? 'calc(100% + 8px)' : 'auto'),
            bottom: mobile ? 'max(12px, env(safe-area-inset-bottom))' : (placement === 'top' ? 'calc(100% + 8px)' : 'auto'),
            left: mobile ? 12 : 'auto',
            right: mobile ? 12 : 0,
            width: mobile ? 'auto' : 278,
            padding: 12,
            background: 'var(--s2)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            boxShadow: 'var(--shadow-soft)',
            zIndex: 300,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => setViewDate(prev => addMonths(prev, -1))}
              style={{
                width: 28,
                height: 28,
                borderRadius: 10,
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
                color: 'var(--muted)',
              }}
              aria-label="Mois précédent"
            >
              <IconChevron dir="left" />
            </button>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
              {viewDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </div>
            <button
              type="button"
              onClick={() => setViewDate(prev => addMonths(prev, 1))}
              style={{
                width: 28,
                height: 28,
                borderRadius: 10,
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
                color: 'var(--muted)',
              }}
              aria-label="Mois suivant"
            >
              <IconChevron dir="right" />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 8 }}>
            {WEEKDAY_LABELS.map(day => (
              <div
                key={day}
                style={{
                  textAlign: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--muted2)',
                  textTransform: 'uppercase',
                }}
              >
                {day}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {monthDays.map(day => {
              const selected = day.iso === value
              const disabledDay = isDisabledDate(day.iso)
              return (
                <button
                  key={day.key}
                  type="button"
                  disabled={disabledDay}
                  onClick={() => {
                    setInputValue(formatDisplayDate(day.iso))
                    emitValue(day.iso)
                    setViewDate(parseIsoDate(day.iso) || viewDate)
                    setOpen(false)
                  }}
                  style={{
                    height: 32,
                    borderRadius: 10,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 12,
                    fontWeight: selected ? 700 : 500,
                    border: selected
                      ? '1px solid var(--blue)'
                      : day.isToday
                        ? '1px solid rgba(79,127,243,0.24)'
                        : '1px solid transparent',
                    background: selected
                      ? 'linear-gradient(180deg, rgba(79,127,243,0.22), rgba(79,127,243,0.08))'
                      : day.isCurrentMonth
                        ? 'rgba(255,255,255,0.03)'
                        : 'transparent',
                    color: disabledDay
                      ? 'var(--muted2)'
                      : selected
                        ? 'var(--blue)'
                        : day.isCurrentMonth
                          ? 'var(--text)'
                          : 'var(--muted)',
                    opacity: day.isCurrentMonth ? 1 : 0.72,
                    cursor: disabledDay ? 'default' : 'pointer',
                  }}
                >
                  {day.label}
                </button>
              )
            })}
          </div>
        </div>
        </>
      )}
    </div>
  )
}
