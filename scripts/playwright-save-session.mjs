import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const baseURL = 'http://127.0.0.1:5174/TadaWind-admin/'
const authDir = 'playwright/.auth'
const authFile = `${authDir}/user.json`

async function waitForAppShell(page) {
  await Promise.race([
    page.getByRole('button', { name: 'Nouveau projet' }).waitFor({ state: 'visible', timeout: 10 * 60 * 1000 }),
    page.getByRole('button', { name: 'Projets' }).first().waitFor({ state: 'visible', timeout: 10 * 60 * 1000 }),
  ])
}

async function main() {
  await mkdir(authDir, { recursive: true })

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  })
  const page = await context.newPage()

  console.log('')
  console.log("Playwright va ouvrir l'admin.")
  console.log('Connecte-toi manuellement dans cette fenetre.')
  console.log("Des que l'admin est ouverte, la session sera sauvegardee automatiquement.")
  console.log('')

  await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
  await waitForAppShell(page)
  await context.storageState({ path: authFile })

  console.log(`Session sauvegardee dans ${authFile}`)

  await browser.close()
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
