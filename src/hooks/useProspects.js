import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'

function readable(error) {
  const message=error?.message ?? ''
  if(message.includes('PROSPECT_COLLISION')) return 'Ce prospect correspond à une fiche existante. Vérifie le domaine, le téléphone ou le nom et la ville.'
  if(message.includes('PROSPECT_BLACKLISTED')) return 'Cette entreprise figure dans la liste d’opposition.'
  if(message.includes('PROSPECT_CONFLICT')) return 'Cette fiche a été modifiée dans une autre session. Recharge-la avant de recommencer.'
  if(error?.code==='42501') return 'Ta session ne permet pas cette action.'
  return 'Impossible de mettre à jour les prospects. Vérifie la connexion et réessaie.'
}

export function useProspects() {
  const [prospects,setProspects]=useState([]), [loading,setLoading]=useState(true), [error,setError]=useState(null)
  const generation=useRef(0)
  const reload=useCallback(async()=>{
    const current=++generation.current; setLoading(true); setError(null)
    const result=await supabase.from('prospects').select('*').is('deleted_at',null).order('score',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false})
    if(current!==generation.current) return
    if(result.error){setError(readable(result.error));setProspects([])} else setProspects(result.data ?? [])
    setLoading(false)
  },[])
  useEffect(()=>{reload();return()=>{generation.current++}},[reload])
  const create=async input=>{
    setError(null)
    const result=await supabase.rpc('prospector_create_prospect',{p_input:input})
    if(result.error){const message=readable(result.error);setError(message);return {error:message}}
    setProspects(previous=>[result.data,...previous.filter(item=>item.id!==result.data.id)])
    return {data:result.data,error:null}
  }
  const update=async(prospect,patch)=>{
    setError(null)
    const result=await supabase.rpc('prospector_update_prospect',{p_id:prospect.id,p_expected_updated_at:prospect.updated_at,p_patch:patch})
    if(result.error){const message=readable(result.error);setError(message);return {error:message}}
    setProspects(previous=>previous.map(item=>item.id===result.data.id?result.data:item))
    return {data:result.data,error:null}
  }
  const remove=async id=>{
    setError(null)
    const result=await supabase.rpc('prospector_delete_prospect',{p_id:id})
    if(result.error){const message=readable(result.error);setError(message);return {error:message}}
    setProspects(previous=>previous.filter(item=>item.id!==id)); return {error:null}
  }
  const requestAnalysis=async id=>{
    setError(null)
    const result=await supabase.rpc('prospector_request_analysis',{p_id:id})
    if(result.error){const message=readable(result.error);setError(message);return {error:message}}
    window.dispatchEvent(new CustomEvent('prospector:job-created'))
    return {data:result.data,error:null}
  }
  return {prospects,loading,error,reload,create,update,remove,requestAnalysis}
}

export function useProspectorQueueCount(enabled=true) {
  const [count,setCount]=useState(0)
  useEffect(()=>{let live=true;if(!enabled){setCount(0);return()=>{live=false}} supabase.from('prospects').select('id',{count:'exact',head:true}).eq('status','to_validate').is('deleted_at',null).then(result=>{if(live&&!result.error)setCount(result.count ?? 0)});return()=>{live=false}},[enabled])
  return count
}
