import React, { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useProspectorSettings } from '../../hooks/useProspectorSettings.js'
import { SectionCard } from '../ui/SectionCard.jsx'
import Input from '../ui/Input.jsx'
import Button from '../ui/Button.jsx'

const CATEGORIES = { hotels:'Hôtels et hébergements', campsites:'Campings', restaurants:'Restaurants et cafés', tourism:'Tourisme et patrimoine', events:'Lieux événementiels', real_estate:'Agences immobilières', architecture:'Architectes', leisure:'Loisirs' }

export default function SearchCampaign({ onToast }) {
  const { settings, loading, error: settingsError, reload } = useProspectorSettings()
  const [name,setName] = useState('')
  const [radius,setRadius] = useState('')
  const [categories,setCategories] = useState([])
  const [pending,setPending] = useState(false)
  const [error,setError] = useState(null)
  const [created,setCreated] = useState(null)
  const lock = useRef(false)
  const maxRadius = Math.min(200, settings?.radius_max_km ?? 200)
  const effectiveRadius = radius === '' ? Math.min(settings?.radius_preferred_km ?? 40,maxRadius) : Number(radius)
  const allowed = Object.entries(CATEGORIES).filter(([id]) => !settings?.disabled_categories?.includes(id) && (!settings?.enabled_categories?.length || settings.enabled_categories.includes(id)))
  const selected = categories.filter(id => allowed.some(([key]) => key === id))

  async function submit(event) {
    event.preventDefault()
    if(lock.current || !settings) return
    if(!name.trim() || !selected.length || !Number.isFinite(effectiveRadius) || effectiveRadius<1 || effectiveRadius>maxRadius) {
      setError('Renseigne un nom, au moins une catégorie et un rayon valide.'); return
    }
    lock.current=true; setPending(true); setError(null); setCreated(null)
    try {
      const result = await supabase.rpc('prospector_start_campaign',{p_name:name.trim(),p_filters:{categories:selected,radius_km:effectiveRadius}})
      if(result.error) throw result.error
      setCreated(result.data)
      window.dispatchEvent(new CustomEvent('prospector:job-created'))
      onToast?.('Recherche ajoutée à la file de traitement','success')
    } catch(cause) {
      setError(cause?.message?.includes('QUEUE_CAPACITY_REACHED') ? 'La file est pleine. Attends la fin des traitements avant de réessayer.' : 'La création de la recherche n’a pas pu être confirmée. Vérifie les traitements en cours avant de réessayer.')
    } finally { lock.current=false; setPending(false) }
  }

  return <div style={{maxWidth:850,margin:'0 auto',padding:'28px 24px'}}>
    <h2 style={{fontFamily:'var(--serif)',fontWeight:400,marginBottom:12}}>Rechercher des entreprises</h2>
    <p style={{fontSize:13,color:'var(--muted)',lineHeight:1.6,marginBottom:20}}>Recherche dans OpenStreetMap, puis collecte des sites disponibles. Les fiches apparaîtront dans Prospects ; les brouillons préparés seront à valider avant tout contact.</p>
    {loading ? <p>Chargement des réglages…</p> : settingsError ? <div role="alert">{settingsError} <Button onClick={reload}>Réessayer</Button></div> : settings && <SectionCard>
      <form onSubmit={submit}>
        <Input label="Nom de la recherche" required maxLength={300} value={name} onChange={e=>setName(e.target.value)} placeholder="Hôtels autour de Sarlat"/>
        <p style={{fontSize:12,color:'var(--muted)',marginBottom:14}}>Autour de {settings.reference_address} · zone modifiable dans Réglages.</p>
        <Input label="Rayon de recherche (km)" type="number" min={1} max={maxRadius} required value={effectiveRadius} onChange={e=>setRadius(e.target.value)}/>
        <fieldset style={{border:'1px solid var(--border)',borderRadius:6,padding:14,margin:'8px 0 20px'}}>
          <legend style={{fontSize:12}}>Catégories d’entreprises</legend>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>{allowed.map(([id,label])=><label key={id} style={{display:'flex',gap:8,fontSize:12}}><input type="checkbox" checked={selected.includes(id)} onChange={e=>setCategories(previous=>e.target.checked?[...previous,id]:previous.filter(value=>value!==id))}/>{label}</label>)}</div>
          {!allowed.length && <p>Aucune catégorie de recherche disponible avec les réglages actuels.</p>}
        </fieldset>
        <p style={{fontSize:12,color:'var(--muted)',marginBottom:16}}>Jusqu’à 50 résultats par recherche. La couverture OpenStreetMap peut être incomplète.</p>
        {error && <p role="alert" style={{color:'var(--red)',marginBottom:12}}>{error}</p>}
        {created && <p role="status" style={{color:'var(--green)',marginBottom:12}}>Recherche « {created.name} » enregistrée. Le traitement s’effectue en arrière-plan.</p>}
        <Button type="submit" variant="primary" loading={pending} disabled={!selected.length || !name.trim() || !!created}>Lancer la recherche</Button>
        {created && <Button type="button" onClick={()=>{setCreated(null);setName('')}} style={{marginLeft:8}}>Nouvelle recherche</Button>}
      </form>
    </SectionCard>}
  </div>
}
