const SIGNATURE_MARKER = '<!-- TADA_WIND_SIGNATURE -->'

export const TADA_WIND_CONTACT = Object.freeze({
  business: 'Tada Wind',
  name: 'Tarik Daouine',
  role: 'Vidéaste & télépilote de drone',
  location: 'Sarlat-la-Canéda · Dordogne',
  email: 'Tada-Wind@outlook.com',
  website: 'https://www.tadawind.com/',
})

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

export function plainTextToEmailHtml(value = '') {
  const normalized = String(value).replace(/\r\n/g, '\n').trim()
  if (!normalized) return ''
  return normalized
    .split(/\n{2,}/)
    .map(paragraph => `<p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#263235;">${escapeHtml(paragraph).replaceAll('\n', '<br>')}</p>`)
    .join('')
}

export const TADA_WIND_SIGNATURE_HTML = `${SIGNATURE_MARKER}
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" style="width:100%;max-width:560px;border-collapse:collapse;margin-top:24px;font-family:Arial,Helvetica,sans-serif;">
  <tr>
    <td height="4" bgcolor="#E10600" style="height:4px;background-color:#E10600;font-size:0;line-height:0;">&nbsp;</td>
  </tr>
  <tr>
    <td bgcolor="#171A21" style="background-color:#171A21;border:1px solid #292D35;border-top:0;padding:20px 22px 18px 22px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;">
        <tr>
          <td width="104" valign="middle" style="width:104px;padding:0 20px 0 0;vertical-align:middle;">
            <a href="https://www.tadawind.com/" style="text-decoration:none;">
              <img src="https://www.tadawind.com/images/logo-full.png" width="88" alt="Tada Wind" border="0" style="display:block;width:88px;height:auto;border:0;outline:none;text-decoration:none;">
            </a>
          </td>
          <td valign="middle" style="vertical-align:middle;border-left:1px solid #343943;padding:1px 0 1px 20px;">
            <div style="font-family:Georgia,'Times New Roman',serif;color:#FFFFFF;font-size:21px;line-height:25px;font-weight:700;letter-spacing:0.2px;">Tarik Daouine</div>
            <div style="font-family:Arial,Helvetica,sans-serif;color:#D6D9DE;font-size:10px;line-height:15px;font-weight:700;letter-spacing:1.05px;padding:4px 0 10px 0;">VIDÉASTE &amp; TÉLÉPILOTE DE DRONE</div>
            <div style="font-family:Arial,Helvetica,sans-serif;color:#969CA6;font-size:11px;line-height:16px;padding:0 0 8px 0;">Sarlat-la-Canéda&nbsp;&nbsp;·&nbsp;&nbsp;Dordogne</div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;">
              <a href="https://www.tadawind.com/" style="color:#FFFFFF;text-decoration:none;font-weight:700;">www.tadawind.com</a>
              <span style="color:#E10600;">&nbsp;&nbsp;/&nbsp;&nbsp;</span>
              <a href="mailto:Tada-Wind@outlook.com" style="color:#D6D9DE;text-decoration:none;">Tada-Wind@outlook.com</a>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td bgcolor="#0F1115" style="background-color:#0F1115;border:1px solid #292D35;border-top:0;padding:9px 22px 10px 22px;font-family:Arial,Helvetica,sans-serif;color:#8E949E;font-size:9px;line-height:13px;letter-spacing:1.2px;text-align:center;">FILMS&nbsp;&nbsp;·&nbsp;&nbsp;DRONE&nbsp;&nbsp;·&nbsp;&nbsp;CONTENUS VISUELS</td>
  </tr>
</table>`

export const TADA_WIND_SIGNATURE_TEXT = [
  'Tarik Daouine',
  'Vidéaste & télépilote de drone · Tada Wind',
  'Sarlat-la-Canéda · Dordogne',
  'https://www.tadawind.com/',
  'Tada-Wind@outlook.com',
].join('\n')

export function buildTadaWindEmailHtml(body = '') {
  // Le corps est du texte brut par contrat : il est toujours réencodé, jamais
  // renvoyé tel quel. Un marqueur trouvé dans le texte est neutralisé plutôt que
  // de court-circuiter l'échappement — sinon un corps le contenant ressortait
  // en HTML non échappé.
  const bodyHtml = plainTextToEmailHtml(String(body).split(SIGNATURE_MARKER).join(''))
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#263235;">${bodyHtml}${TADA_WIND_SIGNATURE_HTML}</div>`
}

export function buildTadaWindEmailPlainText(body = '') {
  // Correspondance exacte sur la signature entière : chercher « Tarik Daouine »
  // et « tadawind.com » séparément suffisait à sauter la signature dès qu'un
  // brouillon citait simplement le site.
  const normalized = String(body).replace(/\r\n/g, '\n').trimEnd()
  if (normalized.includes(TADA_WIND_SIGNATURE_TEXT)) return normalized
  return `${normalized}\n\n${TADA_WIND_SIGNATURE_TEXT}`.trim()
}

export async function copyTadaWindEmailToClipboard(body = '') {
  const html = buildTadaWindEmailHtml(body)
  const text = buildTadaWindEmailPlainText(body)
  const canWriteRich = Boolean(navigator?.clipboard?.write) && typeof ClipboardItem !== 'undefined'
  const canWriteText = Boolean(navigator?.clipboard?.writeText)
  // Sans presse-papiers utilisable, on le dit. La version précédente retombait
  // sur `navigator.clipboard?.writeText(...)`, qui résolvait sans rien copier :
  // l'utilisateur croyait avoir copié le message.
  if (!canWriteRich && !canWriteText) throw new Error('CLIPBOARD_UNAVAILABLE')
  try {
    if (canWriteRich) {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      })])
      return { format: 'html' }
    }
    await navigator.clipboard.writeText(text)
    return { format: 'text' }
  } catch (cause) {
    throw new Error('CLIPBOARD_DENIED', { cause })
  }
}
