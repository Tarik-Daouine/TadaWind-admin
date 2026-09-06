import React,{useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase.js'
export default function ProspectorBudget(){
  const [budget,setBudget]=useState(null),[error,setError]=useState(false)
  useEffect(()=>{let live=true;supabase.from('prospector_budget').select('monthly_limit_eur,eur_per_usd').eq('id','main').single().then(r=>{if(live){setBudget(r.data);setError(!!r.error)}});return()=>{live=false}},[])
  return <p style={{fontSize:12,color:'var(--muted)',lineHeight:1.6,marginBottom:16}}>{error?'Plafond IA indisponible.':budget?'Plafond IA : '+budget.monthly_limit_eur+' € par mois.'+(budget.eur_per_usd?' Les appels sont réservés avant exécution.':' Appels bloqués tant que le taux de conversion n’est pas configuré.'):'Chargement du plafond IA…'}</p>
}
