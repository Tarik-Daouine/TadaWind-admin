import React,{useEffect,useMemo,useState} from 'react'
import Button from '../ui/Button.jsx'
import {prospectorJobError,prospectorJobLabel,prospectorJobState} from '../../hooks/useProspectorJobs.js'
import {useCampaignProgress} from '../../hooks/useCampaignProgress.js'
import './campaign-focus.css'

const categoryLabels={hotels:'Hôtels et hébergements',campsites:'Campings',restaurants:'Restaurants et cafés',tourism:'Tourisme et patrimoine',events:'Lieux événementiels',real_estate:'Agences immobilières',architecture:'Architectes',leisure:'Loisirs'}
const stages=[
  {id:'discovery',label:'Découverte',description:'Entreprises dans la zone',types:['discovery']},
  {id:'collect',label:'Collecte',description:'Sites et coordonnées',types:['enrich','locate','manual_analyze']},
  {id:'analyze',label:'Analyse',description:'Potentiel commercial',types:['analyze','score']},
  {id:'draft',label:'Brouillons',description:'Préparés pour validation',types:['copywrite']},
]

function useElapsed(start) {
  const [now,setNow]=useState(Date.now())
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[])
  const seconds=Math.max(0,Math.floor((now-new Date(start).getTime())/1000))
  if(seconds<60)return `${seconds} s`
  if(seconds<3600)return `${Math.floor(seconds/60)} min ${seconds%60} s`
  return `${Math.floor(seconds/3600)} h ${Math.floor((seconds%3600)/60)} min`
}

function jobStage(job){return stages.find(stage=>stage.types.includes(job.type))?.id}
function latestByProspect(jobs){const map=new Map();for(const job of jobs){if(job.prospect_id&&!map.has(job.prospect_id))map.set(job.prospect_id,job)}return map}

