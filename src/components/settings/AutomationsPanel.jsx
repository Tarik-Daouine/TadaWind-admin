import Button from '../ui/Button.jsx'
import React,{useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase.js'
const LABELS={pending:'En attente',dispatching:'Envoi en cours — ne pas répéter',accepted:'Accepté par le service d’envoi',failed:'Échec confirmé',unknown:'Résultat incertain — vérifier le journal du service'}
export default function AutomationsPanel() {
  const [status,setStatus]=useState(null),[rows,setRows]=useState([]),[error,setError]=useState('')
  async function load() {
    setError('')
    const [connection,outbox]=await Promise.all([
      supabase.functions.invoke('automation-status',{body:{}}),
      supabase.from('automation_outbox').select('id,kind,recipient,status,error_code,created_at,provider,provider_message_id').order('created_at',{ascending:false}).limit(20),
    ])
    if(connection.error || outbox.error){setError('Le suivi des automatisations est momentanément indisponible.');return}
    setStatus(connection.data);setRows(outbox.data || [])
  }
  useEffect(()=>{load()},[])
  return <section style={{marginBottom:32,padding:20,border:'1px solid var(--border)',borderRadius:8}}>
    <h3>Automatisations internes</h3>
    <p style={{fontSize:13,lineHeight:1.6,margin:'12px 0'}}>Les demandes du site et leurs emails sont suivis ici. Les emails commerciaux restent soumis à ton clic.</p>
    {error && <p role="alert" style={{color:'var(--red)'}}>{error}</p>}
    {status && <>
      <p>Emails du formulaire : Brevo — {status.configured?`paramètres présents (${status.sender})`:'configuration en attente'}</p>
      <p>Tentatives sur 24 heures : {status.attempts_24h} / {status.limit_24h}. Au plafond, les emails attendent dans la file.</p>
      <p>Formulaire : {status.contact_enabled?'Circuit interne actif':'Bascule vers le circuit interne en préparation'}</p>
      {!status.configured && <p>Créer le compte Brevo gratuit, authentifier tadawind.com et configurer la clé serveur. La bascule attend un test de réception.</p>}
      <p>Prospection : envoyer manuellement depuis Outlook. Brevo est réservé aux emails du formulaire.</p>
    </>}
    <Button type="button" onClick={load} style={{padding:10,marginLeft:8}}>Actualiser</Button>
    <p style={{fontSize:12,color:'var(--muted)',margin:'8px 0'}}>« Accepté » signifie que le service a pris en charge l’envoi, pas que le destinataire l’a reçu. Un résultat incertain ne sera pas renvoyé automatiquement.</p>
    {!rows.length && <p>Aucun email dans la file interne.</p>}
    {rows.map(row=><div key={row.id} style={{padding:'10px 0',borderTop:'1px solid var(--border)',fontSize:12,overflowWrap:'anywhere'}}>
      <strong>{row.kind==='contact_internal'?'Notification interne':'Confirmation visiteur'}</strong> · {row.recipient}<br/>
      {LABELS[row.status]} · {row.provider==='brevo'?'Brevo':'Outlook'}
      {row.error_code && <div>Motif : {row.error_code}</div>}
      {row.provider_message_id && <div>Référence d’envoi : {row.provider_message_id}</div>}
    </div>)}
  </section>
}
