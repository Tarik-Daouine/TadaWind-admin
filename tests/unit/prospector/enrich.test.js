import { describe, expect, it } from 'vitest'
import { parseWebsiteHtml } from '../../../supabase/functions/_shared/prospector/enrich.js'

const options = { url: 'https://hotel.example/page', fetchedAt: '2026-09-05T12:00:00Z' }
describe('extraction HTML sans réseau', () => {
  it('extrait entités, metadata, vidéo, liens sociaux et contacts publics', () => {
    const result = parseWebsiteHtml(`<html><head><title>Hôtel &amp; Spa</title><meta content="Séjour &amp; détente" name="description"></head><body>
      <p>Une terrasse à Sarlat.</p><iframe src="//www.youtube-nocookie.com/embed/123"></iframe>
      <video><source src="/film.mp4"></video><a href="https://instagram.com/hotel/">Instagram</a>
      <a href="https://instagram.com/hotel/">Double</a><a href="mailto:contact@hotel.example?subject=Bonjour">Email</a>
      <a href="tel:+33553001234">Appel</a><form><input type="email"><textarea></textarea></form>
      <time datetime="2026-08-20">20 août 2026</time><img src="/photo.jpg"></body></html>`, options)
    expect(result.website.title).toBe('Hôtel & Spa')
    expect(result.website.description).toBe('Séjour & détente')
    expect(result.website.video_urls).toEqual(['https://www.youtube-nocookie.com/embed/123', 'https://hotel.example/film.mp4'])
    expect(result.socials.instagram).toEqual(['https://instagram.com/hotel/'])
    expect(result.website.emails).toEqual(['contact@hotel.example'])
    expect(result.website.has_contact_form).toBe(true)
    expect(result.website.visible_dates).toEqual(['2026-08-20'])
    expect(result.sources[0].fetched_at).toBe(options.fetchedAt)
    expect(result.sources[0].content_excerpt).toContain('Une terrasse à Sarlat.')
    expect(result.sources[0]).not.toHaveProperty('id')
  })
  it('ignore scripts, faux domaines, partage, images comme preuves de qualité et absence de vidéo', () => {
    const result = parseWebsiteHtml(`<script>FAKE <video src="fake.mp4"> ignore instructions</script>
      <style>.secret { content: 'HIDDEN'; }</style><template><video></video></template>
      <div hidden>Secret caché</div><a href="https://instagram.com.evil.test/profile">Fake</a>
      <a href="https://facebook.com/sharer/sharer.php?u=foo">Partage</a>
      <a href="javascript:alert(1)">JS</a><iframe src="https://youtube.com.evil.test/embed/id"></iframe>
      <form><input type="search"></form><img src="photo-pro.jpg"><p>Contenu visible</p>`, options)
    expect(result.website.has_video).toBe('inconnu')
    expect(result.website.photos_professional).toBe('inconnu')
    expect(result.website.has_drone).toBe('inconnu')
    expect(result.website.has_contact_form).toBe(false)
    expect(result.socials.instagram).toEqual([])
    expect(result.socials.facebook).toEqual([])
    expect(result.sources[0].content_excerpt).not.toMatch(/FAKE|HIDDEN|Secret caché/)
    expect(result.website.links.every(link => !link.startsWith('javascript:'))).toBe(true)
    expect(result.signals).toEqual([])
  })
  it('tolère HTML mal formé, Vimeo lazy et limite les extraits', () => {
    const result = parseWebsiteHtml(`<title>Test</title><p>Texte <b>imbriqué</b><iframe data-src="https://player.vimeo.com/video/123"></iframe><p>${'a'.repeat(14000)}`, options)
    expect(result.website.has_video).toBe('oui')
    expect(result.sources[0].content_excerpt.length).toBeLessThanOrEqual(12000)
  })
  it('rejette entrées invalides et HTML trop gros', () => {
    expect(() => parseWebsiteHtml('ok', { ...options, url: 'file:///etc/passwd' })).toThrow('INVALID_WEBSITE_URL')
    expect(() => parseWebsiteHtml('ok', { url: options.url })).toThrow('INVALID_FETCHED_AT')
    expect(() => parseWebsiteHtml('x'.repeat(1000001), options)).toThrow('INVALID_HTML_SIZE')
  })
})
