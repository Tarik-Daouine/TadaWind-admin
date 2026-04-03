import { test, expect } from '@playwright/test'

test.use({
  storageState: { cookies: [], origins: [] },
})

test.describe('app shell', () => {
  test('loads the login screen', async ({ page }, testInfo) => {
    await page.goto('/')

    await expect(page.getByText('Administration')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible()

    await page.screenshot({
      path: testInfo.outputPath('login-page.png'),
      fullPage: true,
    })
  })
})
