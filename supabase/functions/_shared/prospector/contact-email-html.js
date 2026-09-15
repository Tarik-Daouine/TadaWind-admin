// Restored from the user's original confirmation email. No visitor message is echoed in the receipt.
const escape = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')
export function contactReceiptHtml(data) {
  const date = data.date_souhaitee ? data.date_souhaitee.split('-').reverse().join('/') : 'À définir'
  return `<!doctype html><html lang="fr">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
</head>
<body style="margin:0;padding:0;background-color:#0f1115;font-family:Arial,Helvetica,sans-serif;">
<div style="margin:0; padding:0; background-color:#0f1115; font-family:Arial, Helvetica, sans-serif; color:#ffffff;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f1115; padding:60px 0;">
<tbody>
<tr>
<td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="width:100%; max-width:600px; box-sizing:border-box; background-color:#171a21; border-radius:14px; padding:50px 45px; box-shadow:0 0 0 1px #22252c;">
<!-- Logo -->
<tbody>
<tr>
<td align="center" style="padding-bottom:35px;"><img alt="Tada-Wind" width="140" style="display:block;" src="https://www.tadawind.com/images/logo-full.png">
</td>
</tr>
<!-- Title -->
<tr>
<td style="text-align:center; padding-bottom:25px;">
<h2 style="color:#ffffff; font-family:Arial,Helvetica,sans-serif; margin:0; font-weight:500; letter-spacing:2px; font-size:20px;">DEMANDE BIEN REÇUE
</h2>
<div style="width:60px; height:2px; background-color:#e10600; margin:15px auto 0 auto;">
</div>
</td>
</tr>
<!-- Intro -->
<tr>
<td style="padding-bottom:30px; font-size:15px; line-height:1.7; color:#d2d6dc;">
Bonjour <strong style="color:#ffffff;">${escape(data.prenom)}</strong>,<br>
<br>
Merci pour votre demande concernant votre projet à <strong style="color:#ffffff;">
${escape(data.ville_lieu)}</strong>.<br>
<br>
Chaque mission est analysée avec rigueur afin de garantir conformité réglementaire, sécurité opérationnelle et qualité d'image.
</td>
</tr>
<!-- Details box -->
<tr>
<td style="background-color:#0f1115; padding:25px; border-radius:10px; font-size:14px; line-height:1.8; border:1px solid #22252c;">
<div style="letter-spacing:1px; font-size:12px; color:#888c94; padding-bottom:10px;">
INFORMATIONS TRANSMISES </div>
<div style="color:#ffffff;"><span style="color:#e10600;">●</span> Lieu : ${escape(data.ville_lieu)}<br>
<span style="color:#e10600;">●</span> Date souhaitée : ${escape(date)}<br>
<span style="color:#e10600;">●</span> Type de besoin : ${escape(data.type_besoin)}<br>
</div>
</td>
</tr>
<!-- Timeline -->
<tr>
<td style="padding-top:30px; font-size:15px; line-height:1.7; color:#d2d6dc;">Une réponse vous sera adressée sous
<strong style="color:#ffffff;">24 à 48 heures</strong> après étude technique et réglementaire.
</td>
</tr>
<!-- Button -->
<tr>
<td align="center" style="padding-top:40px;"><a href="https://www.tadawind.com" style="background-color:#e10600; color:#ffffff; padding:14px 32px; text-decoration:none; border-radius:4px; font-weight:600; letter-spacing:1px; display:inline-block;">DÉCOUVRIR TADA-WIND
</a></td>
</tr>
<!-- Signature -->
<tr>
<td style="padding-top:50px; font-size:13px; color:#8a8f98; text-align:center; line-height:1.6;">
Tarik Daouine<br>
Télépilote professionnel UAS<br>
<span style="color:#ffffff;">Tada-Wind</span><br>
<br>
Cet email confirme la réception de votre demande via le site officiel. </td>
</tr>
</tbody>
</table>
</td>
</tr>
</tbody>
</table>
</div>
</body>
</html>
`
}
export function contactInternalHtml(text) {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#0f1115;color:#fff;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 12px"><tr><td align="center"><table role="presentation" width="600" style="width:100%;max-width:600px;background:#171a21;border:1px solid #22252c;border-radius:14px;padding:32px"><tr><td align="center"><img src="https://www.tadawind.com/images/logo-full.png" alt="Tada-Wind" width="140"><h2 style="color:#ffffff;font-size:20px;letter-spacing:2px">NOUVELLE DEMANDE</h2></td></tr><tr><td style="font-size:15px;line-height:1.7;color:#d2d6dc">${escape(text).replaceAll('\n','<br>')}</td></tr><tr><td align="center" style="padding-top:28px"><a href="https://tarik-daouine.github.io/TadaWind-admin/" style="display:inline-block;background:#e10600;color:#fff;padding:14px 24px;text-decoration:none">OUVRIR L’ADMIN</a></td></tr></table></td></tr></table></body></html>`
}