export default function CampaignFocus({initialCampaign,onNewSearch,onReuseCriteria,onOpenProspect,onOpenProspects}) {
  const data=useCampaignProgress(initialCampaign),[tab,setTab]=useState('live'),[activityVisible,setActivityVisible]=useState(true)
  const elapsed=useElapsed(data.campaign?.created_at??initialCampaign.created_at)
  const prospectJobs=useMemo(()=>latestByProspect(data.jobs),[data.jobs])
  const running=data.active.find(job=>job.status==='running'),queued=data.active.find(job=>job.status==='queued'),current=running??queued
  const total=data.prospects.length||data.campaign?.stats?.inserted||0
  const stageData=stages.map(stage=>{
    const jobs=data.jobs.filter(job=>stage.types.includes(job.type)), prospectJobs=jobs.filter(job=>job.prospect_id)
    const done=new Set(prospectJobs.filter(job=>job.status==='done').map(job=>job.prospect_id)).size
    const target=stage.id==='discovery'?1:new Set(prospectJobs.map(job=>job.prospect_id)).size
    const active=jobs.some(job=>['queued','running'].includes(job.status))
    const complete=stage.id==='discovery'?jobs.some(job=>job.status==='done'):target>0&&done===target&&!active
    return {...stage,jobs,done,target,active,complete}
  })
  const categories=(data.campaign?.filters?.categories??initialCampaign.filters?.categories??[]).map(id=>categoryLabels[id]??id).join(', ')
  const radius=data.campaign?.filters?.radius_km??initialCampaign.filters?.radius_km
  const currentCopy=current?currentDescription(current,total):data.active.length?'Préparation du prochain traitement.':'Tous les traitements disponibles sont terminés.'

  if(data.loading&&!data.campaign)return <div className="pcf-loading" role="status"><span/>Chargement de la recherche…</div>

  return <div className="pcf-root">
    <header className="pcf-header">
      <div><div className="pcf-eyebrow">Prospection <span>›</span> Recherche</div><h2>{data.campaign?.name??initialCampaign.name}</h2><p>{categories||'Toutes les catégories'} · rayon de {radius??'—'} km</p></div>
      <div className="pcf-actions"><Button onClick={onNewSearch}>Nouvelle recherche</Button><Button onClick={()=>onReuseCriteria(data.campaign??initialCampaign)}>Réutiliser les critères</Button></div>
    </header>
    <nav className="pcf-tabs" aria-label="Vue de la recherche" role="tablist">
      <button role="tab" aria-selected={tab==='live'} onClick={()=>setTab('live')}>Suivi en direct</button>
      <button role="tab" aria-selected={tab==='prospects'} onClick={()=>setTab('prospects')}>Prospects <span>{total}</span></button>
      <button role="tab" aria-selected={tab==='activity'} onClick={()=>setTab('activity')}>Journal d’activité</button>
    </nav>
    {data.error&&<div className="pcf-error" role="alert">{data.error} <button onClick={()=>data.reload()}>Réessayer</button></div>}

    {tab==='live'&&<>
      <div className="pcf-livebar" aria-live="polite"><span className={data.active.length?'pcf-live-dot':'pcf-live-dot is-idle'}/><div><strong>{data.active.length?'Recherche en cours':'Recherche à jour'}</strong><small>{currentCopy}</small></div><div className="pcf-elapsed"><small>Temps écoulé</small><strong>{elapsed}</strong></div><span className="pcf-background-note">Tu peux quitter cette page</span></div>
      <div className={`pcf-grid ${activityVisible?'':'activity-hidden'}`}>
        <div className="pcf-main">
          <section className="pcf-card">
            <div className="pcf-card-head"><div><span>Avancement</span><h3>La recherche avance étape par étape</h3></div><small>{data.refreshing?'Actualisation…':'Actualisation automatique'}</small></div>
            <div className="pcf-pipeline">{stageData.map((stage,index)=><React.Fragment key={stage.id}><article className={stage.active?'is-current':stage.complete?'is-complete':''}><i>{index+1}</i><div><strong>{stage.label}</strong><small>{stage.description}</small></div><b>{stageValue(stage,total,data.campaign)}</b><em>{stage.active?'En cours':stage.complete?'Terminé':stage.target?'En attente':'À venir'}</em></article>{index<stageData.length-1&&<span className={stage.complete?'is-complete':''}/>}</React.Fragment>)}</div>
            <div className="pcf-current"><span>◎</span><div><strong>Ce que fait l’outil maintenant</strong><p>{currentCopy}</p></div>{current&&<div className="pcf-current-state"><b>{prospectorJobState(current)}</b><small>{prospectorJobLabel(current)}</small></div>}</div>
          </section>
          <section className="pcf-card pcf-results">
            <div className="pcf-card-head"><div><span>Résultats en direct</span><h3>Prospects découverts</h3></div><button onClick={()=>setTab('prospects')}>Voir les {total} prospects →</button></div>
            {!data.prospects.length?<div className="pcf-empty">{data.active.some(job=>job.type==='discovery')?'Les entreprises apparaîtront ici dès la fin de la découverte.':'Aucun prospect créé par cette recherche.'}</div>:<div className="pcf-result-list">{data.prospects.slice(0,6).map(prospect=><ProspectRow key={prospect.id} prospect={prospect} job={prospectJobs.get(prospect.id)} onOpen={()=>onOpenProspect(prospect.id)}/>)}</div>}
          </section>
        </div>
        {activityVisible&&<aside className="pcf-activity"><div className="pcf-activity-head"><div><span>En direct</span><h3>Journal d’activité</h3></div><button aria-label="Masquer le journal" onClick={()=>setActivityVisible(false)}>›</button></div><ActivityList campaign={data.campaign??initialCampaign} jobs={data.jobs.slice(0,8)}/><div className="pcf-info">ⓘ La durée dépend du nombre de sites et de leur temps de réponse. Le traitement continue en arrière-plan.</div><div className="pcf-safe"><span>✓</span><div><strong>Aucun envoi automatique</strong><p>Chaque message devra être validé.</p></div></div></aside>}
        {!activityVisible&&<button className="pcf-show-activity" onClick={()=>setActivityVisible(true)}>Afficher le journal</button>}
      </div>
    </>}

    {tab==='prospects'&&<section className="pcf-tab-content"><div className="pcf-view-head"><div><h3>{total} prospect{total>1?'s':''} découvert{total>1?'s':''}</h3><p>Les fiches se complètent automatiquement pendant le traitement.</p></div>{onOpenProspects&&<Button onClick={onOpenProspects}>Ouvrir l’espace Prospects</Button>}</div><div className="pcf-table-wrap"><table><thead><tr><th>Entreprise</th><th>Ville</th><th>Distance</th><th>Traitement</th><th>Score</th><th></th></tr></thead><tbody>{data.prospects.map(prospect=><ProspectTableRow key={prospect.id} prospect={prospect} job={prospectJobs.get(prospect.id)} onOpen={()=>onOpenProspect(prospect.id)}/>)}</tbody></table>{!data.prospects.length&&<div className="pcf-empty">Aucun prospect disponible pour le moment.</div>}</div></section>}

    {tab==='activity'&&<section className="pcf-tab-content"><div className="pcf-view-head"><div><h3>Journal complet de la recherche</h3><p>Uniquement les événements de cette campagne.</p></div></div><div className="pcf-full-log"><ActivityList campaign={data.campaign??initialCampaign} jobs={data.jobs}/></div></section>}
  </div>
}

