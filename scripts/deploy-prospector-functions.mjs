// Déploie les Edge Functions Prospector via l'API Management Supabase.
// Requiert SUPABASE_ACCESS_TOKEN. Usage : node scripts/deploy-prospector-functions.mjs <slug>
// slug : prospector-worker (défaut) | prospector-enrich
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const env = Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)
  .filter(l => /^[A-Z_]+\s*=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')] }))
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN requis')

const slug = process.argv[2] || 'prospector-worker'
const SHARED = 'supabase/functions/_shared/prospector'
// Les shims scoring.js / dedupe.js réexportent src/lib/** (chemin valide en repo + Vitest,
// hors périmètre du bundle Edge). Le scoring runtime est en SQL, ils ne sont pas importés ici.
const sharedFiles = readdirSync(new URL('../' + SHARED, import.meta.url))
  .filter(f => /\.(ts|js)$/.test(f))
  .filter(f => !readFileSync(new URL(`../${SHARED}/${f}`, import.meta.url), 'utf8').trimStart().startsWith('export * from \'../../../../src/'))
const entry = `supabase/functions/${slug}`

const files = [
  { path: `${entry}/index.ts`, name: `functions/${slug}/index.ts` },
  { path: `${entry}/deno.json`, name: `functions/${slug}/deno.json` },
  ...sharedFiles.map(f => ({ path: `${SHARED}/${f}`, name: `functions/_shared/prospector/${f}` })),
]

const form = new FormData()
form.append('metadata', new Blob([JSON.stringify({
  name: slug,
  entrypoint_path: `functions/${slug}/index.ts`,
  import_map_path: `functions/${slug}/deno.json`,
  verify_jwt: !['prospector-worker','contact-submit','automation-worker','automation-outlook','automation-status'].includes(slug),
})], { type: 'application/json' }), 'metadata.json')
for (const f of files) {
  form.append('file', new Blob([readFileSync(new URL('../' + f.path, import.meta.url))], { type: 'application/typescript' }), f.name)
}

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/functions/deploy?slug=${slug}`, {
  method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form, signal: AbortSignal.timeout(120000),
})
const text = await res.text()
if (!res.ok) throw new Error(`Deploy ${res.status}: ${text.slice(0, 2000)}`)
console.log(JSON.stringify({ deployed: slug, ref, files: files.map(f => f.name), version: JSON.parse(text).version }, null, 1))
