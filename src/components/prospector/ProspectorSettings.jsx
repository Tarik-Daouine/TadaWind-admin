import React, { useEffect, useState } from 'react'
import { useProspectorSettings } from '../../hooks/useProspectorSettings.js'
import { SectionCard, SectionTitle } from '../ui/SectionCard.jsx'
import Input from '../ui/Input.jsx'
import Button from '../ui/Button.jsx'

const labelStyle = { display:'block',fontSize:11,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--muted)',marginBottom:6,fontWeight:500 }
const selectStyle = { width:'100%',background:'var(--s3)',border:'1px solid var(--border-md)',color:'var(--text)',borderRadius:'var(--radius)',padding:'8px 12px',fontSize:13,fontFamily:'var(--sans)',outline:'none' }
const grid = { display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:'0 16px' }
const lines = value => (value ?? []).join('\n')
const parseLines = value => value.split(/\r?\n/)

function NumberField({ label, value, onChange, min=0, max, step='1', hint }) {
  return <Input label={label} type="number" min={min} max={max} step={step} value={value ?? ''} onChange={e=>onChange(e.target.value)} hint={hint}/>
}
function Toggle({ label, checked, onChange }) {
  return <label style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,padding:'10px 12px',background:'var(--s3)',border:'1px solid var(--border)',borderRadius:'var(--radius)',fontSize:13,color:'var(--text)'}}>
    {label}<input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} style={{accentColor:'var(--red)',width:16,height:16}}/>
  </label>
}