function stageValue(stage,total,campaign){if(stage.id==='discovery')return campaign?.stats?.found??(stage.complete?total:'—');if(!stage.target)return '—';return `${stage.done} / ${stage.target}`}
function currentDescription(job,total){return {discovery:total?`L’outil poursuit la recherche dans la zone définie. ${total} résultat${total>1?'s sont':' est'} déjà enregistré${total>1?'s':''}.`:'L’outil recherche les entreprises correspondant aux critères dans la zone définie.',enrich:'L’outil visite le site du prospect pour récupérer ses activités, ses coordonnées et les informations utiles.',locate:'L’outil vérifie la commune et la distance du prospect.',analyze:'L’outil analyse les informations collectées et évalue le potentiel commercial.',score:'L’outil calcule le score du prospect.',strategize:'L’outil prépare l’angle de prise de contact le plus pertinent.',copywrite:'L’outil rédige un brouillon qui devra être validé avant tout envoi.'}[job.type]??'Un traitement de prospection est en cours.'}
function prospectStatus(prospect,job){if(job?.status==='error')return {label:'À vérifier',tone:'error',detail:prospectorJobError(job.error)};if(job?.status==='running')return {label:prospectorJobLabel(job),tone:'running'};if(job?.status==='queued')return {label:'En attente',tone:'waiting'};if(prospect.status==='to_validate')return {label:'Brouillon prêt',tone:'ready'};if(prospect.score!=null)return {label:'Analysé',tone:'ready'};return {label:'Découvert',tone:'waiting'}}
function ProspectRow({prospect,job,onOpen}){const state=prospectStatus(prospect,job);return <article><span className="pcf-company-icon">▦</span><div><strong>{prospect.name}</strong><small>{prospect.city||'Lieu à confirmer'}{prospect.distance_km!=null?` · ${Number(prospect.distance_km).toLocaleString('fr-FR')} km`:''}</small></div><span className={`pcf-status ${state.tone}`}>{state.tone==='running'&&<i/>}{state.label}</span><b className="pcf-score">{prospect.score??'—'}<small>score</small></b><button aria-label={`Ouvrir ${prospect.name}`} onClick={onOpen}>›</button></article>}
function ProspectTableRow({prospect,job,onOpen}){const state=prospectStatus(prospect,job);return <tr><td><strong>{prospect.name}</strong></td><td>{prospect.city||'À confirmer'}</td><td>{prospect.distance_km==null?'—':`${Number(prospect.distance_km).toLocaleString('fr-FR')} km`}</td><td><span className={`pcf-status ${state.tone}`}>{state.label}</span></td><td>{prospect.score??'—'}</td><td><button onClick={onOpen}>Ouvrir</button></td></tr>}
function ActivityList({campaign,jobs}){return <div className="pcf-activity-list">{jobs.map(job=><article key={job.id}><time>{new Date(job.updated_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</time><span className={job.status==='error'?'error':job.status==='done'?'done':'live'}/><div><strong>{prospectorJobLabel(job)} · {prospectorJobState(job).toLowerCase()}</strong><p>{job.error?prospectorJobError(job.error):job.prospect_id?'Fiche prospect mise à jour':campaign.name}</p></div></article>)}<article><time>{new Date(campaign.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</time><span className="done"/><div><strong>Recherche lancée</strong><p>Critères enregistrés</p></div></article></div>}
