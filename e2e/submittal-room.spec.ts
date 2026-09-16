import { test, expect } from '@playwright/test'

/**
 * The review room's public route (Submittals stage 4a): a cold load without a token
 * renders the dead-link line instead of a blank page or the sign-in redirect.
 * READ-ONLY — no room is opened, nothing is logged.
 */
test('/submittal with no token says the link is incomplete', async ({ page }) => {
  await page.goto('/submittal')
  await expect(page.getByText('This link is incomplete.')).toBeVisible()
})
