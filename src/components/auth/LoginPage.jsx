import React, { useState } from 'react'

const IconDrone = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/>
    <path d="M7 4l-3 3M17 4l3 3M7 20l-3-3M17 20l3-3"/>
    <path d="M4 7h4M16 7h4M4 17h4M16 17h4"/>
  </svg>
)

const Spinner = () => (
  <span style={{
    display: 'inline-block',
    width: 16,
    height: 16,
    border: '2px solid rgba(255,255,255,0.2)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  }} />
)

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) return

    setLoading(true)
    setError(null)

    const { error } = await onLogin(email, password)

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Email ou mot de passe incorrect.'
          : error.message
      )
      setLoading(false)
    }
    // Si succès : onAuthStateChange dans useAuth met session à jour → App re-render
  }

  const inputStyle = {
    width: '100%',
    height: 42,
    background: 'var(--s3)',
    border: '1px solid var(--border-md)',
    borderRadius: 'var(--radius)',
    color: 'var(--text)',
    fontSize: 14,
    padding: '0 14px',
    fontFamily: 'var(--sans)',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{
        width: 360,
        animation: 'fadeIn 0.3s ease both',
      }}>
        {/* Logo */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          marginBottom: 36,
        }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: 'var(--red-dim)',
            border: '1px solid rgba(191,24,24,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--red)',
          }}>
            <IconDrone />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--serif)',
              fontSize: 22,
              color: 'var(--text)',
              letterSpacing: '0.03em',
            }}>
              TADA WIND
            </div>
            <div style={{
              fontSize: 11,
              color: 'var(--muted)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginTop: 3,
            }}>
              Administration
            </div>
          </div>
        </div>

        {/* Formulaire */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: 'var(--s1)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 28,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Email */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--muted)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@tada-wind.fr"
              required
              autoFocus
              style={inputStyle}
              onFocus={e => {
                e.target.style.borderColor = 'var(--red)'
                e.target.style.boxShadow = '0 0 0 3px var(--red-dim)'
              }}
              onBlur={e => {
                e.target.style.borderColor = 'var(--border-md)'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* Mot de passe */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--muted)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={inputStyle}
              onFocus={e => {
                e.target.style.borderColor = 'var(--red)'
                e.target.style.boxShadow = '0 0 0 3px var(--red-dim)'
              }}
              onBlur={e => {
                e.target.style.borderColor = 'var(--border-md)'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* Message d'erreur */}
          {error && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius)',
              background: 'rgba(191,24,24,0.08)',
              border: '1px solid rgba(191,24,24,0.2)',
              color: '#e57373',
              fontSize: 13,
              lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          {/* Bouton */}
          <button
            type="submit"
            disabled={loading || !email || !password}
            style={{
              width: '100%',
              height: 42,
              marginTop: 4,
              borderRadius: 'var(--radius)',
              border: 'none',
              background: loading ? 'rgba(191,24,24,0.5)' : 'var(--red)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'var(--sans)',
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'opacity 0.15s',
              opacity: (!email || !password) ? 0.5 : 1,
            }}
          >
            {loading ? <><Spinner /> Connexion…</> : 'Se connecter'}
          </button>
        </form>

        <div style={{
          textAlign: 'center',
          marginTop: 16,
          fontSize: 11,
          color: 'var(--muted2)',
        }}>
          Accès réservé à l'administrateur
        </div>
      </div>
    </div>
  )
}
