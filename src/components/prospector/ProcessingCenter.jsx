import React, { useEffect, useRef, useState } from 'react'
import { prospectorJobError, prospectorJobLabel, prospectorJobState, prospectorJobSubject } from '../../hooks/useProspectorJobs.js'

const stageOrder = ['discovery','enrich','analyze','strategize','copywrite']
const stageNames = {discovery:'Découverte',enrich:'Collecte',manual_analyze:'Collecte',analyze:'Analyse',score:'Score',strategize:'Stratégie',copywrite:'Brouillon',crm_next:'CRM'}

function timeLabel(value) {
  if (!value) return '—'
  const seconds=Math.max(0,Math.round((Date.now()-new Date(value).getTime())/1000))
  if(seconds<60)return `il y a ${seconds} s`
  const minutes=Math.round(seconds/60)
  if(minutes<60)return `il y a ${minutes} min`
  return `il y a ${Math.round(minutes/60)} h`
}

function StateMark({status}) {
  if(status==='running')return <span aria-hidden="true" style={spinner}/>
  const colors={queued:'var(--amber)',done:'var(--green)',error:'var(--red)'}
  return <span aria-hidden="true" style={{width:8,height:8,borderRadius:'50%',background:colors[status]??'var(--muted2)',boxShadow:status==='queued'?'0 0 0 4px var(--amber-dim)':'none',animation:status==='queued'?'pulse 1.8s ease infinite':'none',flexShrink:0}}/>
}

function JobRow({job}) {
  const retry=job.status==='queued'&&job.attempts>0
  return <div style={rowStyle}>
    <StateMark status={job.status}/>
    <div style={{minWidth:0,flex:1}}>
      <div style={{display:'flex',alignItems:'baseline',gap:7,flexWrap:'wrap'}}>
        <strong style={{fontSize:12,color:'var(--text)'}}>{prospectorJobSubject(job)}</strong>
        {job.prospect?.city&&<span style={{fontSize:10,color:'var(--muted2)'}}>· {job.prospect.city}</span>}
      </div>
      <div style={{fontSize:11,color:'var(--muted)',marginTop:3}}>{prospectorJobLabel(job)} {prospectorJobState(job).toLowerCase()}{job.status==='error'&&job.error?` · ${prospectorJobError(job.error)}`:''}</div>
    </div>
    <div style={{textAlign:'right',flexShrink:0}}>
      <div style={{fontSize:11,color:job.status==='error'?'var(--red)':job.status==='done'?'var(--green)':'var(--muted)'}}>{prospectorJobState(job)}</div>
      <div style={{fontSize:9,color:'var(--muted2)',marginTop:3}}>{retry?`essai ${job.attempts+1}/${job.max_attempts}`:timeLabel(job.updated_at)}</div>
    </div>
  </div>
}

