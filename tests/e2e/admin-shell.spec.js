import { test, expect } from '@playwright/test'
import { existsSync } from 'node:fs'

const authFile = 'playwright/.auth/user.json'

test.describe('admin shell', () => {
  test.skip(!existsSync(authFile), 'Une session Playwright locale est requise pour ce contrôle visuel.')

  test('reuses the saved local session', async ({ page }, testInfo) => {
    await page.goto('/')

    await expect(page.getByRole('button', { name: 'Projets' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Nouveau projet' })).toBeVisible()

    await page.screenshot({
      path: testInfo.outputPath('admin-home.png'),
      fullPage: true,
    })
  })
})
