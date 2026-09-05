import React, { useState } from 'react'
import ProspectorSettings from './ProspectorSettings.jsx'
import { SectionCard } from '../ui/SectionCard.jsx'
import ProspectsWorkspace from './ProspectsWorkspace.jsx'
import ValidationQueue from './ValidationQueue.jsx'
import { prospectorJobError, prospectorJobLabel, useProspectorJobs } from '../../hooks/useProspectorJobs.js'

const VIEWS = [
  ['dashboard','Vue d’ensemble'],['search','Recherche'],['prospects','Prospects'],['validate','À valider'],
  ['contacted','Contactés'],['followups','Relances'],['opportunities','Opportunités'],['campaigns','Campagnes'],['settings','Réglages'],
]
const TITLES = Object.fromEntries(VIEWS)
const NEXT = {
  dashboard:['Le socle de prospection est prêt','Configure le profil, la zone et le barème pour préparer les premières campagnes.'],
  search:['Découverte en préparation','La recherche OpenStreetMap sera activée avec le worker. Aucun prospect fictif ne sera créé.'],
  prospects:['Aucun prospect pour le moment','Les fiches apparaîtront ici après ajout manuel ou découverte vérifiée.'],
  contacted:['Aucun contact enregistré','Un prospect arrivera ici après confirmation manuelle de son envoi.'],
  followups:['Aucune relance à traiter','Les échéances seront calculées à partir des réglages, puis proposées pour validation.'],
  opportunities:['Aucune opportunité ouverte','Les opportunités seront créées à partir des prospects qualifiés et revus.'],
  campaigns:['Aucune campagne lancée','Les campagnes utiliseront ta zone et les catégories configurées.'],
}

const FULL_HEIGHT_VIEWS = new Set(['prospects','validate'])

export default function ProspectorApp({onToast}) {
  const [view,setView] = useState('dashboard')
  const [focusProspectId,setFocusProspectId] = useState(null)
  const jobs = useProspectorJobs()
  const openProspect = (id) => { setFocusProspectId(id); setView('prospects') }
  return <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0}}>
    <div style={{padding:'17px 22px 0',background:'var(--s1)',borderBottom:'1px solid var(--border)',flexShrink:0}}>
      <div style={{display:'flex',alignItems:'baseline',gap:10,marginBottom:14}}><h1 style={{fontFamily:'var(--serif)',fontSize:22,fontWeight:400}}>Prospection</h1><span style={{fontSize:11,color:'var(--muted2)'}}>assistant commercial</span></div>
      <div role="tablist" aria-label="Navigation Prospection" style={{display:'flex',gap:4,overflowX:'auto'}}>{VIEWS.map(([id,label])=><button key={id} role="tab" aria-selected={view===id} onClick={()=>setView(id)} style={{border:'none',borderBottom:`2px solid ${view===id?'var(--red)':'transparent'}`,background:'transparent',color:view===id?'var(--text)':'var(--muted)',fontFamily:'var(--sans)',fontSize:12,fontWeight:500,padding:'8px 10px 10px',cursor:'pointer',whiteSpace:'nowrap'}}>{label}</button>)}</div>
    </div>
    <JobStatus jobs={jobs}/>
    <div style={{flex:1,overflow:FULL_HEIGHT_VIEWS.has(view)?'hidden':'auto'}}>
      {view==='settings' ? <ProspectorSettings onToast={onToast}/>
        : view==='prospects' ? <ProspectsWorkspace onToast={onToast} focusProspectId={focusProspectId}/>
        : view==='validate' ? <ValidationQueue onToast={onToast} onOpenProspect={openProspect}/>
        : <Placeholder view={view} onSettings={()=>setView('settings')}/>}
    </div>
  </div>
}

function JobStatus({jobs}) {
  if(jobs.active.length){const job=jobs.active[0];return <div role="status" style={statusStyle}><span style={{color:'var(--amber)',fontSize:15}}>●</span><span><strong>{prospectorJobLabel(job)}</strong> {job.status==='running'?'en cours':'en attente'}{jobs.active.length>1?` · ${jobs.active.length} traitements actifs`:''}</span></div>}
  if(jobs.latestError)return <div role="alert" style={{...statusStyle,color:'var(--red)'}}><span>⚠</span><span><strong>{prospectorJobLabel(jobs.latestError)} :</strong> {prospectorJobError(jobs.latestError.error)}</span></div>
  if(jobs.error)return <div role="alert" style={{...statusStyle,color:'var(--red)'}}>{jobs.error}</div>
  return null
}

const statusStyle={padding:'8px 22px',borderBottom:'1px solid var(--border)',background:'var(--s2)',color:'var(--muted)',fontSize:11,display:'flex',alignItems:'center',gap:8,flexShrink:0}

function Placeholder({view,onSettings}) {
  const [title,description]=NEXT[view]
  return <div style={{maxWidth:980,margin:'0 auto',padding:'28px 24px'}}><div style={{marginBottom:20}}><h2 style={{fontFamily:'var(--serif)',fontSize:24,fontWeight:400,marginBottom:5}}>{TITLES[view]}</h2><p style={{fontSize:13,color:'var(--muted)'}}>{description}</p></div>
    <SectionCard><div style={{minHeight:190,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12,textAlign:'center'}}><div style={{width:42,height:42,borderRadius:'50%',display:'grid',placeItems:'center',background:'var(--red-dim)',color:'var(--red)',fontSize:18}}>◎</div><strong style={{fontSize:14}}>{title}</strong>{view==='dashboard'&&<button onClick={onSettings} style={{border:'1px solid var(--border-md)',borderRadius:'var(--radius)',background:'var(--s3)',color:'var(--text)',padding:'7px 12px',fontFamily:'var(--sans)',cursor:'pointer'}}>Ouvrir les réglages</button>}</div></SectionCard>
  </div>
}
