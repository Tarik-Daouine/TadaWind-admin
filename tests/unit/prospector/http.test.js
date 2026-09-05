import {describe,expect,it,vi} from 'vitest'
import {fetchPublicHtml,isPublicIp,parsePublicHttpUrl,sha256} from '../../../supabase/functions/_shared/prospector/http.ts'

describe('lecture web contrôlée',()=>{
  it.each(['10.0.0.1','127.0.0.1','169.254.1.1','172.16.0.1','192.168.1.1','100.64.0.1','0.0.0.0','224.0.0.1','::1','fc00::1','fe80::1','2001:db8::1','::ffff:127.0.0.1'])('bloque l’adresse %s',ip=>expect(isPublicIp(ip)).toBe(false))
  it.each(['1.1.1.1','8.8.8.8','93.184.216.34','2606:2800:220:1:248:1893:25c8:1946'])('accepte l’adresse publique %s',ip=>expect(isPublicIp(ip)).toBe(true))
  it.each(['file:///etc/passwd','http://localhost/a','http://service.internal','http://127.0.0.1','https://user:pass@example.com','https://example.com:8080'])('rejette URL %s',url=>expect(()=>parsePublicHttpUrl(url)).toThrow('UNSAFE_WEBSITE_URL'))
  it('contrôle chaque redirection et retourne un HTML borné',async()=>{
    const fetchImpl=vi.fn().mockResolvedValueOnce(new Response(null,{status:302,headers:{location:'https://www.example.com/final'}})).mockResolvedValueOnce(new Response('<h1>OK</h1>',{status:200,headers:{'content-type':'text/html','content-length':'11'}}))
    const resolveHost=vi.fn().mockResolvedValue(['93.184.216.34'])
    const result=await fetchPublicHtml('https://example.com/start',{fetchImpl,resolveHost})
    expect(result).toEqual({html:'<h1>OK</h1>',finalUrl:'https://www.example.com/final'})
    expect(resolveHost).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls.every(call=>call[1].redirect==='manual')).toBe(true)
  })
  it('bloque une résolution privée, y compris après redirection',async()=>{
    await expect(fetchPublicHtml('https://example.com',{fetchImpl:vi.fn(),resolveHost:async()=>['10.0.0.1']})).rejects.toThrow('UNSAFE_DNS_RESULT')
    const fetchImpl=vi.fn().mockResolvedValue(new Response(null,{status:302,headers:{location:'http://127.0.0.1/admin'}}))
    await expect(fetchPublicHtml('https://example.com',{fetchImpl,resolveHost:async()=>['93.184.216.34']})).rejects.toThrow('UNSAFE_WEBSITE_URL')
  })
  it('bloque type, taille, statut, limitation et redirections excessives',async()=>{
    const publicDns=async()=>['93.184.216.34']
    await expect(fetchPublicHtml('https://example.com',{resolveHost:publicDns,fetchImpl:async()=>new Response('{}',{headers:{'content-type':'application/json'}})})).rejects.toThrow('UNSUPPORTED_CONTENT_TYPE')
    await expect(fetchPublicHtml('https://example.com',{resolveHost:publicDns,maxBytes:5,fetchImpl:async()=>new Response('123456',{headers:{'content-type':'text/html'}})})).rejects.toThrow('SOURCE_TOO_LARGE')
    await expect(fetchPublicHtml('https://example.com',{resolveHost:publicDns,fetchImpl:async()=>new Response('',{status:429,headers:{'content-type':'text/html'}})})).rejects.toThrow('RATE_LIMITED')
    await expect(fetchPublicHtml('https://example.com',{resolveHost:publicDns,maxRedirects:0,fetchImpl:async()=>new Response(null,{status:302,headers:{location:'/again'}})})).rejects.toThrow('TOO_MANY_REDIRECTS')
  })
  it('produit une empreinte stable',async()=>{expect(await sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')})
})
