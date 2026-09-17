import type {SupabaseClient} from 'npm:@supabase/supabase-js@2.100.0'
import {buildOverpassQuery,parseOverpassResponse} from './discovery.js'
import {completeLocations} from './location.js'

const USER_AGENT=Deno.env.get('NOMINATIM_USER_AGENT')||'TadaWindProspector/1.0 (contact@tadawind.com)'
// Overpass refuse un rayon > ~200 km ; on borne la requête sans changer le rayon de campagne stocké.
const OVERPASS_MAX_RADIUS_KM=200
// Les instances publiques peuvent être temporairement saturées. La seconde URL
// vise directement l'autre serveur de l'instance principale ; la troisième est
// une instance mondiale indépendante répertoriée par OpenStreetMap.
const OVERPASS_ENDPOINTS=[
  'https://overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

async function jsonRequest(url:string,init:RequestInit={}){
  const response=await fetch(url,{...init,headers:{accept:'application/json','user-agent':USER_AGENT,...init.headers},signal:AbortSignal.timeout(30000)})
  if(response.status===429)throw new Error('RATE_LIMITED')
  if(!response.ok)throw new Error('DISCOVERY_SOURCE_ERROR')
  const text=await response.text()
  if(new TextEncoder().encode(text).byteLength>1_000_000)throw new Error('RESPONSE_TOO_LARGE')
  try{return JSON.parse(text)}catch{throw new Error('INVALID_DISCOVERY_RESPONSE')}
}

async function geocode(address:string){
  const url=new URL('https://nominatim.openstreetmap.org/search')
  url.search=new URLSearchParams({q:address,format:'jsonv2',limit:'1',countrycodes:'fr'}).toString()
  const payload=await jsonRequest(url.href)
  const lat=Number(payload?.[0]?.lat),lng=Number(payload?.[0]?.lon)
  if(!Number.isFinite(lat)||!Number.isFinite(lng))throw new Error('REFERENCE_ADDRESS_NOT_FOUND')
  return {lat,lng}
}

async function requestOverpass(query:string){
  for(const [index,endpoint] of OVERPASS_ENDPOINTS.entries()){
    try{
      const payload=await jsonRequest(endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8'},body:new URLSearchParams({data:query})})
      return {payload,endpoint}
    }catch(error){
      console.warn('OVERPASS_ENDPOINT_FAILED',JSON.stringify({endpoint,index,error:error instanceof Error?error.message:'UNKNOWN'}))
    }
  }
  throw new Error('DISCOVERY_SOURCE_ERROR')
}

export async function runDiscovery(client:SupabaseClient,campaignId:string){
  const [campaignResult,settingsResult]=await Promise.all([
    client.from('prospect_campaigns').select('*').eq('id',campaignId).single(),
    client.from('prospector_settings').select('*').eq('id','main').single(),
  ])
  if(campaignResult.error)throw new Error('CAMPAIGN_NOT_FOUND')
  if(settingsResult.error)throw new Error('SETTINGS_NOT_FOUND')
  const campaign=campaignResult.data,settings=settingsResult.data,filters=campaign.filters??{}
  const center=Number.isFinite(settings.reference_lat)&&Number.isFinite(settings.reference_lng)
    ?{lat:settings.reference_lat,lng:settings.reference_lng}:await geocode(settings.reference_address)
  const radiusKm=Number(filters.radius_km??settings.radius_preferred_km)
  const overpassRadiusKm=Math.min(OVERPASS_MAX_RADIUS_KM,Math.max(1,radiusKm))
  const query=buildOverpassQuery({lat:center.lat,lng:center.lng,radiusKm:overpassRadiusKm,categories:filters.categories})
  const {payload,endpoint}=await requestOverpass(query)
  const candidates=parseOverpassResponse(payload,{maxResults:50})
  const location=await completeLocations(candidates)
  if(location.missing)console.warn('DISCOVERY_LOCATION_INCOMPLETE',JSON.stringify({campaignId,...location}))
  const stored=await client.rpc('prospector_store_discovery',{p_campaign_id:campaignId,p_candidates:candidates,p_report:{found:candidates.length,center,radius_km:radiusKm,overpass_radius_km:overpassRadiusKm,source_endpoint:endpoint,location}})
  if(stored.error)throw new Error(stored.error.message)
  return stored.data
}
