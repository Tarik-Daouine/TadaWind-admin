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
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" style="width:560px;border-collapse:collapse;margin-top:22px;font-family:Arial,Helvetica,sans-serif;">
  <tr>
    <td width="5" bgcolor="#B78A4C" style="width:5px;background-color:#B78A4C;font-size:0;line-height:0;">&nbsp;</td>
    <td bgcolor="#F2EFE8" style="background-color:#F2EFE8;padding:16px 18px 15px 18px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;color:#223033;font-size:19px;line-height:23px;font-weight:700;padding:0 0 2px 0;">Tarik Daouine</td>
        </tr>
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;color:#36534F;font-size:12px;line-height:17px;font-weight:700;letter-spacing:0.2px;padding:0 0 9px 0;">VIDÉASTE &amp; TÉLÉPILOTE DE DRONE · TADA WIND</td>
        </tr>
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;color:#5A6667;font-size:12px;line-height:18px;padding:0 0 8px 0;">Sarlat-la-Canéda · Dordogne</td>
        </tr>
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;padding:0 0 9px 0;">
            <a href="https://www.tadawind.com/" style="color:#36534F;text-decoration:none;font-weight:700;">www.tadawind.com</a>
            <span style="color:#9A9186;">&nbsp;&nbsp;·&nbsp;&nbsp;</span>
            <a href="mailto:Tada-Wind@outlook.com" style="color:#36534F;text-decoration:none;">Tada-Wind@outlook.com</a>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #D7D0C4;padding:8px 0 0 0;font-family:Arial,Helvetica,sans-serif;color:#6B716F;font-size:10px;line-height:15px;letter-spacing:0.15px;">Vidéo promotionnelle · Drone · Immobilier · Tourisme · Événementiel · Réseaux sociaux</td>
        </tr>
      </table>
    </td>
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
  if (String(body).includes(SIGNATURE_MARKER)) return String(body)
  const bodyHtml = plainTextToEmailHtml(body)
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#263235;">${bodyHtml}${TADA_WIND_SIGNATURE_HTML}</div>`
}

export function buildTadaWindEmailPlainText(body = '') {
  const normalized = String(body).trimEnd()
  if (normalized.includes('Tarik Daouine') && normalized.includes('www.tadawind.com')) return normalized
  return `${normalized}\n\n${TADA_WIND_SIGNATURE_TEXT}`.trim()
}

export async function copyTadaWindEmailToClipboard(body = '') {
  const html = buildTadaWindEmailHtml(body)
  const text = buildTadaWindEmailPlainText(body)

  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    const item = new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    })
    await navigator.clipboard.write([item])
    return
  }

  await navigator.clipboard?.writeText(text)
}
