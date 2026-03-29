import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase.js'
import Button from '../ui/Button.jsx'

const SETTING_ID = 'main'

export default function SettingsPage({ onToast }) {
  const [form, setForm]       = useState({ site_title: '', site_description: '', contact_email: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [missing, setMissing] = useState(false)


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

  // Génère le bookmarklet avec l'URL courante de l'admin
  const bookmarkletHref = useMemo(() => {
    const adminUrl = `${window.location.protocol}//${window.location.host}${import.meta.env.BASE_URL}`
    const EXCLUDE = ['my-videos','login','register','upload','about','pricing','help','contact','settings','embed']
    const js = `(function(){var ids=[];var ex=${JSON.stringify(EXCLUDE)};document.querySelectorAll('a[href]').forEach(function(a){try{var u=new URL(a.href);if(u.hostname.indexOf('streamable.com')>-1){var p=u.pathname.split('/').filter(Boolean);if(p.length===1&&/^[a-zA-Z0-9]{4,8}$/.test(p[0])&&ex.indexOf(p[0])===-1)ids.push(p[0]);}}catch(e){}});ids=ids.filter(function(v,i,a){return a.indexOf(v)===i;});if(!ids.length){alert('Aucune vidéo Streamable trouvée. Vérifie d\\'être sur ta page Streamable.');return;}window.open('${adminUrl}?streamable_ids='+ids.join(','),'_blank');})()`
    return `javascript:${encodeURIComponent(js)}`
  }, [])


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

        {/* ── Bookmarklet Streamable ───────────────────────── */}
        <div style={{ marginTop: 40, paddingTop: 32, borderTop: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>
            Bookmarklet Streamable
          </h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.6 }}>
            Glisse ce bouton dans ta barre de favoris. Sur ta page Streamable, clique dessus pour envoyer automatiquement tes vidéos dans l'admin.
          </p>

          {/* Bouton à glisser */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <a
              href={bookmarkletHref}
              onClick={e => { e.preventDefault(); alert('Glisse ce bouton dans ta barre de favoris — ne clique pas ici.') }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 'var(--radius)',
                background: 'var(--blue-dim)', border: '1px solid rgba(79,127,243,0.35)',
                color: 'var(--blue)', fontSize: 13, fontWeight: 600,
                textDecoration: 'none', cursor: 'grab', userSelect: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              ▶ Sync Streamable → Admin
            </a>
            <div style={{
              flex: 1, minWidth: 200, fontSize: 12, color: 'var(--muted)',
              background: 'var(--s3)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '8px 12px', lineHeight: 1.6,
            }}>
              <strong style={{ color: 'var(--text)' }}>Comment utiliser :</strong><br />
              1. Glisse le bouton ci-contre dans ta barre de favoris<br />
              2. Va sur <strong>streamable.com/my-videos</strong><br />
              3. Clique sur le favoris → l'admin s'ouvre avec les vidéos manquantes
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
