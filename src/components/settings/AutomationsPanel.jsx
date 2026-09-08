import Button from '../ui/Button.jsx'
import React,{useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase.js'
const LABELS={pending:'En attente',dispatching:'Envoi en cours — ne pas répéter',accepted:'Accepté par Outlook',failed:'Échec confirmé',unknown:'Résultat incertain — vérifier Outlook'}
export default function AutomationsPanel() {
  const [status,setStatus]=useState(null),[rows,setRows]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  async function load() {
    setError('')
    const [connection,outbox]=await Promise.all([
      supabase.functions.invoke('automation-outlook',{body:{action:'status'}}),
      supabase.from('automation_outbox').select('id,kind,recipient,status,error_code,created_at').order('created_at',{ascending:false}).limit(20),
    ])
    if(connection.error || outbox.error){setError('Le suivi des automatisations est momentanément indisponible.');return}
    setStatus(connection.data);setRows(outbox.data || [])
  }
  useEffect(()=>{load()},[])
  async function connect() {
    setBusy(true);setError('')
    const {data,error}=await supabase.functions.invoke('automation-outlook',{body:{action:'connect'}})
    setBusy(false)
    if(error || !data?.url){setError('La connexion Microsoft n’a pas pu démarrer.');return}
    const url=new URL(data.url)
    if(url.origin!=='https://login.microsoftonline.com'){setError('Adresse de connexion refusée.');return}
    window.location.assign(url.href)
  }
  return <section style={{marginBottom:32,padding:20,border:'1px solid var(--border)',borderRadius:8}}>
    <h3>Automatisations internes</h3>
    <p style={{fontSize:13,lineHeight:1.6,margin:'12px 0'}}>Les demandes du site et leurs emails sont suivis ici. Les emails commerciaux restent soumis à ton clic.</p>
    {error && <p role="alert" style={{color:'var(--red)'}}>{error}</p>}
    {status && <>
      <p>Outlook : {status.connected?status.sender:status.configured?'À connecter':'Application Microsoft à configurer'}</p>
      <p>Formulaire : {status.contact_enabled?'Circuit interne actif':'Bascule vers le circuit interne en préparation'}</p>
      <Button type="button" disabled={!status.configured || busy} onClick={connect} style={{padding:10,margin:'12px 0'}}>{status.connected?'Reconnecter Outlook':'Connecter Outlook'}</Button>
    </>}
    <Button type="button" onClick={load} style={{padding:10,marginLeft:8}}>Actualiser</Button>
    <p style={{fontSize:12,color:'var(--muted)',margin:'8px 0'}}>« Accepté » signifie qu’Outlook a pris en charge l’envoi, pas que le destinataire l’a reçu. Un résultat incertain ne sera pas renvoyé automatiquement.</p>
    {!rows.length && <p>Aucun email dans la file interne.</p>}
    {rows.map(row=><div key={row.id} style={{padding:'10px 0',borderTop:'1px solid var(--border)',fontSize:12,overflowWrap:'anywhere'}}>
      <strong>{row.kind==='contact_internal'?'Notification interne':'Confirmation visiteur'}</strong> · {row.recipient}<br/>
      {LABELS[row.status]}
    </div>)}
  </section>
}
