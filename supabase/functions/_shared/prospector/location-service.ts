import type {SupabaseClient} from 'npm:@supabase/supabase-js@2.100.0'
import {resolveLocation} from './location.js'

// Reprise durable de la commune. La découverte tente déjà en lot ; ici on traite
// un prospect à la fois, avec les réessais et le backoff de la file.
// Une panne du service remonte telle quelle et sera rejouée ; une réponse
// définitivement négative est horodatée pour ne plus jamais rappeler le service.
export async function runLocate(client:SupabaseClient,prospectId:string){
  const prospect=await client.from('prospects').select('id,city,lat,lng,location_checked_at').eq('id',prospectId).single()
  if(prospect.error)throw new Error('PROSPECT_NOT_FOUND')
  const {city,lat,lng}=prospect.data
  if(city&&city.trim())throw new Error('LOCATION_ALREADY_SET')
  if(lat===null||lng===null)throw new Error('NO_COORDINATES')

  const found=await resolveLocation(lat,lng)
  if(!found){
    const marked=await client.rpc('prospector_mark_location_unknown',{p_id:prospectId,p_reason:'no_single_commune'})
    if(marked.error)throw new Error(marked.error.message)
    return {stage:'locate',resolved:false}
  }
  const stored=await client.rpc('prospector_store_location',{
    p_id:prospectId,p_city:found.city,p_postal_code:found.postal_code,p_evidence:found.evidence,
  })
  if(stored.error)throw new Error(stored.error.message)
  return {stage:'locate',resolved:true,city:found.city}
}
