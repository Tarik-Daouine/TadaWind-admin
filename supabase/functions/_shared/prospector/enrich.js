import { parse } from 'npm:parse5@7.3.0'

const SKIP = new Set(['script', 'style', 'template', 'noscript'])
const clean = value => value.replace(/\s+/g, ' ').trim()
const attrs = node => Object.fromEntries((node.attrs ?? []).map(attr => [attr.name, attr.value]))
const belongsTo = (host, domain) => host === domain || host.endsWith(`.${domain}`)

function webUrl(value, base) {
  if (!value) return null
  try {
    const url = new URL(value, base)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
    url.hash = ''
    return url.href
  } catch { return null }
}

/** Pure HTML observations. The caller owns safe fetch, cache, source insertion and IDs. */
export function parseWebsiteHtml(html, { url, fetchedAt } = {}) {
  const pageUrl = webUrl(url)
  if (!pageUrl) throw new Error('INVALID_WEBSITE_URL')
  if (typeof html !== 'string' || html.length > 1_000_000) throw new Error('INVALID_HTML_SIZE')
  if (typeof fetchedAt !== 'string' || !Number.isFinite(Date.parse(fetchedAt))) throw new Error('INVALID_FETCHED_AT')
  const tree = parse(html)
  const nodes = [], textParts = [], stack = [tree]
  while (stack.length) {
    const node = stack.pop(), a = attrs(node)
    if (SKIP.has(node.tagName) || 'hidden' in a || a['aria-hidden'] === 'true') continue
    nodes.push(node)
    if (node.nodeName === '#text') textParts.push(node.value)
    const children = node.childNodes ?? []
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i])
  }
  const nodeText = root => {
    const parts = [], pending = [root]
    while (pending.length) {
      const node = pending.pop()
      if (node.nodeName === '#text') parts.push(node.value)
      if (!SKIP.has(node.tagName)) pending.push(...(node.childNodes ?? []).slice().reverse())
    }
    return clean(parts.join(' '))
  }
  const metas = new Map(nodes.filter(node => node.tagName === 'meta').map(node => {
    const a = attrs(node)
    return [(a.name ?? a.property ?? '').toLowerCase(), clean(a.content ?? '')]
  }))
  const title = nodeText(nodes.find(node => node.tagName === 'title') ?? {}) || metas.get('og:title') || null
  const description = metas.get('description') || metas.get('og:description') || null
  const socialSets = Object.fromEntries(['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube'].map(key => [key, new Set()]))
  const domains = { instagram: 'instagram.com', facebook: 'facebook.com', linkedin: 'linkedin.com', tiktok: 'tiktok.com', youtube: 'youtube.com' }
  const videos = new Set(), links = new Set(), emails = new Set(), phones = new Set(), dates = new Set()
  let hasVideoElement = false, hasContactForm = false
  for (const node of nodes) {
    const a = attrs(node)
    if (node.tagName === 'a') {
      if (/^mailto:/i.test(a.href ?? '')) {
        const email = a.href.slice(7).split('?')[0]
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) emails.add(email.toLowerCase())
      }
      if (/^tel:/i.test(a.href ?? '')) phones.add(a.href.slice(4))
      const link = webUrl(a.href, pageUrl)
      if (link) {
        links.add(link)
        const parsed = new URL(link)
        if (!/^\/(?:share|sharer|intent|login|dialog)(?:[/.]|$)/i.test(parsed.pathname) && parsed.pathname !== '/') {
          for (const [key, domain] of Object.entries(domains)) if (belongsTo(parsed.hostname, domain)) socialSets[key].add(link)
        }
      }
    }
    if (node.tagName === 'video') {
      hasVideoElement = true
      const src = webUrl(a.src, pageUrl)
      if (src) videos.add(src)
    }
    if (node.tagName === 'source' && node.parentNode?.tagName === 'video') {
      const src = webUrl(a.src, pageUrl)
      if (src) videos.add(src)
    }
    if (node.tagName === 'iframe') {
      const src = webUrl(a.src ?? a['data-src'], pageUrl)
      if (src) {
        const parsed = new URL(src)
        if ((['youtube.com', 'youtube-nocookie.com'].some(domain => belongsTo(parsed.hostname, domain)) && parsed.pathname.startsWith('/embed/')) || (parsed.hostname === 'player.vimeo.com' && parsed.pathname.startsWith('/video/'))) videos.add(src)
      }
    }
    if (node.tagName === 'form') {
      const descendants = [], pending = [...(node.childNodes ?? [])]
      while (pending.length) { const child = pending.pop(); descendants.push(child); pending.push(...(child.childNodes ?? [])) }
      hasContactForm ||= descendants.some(child => child.tagName === 'textarea') && descendants.some(child => child.tagName === 'input' && attrs(child).type?.toLowerCase() === 'email')
    }
    if (node.tagName === 'time' && a.datetime) dates.add(a.datetime)
  }
  const socials = Object.fromEntries(Object.entries(socialSets).map(([key, set]) => [key, [...set]]))
  const content = clean(textParts.join(' '))
  const website = {
    url: pageUrl, title, description, video_detected: hasVideoElement || videos.size > 0,
    video_urls: [...videos], has_contact_form: hasContactForm, visible_dates: [...dates],
    emails: [...emails], phones: [...phones], links: [...links],
    image_count: nodes.filter(node => node.tagName === 'img').length,
    // No video found on this page is not evidence of company-wide absence.
    has_video: hasVideoElement || videos.size > 0 ? 'oui' : 'inconnu',
    photos_professional: 'inconnu', has_drone: 'inconnu',
  }
  const signals = website.video_detected ? [{ type: 'video_observed_on_page', url: pageUrl, video_urls: [...videos] }] : []
  return {
    website, socials, signals,
    sources: [{ type: 'website_page', url: pageUrl, fetched_at: fetchedAt,
      content_excerpt: [title, description, content].filter(Boolean).join('\n').slice(0, 12000),
      extracted: { website, socials, signals }, confidence: 0.7 }],
  }
}
