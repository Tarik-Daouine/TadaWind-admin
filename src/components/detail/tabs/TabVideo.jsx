import Button from '../../ui/Button.jsx'
import React,{useState} from 'react'
import {parseVideo} from '../../../lib/video.js'
import TabVideoLegacy from './TabVideoLegacy.jsx'
export default function TabVideo({project,projects,onChange,onToast}) {
  const [value,setValue]=useState(project.videoUrl || '')
  const [error,setError]=useState('')
  const video=parseVideo(project.videoUrl)
  function save() {
    const parsed=parseVideo(value)
    if(!parsed){setError('Colle une adresse HTTPS YouTube ou Vimeo valide.');return}
    setError('');onChange({videoUrl:parsed.url,...(!project.cover && parsed.thumbnail?{cover:parsed.thumbnail}:{})})
    onToast?.('Lien vidéo ajouté. Vérifie l’aperçu puis enregistre le projet.','success')
  }
  return <div>
    <h3>Vidéo du projet</h3>
    <p style={{fontSize:13,lineHeight:1.6,margin:'12px 0'}}>Ajoute le lien de ta nouvelle vidéo YouTube ou Vimeo. Le projet conserve son état brouillon jusqu’à sa publication. Les fichiers originaux doivent aussi être sauvegardés hors de la plateforme.</p>
    <label htmlFor="project-video-url">Adresse de la vidéo</label>
    <input id="project-video-url" value={value} onChange={e=>setValue(e.target.value)} placeholder="https://www.youtube.com/watch?v=… ou https://vimeo.com/…" style={{width:'100%',padding:12,margin:'8px 0',color:'var(--text)',background:'var(--s3)',border:'1px solid var(--border)'}} />
    <Button type="button" onClick={save} style={{padding:10}}>Utiliser cette vidéo</Button>
    {error && <p role="alert">{error}</p>}
    {video && <>
      <p style={{margin:'12px 0'}}>{video.provider} · <a href={video.url} target="_blank" rel="noreferrer">Ouvrir la vidéo</a></p>
      <iframe src={video.embed} title="Aperçu de la vidéo" allow="fullscreen; picture-in-picture" allowFullScreen style={{width:'100%',aspectRatio:'16/9',border:0}} />
      <p style={{fontSize:12,color:'var(--muted)'}}>Si la plateforme interdit l’intégration ou si la vidéo est privée, ajuste sa visibilité. Cet aperçu ne valide pas les droits de publication.</p>
    </>}
    <details style={{marginTop:24}}><summary>Anciennes références Streamable</summary><TabVideoLegacy project={project} projects={projects} onChange={onChange} onToast={onToast}/></details>
  </div>
}
