export type FetchHtmlOptions={fetchImpl?:typeof fetch;resolveHost?:(host:string)=>Promise<string[]>;timeoutMs?:number;maxBytes?:number;maxRedirects?:number}
const blockedNames=/^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i

export function isPublicIp(value:string):boolean{
  const ip=value.toLowerCase().replace(/^\[|\]$/g,'')
  const v4=ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if(v4){const n=v4.slice(1).map(Number);if(n.some(x=>x>255))return false;const [a,b]=n;return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&[0,168].includes(b))||(a===198&&[18,19,51].includes(b))||(a===203&&b===0))}
  if(!ip.includes(':'))return false
  if(ip==='::'||ip==='::1'||ip.startsWith('fc')||ip.startsWith('fd')||/^fe[89ab]/.test(ip)||ip.startsWith('2001:db8:'))return false
  const mapped=ip.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);return mapped?isPublicIp(mapped[1]):/^[0-9a-f:]+$/.test(ip)
}

export function parsePublicHttpUrl(value:string,base?:string){
  let url:URL
  try{url=new URL(value,base)}catch{throw new Error('INVALID_WEBSITE_URL')}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port&&url.port!=='80'&&url.port!=='443'||blockedNames.test(url.hostname)||url.hostname.length>253)throw new Error('UNSAFE_WEBSITE_URL')
  if(/^[0-9.:[\]]+$/.test(url.hostname)&&!isPublicIp(url.hostname))throw new Error('UNSAFE_WEBSITE_URL')
  url.hash='';return url
}

async function defaultResolver(host:string){
  const resolver=(globalThis as typeof globalThis&{Deno?:{resolveDns?:(host:string,type:'A'|'AAAA')=>Promise<string[]>}}).Deno?.resolveDns
  if(!resolver)throw new Error('DNS_VALIDATION_UNAVAILABLE')
  const answers=(await Promise.allSettled([resolver(host,'A'),resolver(host,'AAAA')])).flatMap(item=>item.status==='fulfilled'?item.value:[])
  if(!answers.length)throw new Error('DNS_RESOLUTION_FAILED')
  return answers
}

async function readLimited(response:Response,maxBytes:number){
  const declared=Number(response.headers.get('content-length')||0)
  if(declared>maxBytes)throw new Error('SOURCE_TOO_LARGE')
  if(!response.body)return ''
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new Error('SOURCE_TOO_LARGE')}chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}return new TextDecoder().decode(bytes)
}

export async function fetchPublicHtml(value:string,options:FetchHtmlOptions={}){
  const fetchImpl=options.fetchImpl??fetch,resolveHost=options.resolveHost??defaultResolver,maxBytes=options.maxBytes??1_000_000,maxRedirects=options.maxRedirects??3
  let url=parsePublicHttpUrl(value)
  for(let redirect=0;redirect<=maxRedirects;redirect++){
    const addresses=await resolveHost(url.hostname);if(!addresses.length||addresses.some(ip=>!isPublicIp(ip)))throw new Error('UNSAFE_DNS_RESULT')
    const deno=(globalThis as typeof globalThis&{Deno?:{env?:{get:(key:string)=>string|undefined}}}).Deno
    const response=await fetchImpl(url,{redirect:'manual',headers:{Accept:'text/html,application/xhtml+xml','User-Agent':deno?.env?.get('NOMINATIM_USER_AGENT')||'TadaWindProspector/1.0'},signal:AbortSignal.timeout(options.timeoutMs??10000)})
    if([301,302,303,307,308].includes(response.status)){
      const location=response.headers.get('location');if(!location)throw new Error('INVALID_REDIRECT')
      if(redirect===maxRedirects)throw new Error('TOO_MANY_REDIRECTS')
      url=parsePublicHttpUrl(location,url.href);continue
    }
    if(!response.ok)throw new Error(response.status===429?'RATE_LIMITED':'SOURCE_UNREACHABLE')
    const type=(response.headers.get('content-type')||'').toLowerCase();if(!type.includes('text/html')&&!type.includes('application/xhtml+xml'))throw new Error('UNSUPPORTED_CONTENT_TYPE')
    return {html:await readLimited(response,maxBytes),finalUrl:url.href}
  }
  throw new Error('TOO_MANY_REDIRECTS')
}

export async function sha256(value:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')}
