import React,{useEffect,useState} from 'react'
import { supabase } from '../../lib/supabase.js'
import { applyProspectorView } from '../../lib/prospector/views.js'
import { SectionCard } from '../ui/SectionCard.jsx'
import Button from '../ui/Button.jsx'

export default function DashboardProspection({onNavigate}) {
  const [state,setState]=useState({loading:true,counts:{},error:null})
  const [revision,setRevision]=useState(0)
  useEffect(()=>{
    let live=true
    setState(previous=>({...previous,loading:true,error:null}))
    async function load() {
      try {
        const base=()=>supabase.from('prospects').select('id',{head:true,count:'exact'}).is('deleted_at',null)
        const now=new Date().toISOString()
        const results=await Promise.all([
          base(),base().eq('status','to_validate').or('next_action_at.is.null,next_action_at.lte.'+now),
          applyProspectorView(base(),'contacted'),applyProspectorView(base(),'followups',now),applyProspectorView(base(),'opportunities'),
        ])
        if(results.some(r=>r.error))throw new Error('LOAD_FAILED')
        if(live)setState({loading:false,counts:Object.fromEntries(['prospects','validate','contacted','followups','opportunities'].map((key,i)=>[key,results[i].count??0])),error:null})
      } catch {if(live)setState({loading:false,counts:{},error:'Impossible de charger la vue d’ensemble.'})}
    }
    load()
    return ()=>{live=false}
  },[revision])
  const labels={prospects:'Prospects',validate:'À valider',contacted:'Contactés',followups:'Relances dues',opportunities:'Opportunités ouvertes'}
  return <div style={{maxWidth:1100,padding:'28px 24px',margin:'0 auto'}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,marginBottom:20}}><h2 style={{fontFamily:'var(--serif)',fontWeight:400}}>Vue d’ensemble</h2><Button onClick={()=>setRevision(r=>r+1)}>Actualiser</Button></div>
    {state.error?<p role="alert">{state.error}</p>:<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12}}>{Object.entries(labels).map(([key,label])=><SectionCard key={key}><button onClick={()=>onNavigate(key)} style={{color:'var(--text)',background:'transparent',border:0,cursor:'pointer',textAlign:'left',width:'100%'}}><div style={{fontSize:12,color:'var(--muted)'}}>{label}</div><strong style={{fontSize:30}}>{state.loading?'—':state.counts[key]}</strong></button></SectionCard>)}</div>}
    <SectionCard><h3 style={{fontSize:16,marginBottom:16}}>Ce que je dois faire maintenant</h3>
      {state.loading?<p role="status">Chargement des priorités…</p>:state.error?<p>Les priorités seront disponibles après actualisation.</p>:<>
        {state.counts.followups>0&&<p style={{marginBottom:12}}><Button onClick={()=>onNavigate('followups')}>Traiter les relances dues ({state.counts.followups})</Button></p>}
        {state.counts.validate>0&&<p style={{marginBottom:12}}><Button onClick={()=>onNavigate('validate')}>Revoir les brouillons ({state.counts.validate})</Button></p>}
        {state.counts.opportunities>0&&<p style={{marginBottom:12}}><Button onClick={()=>onNavigate('opportunities')}>Suivre les opportunités ({state.counts.opportunities})</Button></p>}
        {!state.counts.followups&&!state.counts.validate&&!state.counts.opportunities&&<p style={{color:'var(--muted)',fontSize:13,marginBottom:12}}>Aucune action prioritaire pour le moment.</p>}
      </>}
      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}><Button variant="primary" onClick={()=>onNavigate('search')}>Rechercher des entreprises</Button><Button onClick={()=>onNavigate('settings')}>Ouvrir les réglages</Button></div>
    </SectionCard>
  </div>
}
