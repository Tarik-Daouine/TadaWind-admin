import { test, expect } from '@playwright/test'

test.describe('admin shell', () => {
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
