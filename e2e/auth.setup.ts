import { test as setup, expect } from '@playwright/test'

const AUTH_FILE = 'e2e/.auth/user.json'

/**
 * Logs in as the dedicated E2E test user and saves the Supabase session
 * (localStorage) as Playwright storageState for every other spec. Credentials
 * come ONLY from the environment — never hardcode them.
 */
setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL
  const password = process.env.E2E_TEST_PASSWORD
  if (!email || !password) {
    throw new Error('E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set (GitHub Actions secrets in CI).')
  }

  await page.goto('/sign-in')
  // Use the source-defined ids: PasswordInput renders a second element with
  // the 'Password' accessible name (the show/hide toggle), so getByLabel is
  // ambiguous under strict mode.
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  // Signed-in shell: the main nav renders a Jobs link.
  await expect(page.getByRole('link', { name: 'Jobs' })).toBeVisible({ timeout: 30_000 })

  await page.context().storageState({ path: AUTH_FILE })
})
