import React,{useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase.js'
const labels={page_view:'Pages vues',form_open:'Ouvertures du formulaire',contact_accepted:'Demandes acceptées',email_click:'Clics email'}
export default function SiteCounts(){
 const [data,setData]=useState(null),[error,setError]=useState(false)
 useEffect(()=>{let active=true;const start=new Date();start.setUTCDate(start.getUTCDate()-29);supabase.from('site_daily_counts').select('event,total').gte('day',start.toISOString().slice(0,10)).then(({data,error})=>{if(active){setError(Boolean(error));setData(data)}});return()=>{active=false}},[])
 return <section style={{border:'1px solid var(--border)',padding:20,borderRadius:12,marginBottom:20}}><h2>Parcours du site — 30 jours</h2><p>Comptages des visiteurs ayant accepté la mesure. Ce ne sont pas des visiteurs uniques. Les demandes ci-dessous sont signalées par le navigateur après acceptation du serveur ; le CRM reste la référence.</p>{error?<p role="alert">Mesure du site indisponible.</p>:data===null?<p>Chargement…</p>:<dl>{Object.entries(labels).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{data.reduce((n,r)=>n+(r.event===key?r.total:0),0)}</dd></div>)}</dl>}</section>
}
