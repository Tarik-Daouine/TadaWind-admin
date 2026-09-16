import React,{useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase.js'
import Button from '../ui/Button.jsx'

export default function EmailPreview({message,dirty,busy}) {
  const [config,setConfig]=useState(null)
  const [attempted,setAttempted]=useState(false)
  const [sending,setSending]=useState(false)
  const [notice,setNotice]=useState('')
  useEffect(()=>{
    let live=true
    supabase.functions.invoke('prospector-preview-email',{body:{probe:true}})
      .then(({data})=>{if(live)setConfig(data??{configured:false})})
      .catch(()=>{if(live)setConfig({configured:false})})
    return()=>{live=false}
  },[])
  const send=async()=>{
    setAttempted(true);setSending(true);setNotice('')
    try {
      let {data,error}=await supabase.functions.invoke('prospector-preview-email',{body:{message_id:message.id,revision:message.revision}})
      if(!data&&error?.context?.json)try{data=await error.context.json()}catch{/* Keep uncertain. */}
      setNotice(data?.accepted
        ? `Aperçu accepté par le service d’envoi pour ${config.recipient}. Vérifie ta boîte de réception.`
        : data?.error==='PREVIEW_RATE_LIMITED'?'Limite d’aperçus atteinte. Réessaie plus tard.'
        : data?.error==='MESSAGE_CONFLICT'?'Ce brouillon a changé. Recharge la fiche.'
        : data?.error==='PREVIEW_REJECTED'?'Le service a refusé cet aperçu. Aucun renvoi automatique.'
        : 'Cet aperçu est déjà en cours ou son résultat est à vérifier. Ne le renvoie pas ; consulte ta boîte de réception.')
    }catch{setNotice('Résultat de l’aperçu inconnu. Vérifie ta boîte avant toute nouvelle tentative.')}
    finally{setSending(false)}
  }
  return <div style={{padding:'14px 0',fontSize:12,lineHeight:1.6}}>
    <strong>Aperçu dans ta boîte email</strong>
    <p>{config?.configured?`Destinataire de test : ${config.recipient}. Le texte enregistré et la signature seront envoyés via Brevo.`:config?'L’envoi d’aperçus n’est pas configuré.':'Vérification de l’envoi d’aperçus…'}</p>
    <p>Cet aperçu ne contacte pas le prospect et ne le marque pas comme contacté. L’envoi Outlook aux prospects est configuré séparément.</p>
    {dirty&&<p>Enregistre tes modifications avant l’aperçu.</p>}
    <Button onClick={send} loading={sending} disabled={!config?.configured||dirty||busy||attempted}>M’envoyer un aperçu</Button>
    {notice&&<p role="status">{notice}</p>}
  </div>
}