export default function ProcessingCenter({jobs}) {
  const [open,setOpen]=useState(false)
  const previousActive=useRef(0)
  useEffect(()=>{
    if(jobs.active.length>0&&previousActive.current===0)setOpen(true)
    previousActive.current=jobs.active.length
  },[jobs.active.length])
  if(jobs.loading&&!jobs.jobs.length)return <div role="status" style={barStyle}><span style={spinner}/>Chargement de la file de traitement…</div>
  if(jobs.error&&!jobs.jobs.length)return <div role="alert" style={{...barStyle,color:'var(--red)'}}>{jobs.error}</div>

  const active=jobs.active
  const recentDone=jobs.jobs.filter(job=>job.status==='done').slice(0,8)
  const recentErrors=jobs.jobs.filter(job=>job.status==='error').slice(0,5)
  const running=active.filter(job=>job.status==='running').length
  const queued=active.length-running
  const activeTypes=new Set(active.map(job=>job.type==='manual_analyze'?'enrich':job.type))
  const completedTypes=new Set(recentDone.map(job=>job.type==='manual_analyze'?'enrich':job.type))
  const headline=active.length?`${active.length} traitement${active.length>1?'s':''} actif${active.length>1?'s':''}`:recentErrors.length?'Aucun traitement actif · éléments à vérifier':'File de traitement à jour'

  return <section aria-live="polite" aria-label="File de traitement de prospection" style={{borderBottom:'1px solid var(--border)',background:'var(--s2)',flexShrink:0}}>
    <button type="button" aria-expanded={open} onClick={()=>setOpen(value=>!value)} style={toggleStyle}>
      <span style={{display:'flex',alignItems:'center',gap:9,minWidth:0}}>
        {active.length?<span style={spinner}/>:<StateMark status={recentErrors.length?'error':'done'}/>} 
        <span><strong style={{color:'var(--text)'}}>{headline}</strong>{active.length>0&&<span style={{color:'var(--muted)'}}> · {running} en cours, {queued} en attente</span>}</span>
      </span>
      <span style={{display:'flex',alignItems:'center',gap:10,color:'var(--muted)'}}><span>{open?'Masquer':'Voir le détail'}</span><span aria-hidden="true" style={{transform:open?'rotate(180deg)':'none',transition:'transform .2s'}}>⌄</span></span>
    </button>
    {active.length>0&&<div aria-hidden="true" style={{height:2,overflow:'hidden',background:'var(--border)'}}><div style={{width:'38%',height:'100%',background:'linear-gradient(90deg,transparent,var(--red),transparent)',animation:'prospectorQueue 1.8s ease-in-out infinite'}}/></div>}
    {open&&<div style={panelStyle} className="fade-in">
      <div style={summaryGrid}>
        <Metric value={running} label="En cours" color="var(--red)"/><Metric value={queued} label="En attente" color="var(--amber)"/><Metric value={recentDone.length} label="Terminés récemment" color="var(--green)"/><Metric value={recentErrors.length} label="À vérifier" color={recentErrors.length?'var(--red)':'var(--muted2)'}/>
      </div>
      <div style={{margin:'18px 0 15px'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:10,marginBottom:9}}><strong style={sectionTitle}>Avancement de la chaîne</strong><span style={{fontSize:10,color:'var(--muted2)'}}>Actualisation automatique</span></div>
        <div style={pipelineStyle}>{stageOrder.map((type,index)=>{
          const state=activeTypes.has(type)?(active.some(j=>(j.type==='manual_analyze'?'enrich':j.type)===type&&j.status==='running')?'running':'queued'):completedTypes.has(type)?'done':'idle'
          return <React.Fragment key={type}><div style={{display:'flex',alignItems:'center',gap:6,color:activeTypes.has(type)?'var(--text)':'var(--muted2)',fontSize:10,whiteSpace:'nowrap'}}><StateMark status={state}/>{stageNames[type]}</div>{index<stageOrder.length-1&&<span style={{height:1,background:'var(--border-md)',flex:'1 1 18px',minWidth:10}}/>}</React.Fragment>
        })}</div>
      </div>
      <div style={columnsStyle}>
        <JobList title="En cours et en attente" jobs={active} empty="Aucun traitement dans la file."/>
        <JobList title="Derniers traitements terminés" jobs={recentDone} empty="Aucun traitement terminé récemment."/>
      </div>
      {recentErrors.length>0&&<div style={{marginTop:16}}><JobList title="À vérifier" jobs={recentErrors}/></div>}
      <div style={{display:'flex',justifyContent:'flex-end',marginTop:14}}><button type="button" onClick={jobs.reload} disabled={jobs.loading} style={refreshStyle}>{jobs.loading?'Actualisation…':'Actualiser maintenant'}</button></div>
    </div>}
  </section>
}

function Metric({value,label,color}) {return <div style={{padding:'11px 13px',border:'1px solid var(--border)',borderRadius:6,background:'var(--s1)'}}><div style={{fontSize:20,color}}>{value}</div><div style={{fontSize:10,color:'var(--muted)',marginTop:3}}>{label}</div></div>}
function JobList({title,jobs,empty}) {return <div><strong style={sectionTitle}>{title}</strong><div style={{marginTop:8,border:'1px solid var(--border)',borderRadius:6,overflow:'hidden',background:'var(--s1)'}}>{jobs.length?jobs.map(job=><JobRow key={job.id} job={job}/>):<div style={{padding:15,fontSize:11,color:'var(--muted2)'}}>{empty}</div>}</div></div>}

const barStyle={padding:'9px 22px',display:'flex',alignItems:'center',gap:9,color:'var(--muted)',fontSize:11}
const toggleStyle={...barStyle,width:'100%',justifyContent:'space-between',border:0,background:'transparent',fontFamily:'var(--sans)',cursor:'pointer',textAlign:'left'}
const panelStyle={padding:'16px 22px 18px',borderTop:'1px solid var(--border)',maxHeight:'min(520px,55vh)',overflowY:'auto'}
const summaryGrid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(115px,1fr))',gap:9}
const columnsStyle={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:16}
const pipelineStyle={display:'flex',alignItems:'center',padding:'12px 14px',border:'1px solid var(--border)',borderRadius:6,background:'var(--s1)',overflowX:'auto'}
const rowStyle={padding:'10px 12px',display:'flex',alignItems:'center',gap:10,borderBottom:'1px solid var(--border)'}
const sectionTitle={fontSize:11,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.06em'}
const spinner={width:12,height:12,border:'2px solid var(--border-md)',borderTopColor:'var(--red)',borderRadius:'50%',animation:'spin .8s linear infinite',flexShrink:0}
const refreshStyle={border:'1px solid var(--border-md)',borderRadius:5,background:'var(--s3)',color:'var(--text)',fontFamily:'var(--sans)',fontSize:11,padding:'7px 10px',cursor:'pointer'}