export default function ProspectorSettings({ onToast }) {
  const { settings,loading,saving,error,reload,save } = useProspectorSettings()
  const [form,setForm] = useState(null)
  useEffect(()=>{ if(settings) setForm(structuredClone(settings)) },[settings])
  const set = (key,value) => setForm(previous=>({...previous,[key]:value}))
  const setProfile = (key,value) => setForm(previous=>({...previous,business_profile:{...previous.business_profile,[key]:value}}))
  const handleSave = async () => {
    const result = await save(form)
    if(result) onToast?.('Réglages Prospection sauvegardés','success')
  }
  if(loading && !form) return <State label="Chargement des réglages…"/>
  if(!form) return <State label={error || 'Réglages indisponibles'} action="Réessayer" onAction={reload}/>
  const weights = form.scoring_weights
  const weightLabels = {fit_tada_wind:'Adéquation Tada Wind',video_interest:'Besoin vidéo',drone_interest:'Besoin drone',commercial_potential:'Potentiel commercial',digital_gap:'Écart numérique',geo_access:'Proximité',buying_signal:'Signal d’achat',contactability:'Contact disponible'}
  const weightTotal = Object.keys(weightLabels).reduce((sum,key)=>sum+Number(weights[key] || 0),0)
  return <div style={{maxWidth:980,margin:'0 auto',padding:'28px 24px 48px'}}>
    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:20,marginBottom:24,flexWrap:'wrap'}}>
      <div><h2 style={{fontFamily:'var(--serif)',fontSize:24,fontWeight:400,color:'var(--text)',marginBottom:5}}>Réglages Prospection</h2>
        <p style={{fontSize:13,color:'var(--muted)',lineHeight:1.6}}>Ces informations encadrent la recherche, le score et les futurs brouillons. Elles ne déclenchent aucun envoi.</p></div>
      <div style={{display:'flex',gap:8}}><Button size="sm" onClick={reload} disabled={saving}>Recharger</Button><Button variant="primary" size="sm" onClick={handleSave} loading={saving}>Sauvegarder</Button></div>
    </div>
    {error&&<div role="alert" style={{padding:'11px 14px',marginBottom:16,borderRadius:'var(--radius)',border:'1px solid rgba(191,24,24,.35)',background:'var(--red-dim)',color:'#f38b8b',fontSize:12,lineHeight:1.5}}>{error}</div>}
    <SectionCard><SectionTitle>Profil commercial</SectionTitle><div style={grid}>
      <Input label="Entreprise" value={form.business_profile.business ?? ''} onChange={e=>setProfile('business',e.target.value)}/>
      <Input label="Positionnement" value={form.business_profile.positioning ?? ''} onChange={e=>setProfile('positioning',e.target.value)}/>
    </div><Input label="Prestations — une par ligne" multiline rows={5} value={lines(form.business_profile.services)} onChange={e=>setProfile('services',parseLines(e.target.value))}/>
    <div style={grid}><Input label="Cibles — une par ligne" multiline rows={4} value={lines(form.business_profile.targetCustomers)} onChange={e=>setProfile('targetCustomers',parseLines(e.target.value))}/>
      <Input label="Zones préférées — une par ligne" multiline rows={4} value={lines(form.business_profile.preferredAreas)} onChange={e=>setProfile('preferredAreas',parseLines(e.target.value))}/></div>
    <Input label="Notes pour les propositions" multiline rows={4} value={form.business_profile.pitchNotes ?? ''} onChange={e=>setProfile('pitchNotes',e.target.value)} hint="Les notes guident les idées commerciales ; elles ne deviennent pas des faits sur le prospect."/>
    <Input label="Email professionnel Tada Wind" type="email" value={form.business_profile.contactInfo?.email ?? ''} onChange={e=>setProfile('contactInfo',{...(form.business_profile.contactInfo ?? {}),email:e.target.value})}/></SectionCard>

    <SectionCard><SectionTitle>Zone de prospection</SectionTitle><Input label="Adresse de référence" value={form.reference_address} onChange={e=>set('reference_address',e.target.value)} hint="Les coordonnées seront utilisées pour les calculs de distance après géocodage."/>
      <div style={grid}><NumberField label="Rayon préféré (km)" value={form.radius_preferred_km} max={2000} onChange={v=>set('radius_preferred_km',v)}/><NumberField label="Rayon maximum (km)" value={form.radius_max_km} max={2000} onChange={v=>set('radius_max_km',v)}/>
      <NumberField label="Latitude" value={form.reference_lat} min={-90} max={90} step="any" onChange={v=>set('reference_lat',v)}/><NumberField label="Longitude" value={form.reference_lng} min={-180} max={180} step="any" onChange={v=>set('reference_lng',v)}/></div>
      <div style={grid}><Input label="Catégories autorisées — une par ligne" multiline value={lines(form.enabled_categories)} onChange={e=>set('enabled_categories',parseLines(e.target.value))} hint="Vide : toutes les catégories non exclues."/><Input label="Catégories exclues — une par ligne" multiline value={lines(form.disabled_categories)} onChange={e=>set('disabled_categories',parseLines(e.target.value))}/></div></SectionCard>

    <SectionCard><SectionTitle>Priorités et score</SectionTitle><div style={grid}><NumberField label="Score minimum" value={form.min_score} max={100} onChange={v=>set('min_score',v)}/>
      {Object.entries({hot:'Très chaud',good:'Bon prospect',consider:'À considérer',low:'Faible priorité'}).map(([key,label])=><NumberField key={key} label={`Seuil ${label}`} value={form.priority_thresholds[key]} max={100} onChange={v=>set('priority_thresholds',{...form.priority_thresholds,[key]:v})}/>)}</div>
      <div style={{...grid,marginTop:6}}>{Object.entries(weightLabels).map(([key,label])=><NumberField key={key} label={`${label} / 100`} value={weights[key]} max={100} onChange={v=>set('scoring_weights',{...weights,[key]:v})}/>)}</div>
      <div style={{fontSize:12,color:weightTotal===100?'var(--green)':'var(--red)',marginBottom:16}}>Total du barème : {weightTotal}/100 · version {weights.version}</div>
      <div style={grid}>{form.distance_bands.map((band,index)=><div key={index} style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><NumberField label={`Bande ${index+1} — km max`} value={band.max} max={2000} onChange={v=>set('distance_bands',form.distance_bands.map((item,i)=>i===index?{...item,max:v}:item))}/><NumberField label="Points / 5" value={band.points} max={5} onChange={v=>set('distance_bands',form.distance_bands.map((item,i)=>i===index?{...item,points:v}:item))}/></div>)}</div></SectionCard>

    <SectionCard><SectionTitle>Messages, canaux et coûts</SectionTitle><Input label="Ton" value={form.tone} onChange={e=>set('tone',e.target.value)}/><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginBottom:18}}>
      {Object.entries({email:'Email',instagram:'Instagram',linkedin:'LinkedIn',phone:'Téléphone'}).map(([key,label])=><Toggle key={key} label={label} checked={!!form.channels[key]} onChange={v=>set('channels',{...form.channels,[key]:v})}/>)}</div>
      <div style={grid}><Input label="Modèle IA simple" value={form.ai_model_simple ?? ''} onChange={e=>set('ai_model_simple',e.target.value)} placeholder="À configurer après vérification"/><Input label="Modèle IA complexe" value={form.ai_model_complex ?? ''} onChange={e=>set('ai_model_complex',e.target.value)} placeholder="À configurer après vérification"/>
      <NumberField label="Budget IA mensuel (USD)" value={form.monthly_budget_usd} step="0.01" onChange={v=>set('monthly_budget_usd',v)} hint="Laisse vide tant que le plafond n’est pas décidé."/>
      <Input label="Relances — jours séparés par des virgules" value={(form.followup_delays_days ?? []).join(', ')} onChange={e=>set('followup_delays_days',e.target.value.split(',').map(v=>v.trim()))}/></div>
      <div style={{fontSize:12,color:'var(--muted)',lineHeight:1.6}}>Les modèles vides désactivent naturellement les étapes IA. Les clés restent exclusivement dans les secrets Supabase.</div></SectionCard>
    <div style={{display:'flex',justifyContent:'flex-end'}}><Button variant="primary" onClick={handleSave} loading={saving}>Sauvegarder les réglages</Button></div>
  </div>
}

function State({label,action,onAction}) { return <div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12,color:'var(--muted)',fontSize:13}}><span>{label}</span>{action&&<Button onClick={onAction}>{action}</Button>}</div> }
