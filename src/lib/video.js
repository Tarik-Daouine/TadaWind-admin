export function parseVideo(value) {
  try {
    const url=new URL(value)
    if(url.protocol!=='https:' || url.username || url.password)return null
    const host=url.hostname.toLowerCase().replace(/^www\./,'')
    if(['youtube.com','m.youtube.com','youtu.be'].includes(host)) {
      const parts=url.pathname.split('/').filter(Boolean)
      const id=host==='youtu.be'?parts[0]:url.pathname==='/watch'?url.searchParams.get('v'):['shorts','embed'].includes(parts[0])?parts[1]:null
      if(!/^[\w-]{11}$/.test(id || ''))return null
      return {provider:'YouTube',id,url:`https://www.youtube.com/watch?v=${id}`,embed:`https://www.youtube-nocookie.com/embed/${id}`,thumbnail:`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
    }
    if(host==='vimeo.com' || host==='player.vimeo.com') {
      const parts=url.pathname.split('/').filter(Boolean)
      const id=host==='player.vimeo.com' && parts[0]==='video'?parts[1]:parts[0]
      const hash=url.searchParams.get('h') || (host==='vimeo.com'?parts[1]:'') || ''
      if(!/^\d{1,12}$/.test(id || '') || hash && !/^[a-z0-9]{6,64}$/i.test(hash))return null
      return {provider:'Vimeo',id,url:`https://vimeo.com/${id}${hash?'/'+hash:''}`,embed:`https://player.vimeo.com/video/${id}${hash?'?h='+hash:''}`,thumbnail:null}
    }
    if(host==='streamable.com' && /^\/[a-z0-9]{4,8}$/i.test(url.pathname)) {
      const id=url.pathname.slice(1).toLowerCase()
      return {provider:'Streamable',id,url:`https://streamable.com/${id}`,embed:`https://streamable.com/e/${id}`,thumbnail:null}
    }
  }catch { /* Invalid or unsupported URL. */ }
  return null
}
