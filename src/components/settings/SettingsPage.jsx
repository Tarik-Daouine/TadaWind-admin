import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { getStreamableCredentials, saveStreamableCredentials } from '../../lib/streamable.js'
import Button from '../ui/Button.jsx'

const SETTING_ID = 'main'

export default function SettingsPage({ onToast }) {
  const [form, setForm]       = useState({ site_title: '', site_description: '', contact_email: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [missing, setMissing] = useState(false)

  // Credentials Streamable — stockés en localStorage uniquement
  const [stCreds, setStCreds]     = useState(() => getStreamableCredentials())
  const [showPass, setShowPass]   = useState(false)
  const [savingCreds, setSavingCreds] = useState(false)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', SETTING_ID)
        .single()

      if (error) {
        // Table may not exist yet
        setMissing(true)
        setLoading(false)
        return
      }

      setForm({
        site_title:       data.site_title       || '',
        site_description: data.site_description || '',
        contact_email:    data.contact_email    || '',
      })
      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('settings')
      .upsert({ id: SETTING_ID, ...form, updated_at: new Date().toISOString() })

    setSaving(false)
    if (error) {
      onToast && onToast('Erreur lors de la sauvegarde', 'error')
    } else {
      onToast && onToast('Réglages sauvegardés', 'success')
    }
  }

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const handleSaveCreds = () => {
    setSavingCreds(true)
    saveStreamableCredentials(stCreds.email, stCreds.password)
    setTimeout(() => setSavingCreds(false), 600)
    onToast?.('Identifiants Streamable sauvegardés', 'success')
  }

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--muted)' }}>
        <div style={{ width: 20, height: 20, border: '2px solid var(--border-md)', borderTopColor: 'var(--red)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: 13 }}>Chargement…</span>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>Réglages</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 32 }}>Informations générales du site public.</p>

        {missing && (
          <div style={{
            padding: '12px 16px', marginBottom: 24,
            background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--amber)', lineHeight: 1.6,
          }}>
            <strong>Table manquante.</strong> Exécute ce SQL dans Supabase pour activer les réglages :
            <pre style={{ marginTop: 8, fontSize: 11, background: 'var(--s3)', padding: '10px 12px', borderRadius: 6, color: 'var(--text)', overflowX: 'auto' }}>{`CREATE TABLE IF NOT EXISTS settings (
  id text PRIMARY KEY DEFAULT 'main',
  site_title text,
  site_description text,
  contact_email text,
  updated_at timestamptz DEFAULT now()
);
INSERT INTO settings (id) VALUES ('main')
  ON CONFLICT DO NOTHING;

-- Policy lecture publique
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_settings" ON settings
  FOR SELECT USING (true);
CREATE POLICY "admin_write_settings" ON settings
  FOR ALL USING (auth.role() = 'authenticated');`}</pre>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Titre */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Titre du site
            </label>
            <input
              type="text"
              value={form.site_title}
              onChange={e => set('site_title', e.target.value)}
              placeholder="Tada Wind"
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = 'var(--red)'; e.target.style.boxShadow = '0 0 0 3px var(--red-dim)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border-md)'; e.target.style.boxShadow = 'none' }}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Description
            </label>
            <textarea
              value={form.site_description}
              onChange={e => set('site_description', e.target.value)}
              placeholder="Photographe et vidéaste drone professionnel…"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', height: 'auto', padding: '8px 12px', lineHeight: 1.6 }}
              onFocus={e => { e.target.style.borderColor = 'var(--red)'; e.target.style.boxShadow = '0 0 0 3px var(--red-dim)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border-md)'; e.target.style.boxShadow = 'none' }}
            />
          </div>

          {/* Email */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Email de contact
            </label>
            <input
              type="email"
              value={form.contact_email}
              onChange={e => set('contact_email', e.target.value)}
              placeholder="contact@tada-wind.fr"
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = 'var(--red)'; e.target.style.boxShadow = '0 0 0 3px var(--red-dim)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border-md)'; e.target.style.boxShadow = 'none' }}
            />
          </div>

          <div style={{ paddingTop: 8 }}>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              Sauvegarder
            </Button>
          </div>
        </div>

        {/* ── Streamable ────────────────────────────────────────── */}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 32, paddingTop: 28 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>
            Compte Streamable
          </h3>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.5 }}>
            Utilisés pour lister et importer vos vidéos depuis Streamable.
            Stockés uniquement dans ce navigateur, jamais envoyés à Supabase.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Email
              </label>
              <input
                type="email"
                value={stCreds.email}
                onChange={e => setStCreds(p => ({ ...p, email: e.target.value }))}
                placeholder="votre@email.com"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'var(--red)'; e.target.style.boxShadow = '0 0 0 3px var(--red-dim)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border-md)'; e.target.style.boxShadow = 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={stCreds.password}
                  onChange={e => setStCreds(p => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                  style={{ ...inputStyle, paddingRight: 40 }}
                  onFocus={e => { e.target.style.borderColor = 'var(--red)'; e.target.style.boxShadow = '0 0 0 3px var(--red-dim)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border-md)'; e.target.style.boxShadow = 'none' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--muted)', fontSize: 13, padding: 2,
                  }}
                >{showPass ? '🙈' : '👁'}</button>
              </div>
            </div>
            <div style={{ paddingTop: 4 }}>
              <Button variant="ghost" onClick={handleSaveCreds} loading={savingCreds}>
                Sauvegarder les identifiants
              </Button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  height: 38,
  padding: '0 12px',
  background: 'var(--s3)',
  border: '1px solid var(--border-md)',
  borderRadius: 'var(--radius)',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'var(--sans)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}
