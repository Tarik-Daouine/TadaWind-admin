import React, { useState } from 'react'
import { useProspectCampaigns } from '../../hooks/useProspectCampaigns.js'
import { SectionCard } from '../ui/SectionCard.jsx'
import Button from '../ui/Button.jsx'

const categories={hotels:'Hébergements',campsites:'Campings',restaurants:'Restaurants',tourism:'Tourisme',events:'Événementiel',real_estate:'Immobilier',architecture:'Architectes',leisure:'Loisirs'}
function discoveryState(campaign) {
  const job=[...(campaign.prospect_jobs??[])].filter(j=>j.type==='discovery').sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at))[0]
  if(job?.status==='error')return 'Recherche en échec'
  if(job?.status==='queued')return job.error?'Nouvelle tentative en attente':'Recherche en attente'
  if(job?.status==='running')return 'Recherche en cours'
  return {done:'Recherche terminée',draft:'Brouillon',paused:'En pause',running:'Recherche en attente'}[campaign.status]??'État inconnu'
}

export default function CampaignsView({onSearch,onOpenCampaign}) {
  const [page,setPage]=useState(1)
  const {campaigns,count,loading,error,reload}=useProspectCampaigns(page)
  const pages=Math.max(1,Math.ceil(count/15))
  return <div style={{maxWidth:1050,margin:'0 auto',padding:'28px 24px'}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:16}}>
      <h2 style={{fontFamily:'var(--serif)',fontWeight:400}}>Campagnes de prospection</h2>
      <div style={{display:'flex',gap:8}}><Button onClick={reload}>Actualiser</Button><Button variant="primary" onClick={onSearch}>Nouvelle recherche</Button></div>
    </div>
    <p style={{fontSize:12,color:'var(--muted)',lineHeight:1.6,marginBottom:20}}>Les résultats concernent la découverte d’entreprises. La collecte des sites et la préparation des messages peuvent continuer après la recherche.</p>
    {error && <p role="alert" style={{color:'var(--red)'}}>{error}</p>}
    {loading?<p role="status">Chargement des campagnes…</p>:!error&&!campaigns.length?<SectionCard>Aucune campagne enregistrée.</SectionCard>:!loading&&campaigns.map(c=><article key={c.id} aria-label={c.name}><SectionCard>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
        <h3 style={{fontSize:15,marginBottom:8}}>{c.name}</h3><span style={{fontSize:12,color:'var(--muted)'}}>{discoveryState(c)}</span>
      </div>
      <p style={{fontSize:12,color:'var(--muted)',marginBottom:14}}>{new Date(c.created_at).toLocaleDateString('fr-FR')} · {c.filters?.radius_km??'—'} km · {(c.filters?.categories??[]).map(id=>categories[id]??id).join(', ')}</p>
      <dl style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:14,margin:'0 0 16px'}}>
        {[['found','Résultats trouvés'],['inserted','Fiches créées'],['skipped','Résultats écartés'],['queued_for_enrichment','Sites à collecter']].map(([key,label])=><div key={key}><dt style={{fontSize:11,color:'var(--muted)'}}>{label}</dt><dd style={{fontSize:22,margin:'5px 0 0'}}>{c.stats?.[key]??'—'}</dd></div>)}
      </dl>
      {discoveryState(c)==='Recherche en échec'&&<p style={{fontSize:12,color:'var(--red)',marginBottom:12}}>La découverte a échoué. Les éventuelles fiches déjà créées restent accessibles.</p>}
      <Button size="sm" onClick={()=>onOpenCampaign(c)}>Voir les prospects</Button>
    </SectionCard></article>)}
    <div style={{display:'flex',gap:10,alignItems:'center',justifyContent:'flex-end',marginTop:18,fontSize:12}}>
      <span>{count} campagne{count>1?'s':''}</span>
      <Button disabled={loading||page===1} onClick={()=>setPage(p=>p-1)}>Précédent</Button><span>{page}/{pages}</span>
      <Button disabled={loading||page>=pages} onClick={()=>setPage(p=>p+1)}>Suivant</Button>
    </div>
  </div>
}
