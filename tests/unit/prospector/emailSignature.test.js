import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildTadaWindEmailHtml,
  buildTadaWindEmailPlainText,
  copyTadaWindEmailToClipboard,
  plainTextToEmailHtml,
  TADA_WIND_SIGNATURE_TEXT,
} from '../../../src/lib/prospector/emailSignature.js'

const MARKER = '<!-- TADA_WIND_SIGNATURE -->'
const countSignatures = html => (html.match(/TADA_WIND_SIGNATURE/g) ?? []).length

afterEach(() => vi.unstubAllGlobals())

describe('échappement du corps', () => {
  it.each([
    ['balise script', '<script>alert(1)</script>', '&lt;script&gt;'],
    ['chevron ouvrant', 'a < b', 'a &lt; b'],
    ['chevron fermant', 'a > b', 'a &gt; b'],
    ['esperluette', 'Dupont & Fils', 'Dupont &amp; Fils'],
    ['apostrophe droite', "l'hôtel", '&#039;'],
    ['guillemet double', 'le "domaine"', '&quot;'],
  ])('échappe %s', (_, body, expected) => {
    const html = buildTadaWindEmailHtml(body)
    expect(html).toContain(expected)
  })

  it('n’échappe pas deux fois une esperluette déjà encodée', () => {
    // &amp; doit devenir &amp;amp; : sinon un corps contenant du texte encodé
    // ressortirait interprété comme du balisage à l’affichage.
    expect(buildTadaWindEmailHtml('&amp;')).toContain('&amp;amp;')
  })

  it('ne laisse aucune balise du corps atteindre le HTML final', () => {
    const html = buildTadaWindEmailHtml('<img src=x onerror=alert(1)>')
    // Le gestionnaire survit en tant que texte affiché, ce qui est inoffensif :
    // ce qui compte est qu'aucune balise ne soit reconstituée.
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('conserve les accents français sans les encoder', () => {
    const html = buildTadaWindEmailHtml('Événement à Sarlat : reportage aérien, forêt et château.')
    expect(html).toContain('Événement à Sarlat')
    expect(html).toContain('aérien, forêt et château')
  })
})

describe('mise en forme multiligne', () => {
  it('sépare les paragraphes et garde les retours simples en <br>', () => {
    const html = plainTextToEmailHtml('Bonjour,\nvoici ma proposition.\n\nÀ bientôt.')
    expect(html.match(/<p /g)).toHaveLength(2)
    expect(html).toContain('Bonjour,<br>voici ma proposition.')
  })

  it('normalise les fins de ligne Windows', () => {
    expect(plainTextToEmailHtml('a\r\nb')).toContain('a<br>b')
    expect(buildTadaWindEmailPlainText('a\r\nb')).toContain('a\nb')
  })

  it('ne produit aucun paragraphe pour un corps vide ou blanc', () => {
    expect(plainTextToEmailHtml('')).toBe('')
    expect(plainTextToEmailHtml('   \n  ')).toBe('')
  })
})

describe('corps vide', () => {
  it('produit tout de même la signature, en HTML comme en texte', () => {
    const html = buildTadaWindEmailHtml('')
    expect(html).not.toContain('<p ')
    expect(countSignatures(html)).toBe(1)
    expect(buildTadaWindEmailPlainText('')).toBe(TADA_WIND_SIGNATURE_TEXT)
  })
})

describe('protection contre la double signature', () => {
  it('n’ajoute jamais deux signatures HTML', () => {
    expect(countSignatures(buildTadaWindEmailHtml('Bonjour'))).toBe(1)
  })

  it('neutralise un marqueur présent dans le corps au lieu de renvoyer du HTML brut', () => {
    // Le corps est du texte : un marqueur qui s’y trouve ne doit jamais servir
    // de laissez-passer pour émettre le corps sans échappement.
    const html = buildTadaWindEmailHtml(`${MARKER}<b>brut</b>`)
    expect(html).not.toContain('<b>brut</b>')
    expect(html).toContain('&lt;b&gt;brut')
    expect(countSignatures(html)).toBe(1)
  })

  it('ne re-signe pas un texte déjà signé', () => {
    const once = buildTadaWindEmailPlainText('Bonjour')
    expect(buildTadaWindEmailPlainText(once)).toBe(once)
    expect((buildTadaWindEmailPlainText(once).match(/Tarik Daouine/g) ?? [])).toHaveLength(1)
  })

  it('signe un corps qui cite seulement le site ou le nom', () => {
    // Le copywriter décrit Tada Wind : citer le site ne vaut pas signature.
    for (const body of ['Voir www.tadawind.com', 'Je suis Tarik Daouine', 'Tarik Daouine — www.tadawind.com']) {
      expect(buildTadaWindEmailPlainText(body)).toContain('Vidéaste & télépilote de drone')
    }
  })
})

describe('compatibilité Outlook', () => {
  it('utilise des tableaux et du CSS inline, sans balise de mise en page moderne', () => {
    const html = buildTadaWindEmailHtml('Bonjour')
    expect(html).toContain('<table role="presentation"')
    expect(html).toContain('cellpadding="0"')
    expect(html).not.toMatch(/display:\s*(flex|grid)/)
    expect(html).not.toContain('<style')
    expect(html).not.toContain('class=')
  })

  it('ne dépend d’aucune image externe', () => {
    expect(buildTadaWindEmailHtml('Bonjour')).not.toContain('<img')
  })
})

describe('presse-papiers', () => {
  const richBody = 'Bonjour & bienvenue'

  it('écrit les deux formats quand le presse-papiers riche est disponible', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { write, writeText: vi.fn() } })
    vi.stubGlobal('ClipboardItem', class { constructor(items) { this.items = items } })
    await expect(copyTadaWindEmailToClipboard(richBody)).resolves.toEqual({ format: 'html' })
    const [[[item]]] = write.mock.calls
    expect(Object.keys(item.items)).toEqual(['text/html', 'text/plain'])
  })

  it('retombe sur le texte seul sans ClipboardItem', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    vi.stubGlobal('ClipboardItem', undefined)
    await expect(copyTadaWindEmailToClipboard(richBody)).resolves.toEqual({ format: 'text' })
    expect(writeText.mock.calls[0][0]).toContain(TADA_WIND_SIGNATURE_TEXT)
  })

  it('signale une absence de presse-papiers au lieu de faire croire à une copie', async () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('ClipboardItem', undefined)
    await expect(copyTadaWindEmailToClipboard(richBody)).rejects.toThrow('CLIPBOARD_UNAVAILABLE')
  })

  it('signale un refus du navigateur', async () => {
    vi.stubGlobal('navigator', { clipboard: { write: vi.fn().mockRejectedValue(new Error('NotAllowedError')) } })
    vi.stubGlobal('ClipboardItem', class {})
    await expect(copyTadaWindEmailToClipboard(richBody)).rejects.toThrow('CLIPBOARD_DENIED')
  })
})
