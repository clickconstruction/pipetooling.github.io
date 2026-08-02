import { test, expect } from '@playwright/test'

/**
 * Stages board structure + the print popup path. READ-ONLY: section toggles
 * and modal open/close only — no status moves, no confirms, no sends.
 * window.print is stubbed in every page/popup so headless runs never hang on
 * a print dialog.
 */

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    window.print = () => {}
  })
})

test('the six board sections render with the section flow header', async ({ page }) => {
  await page.goto('/jobs?tab=stages')
  const main = page.locator('main')
  for (const section of ['Waiting', 'Working', 'Ready to Bill', 'Billed Awaiting Payment', 'Collections', 'Paid in Full']) {
    await expect(main).toContainText(section)
  }
})

test('section headers show dollar totals and the capable-to-bill figure', async ({ page }) => {
  await page.goto('/jobs?tab=stages')
  await expect(page.locator('main')).toContainText(/Working \(\d+\)/)
  await expect(page.locator('main')).toContainText('Capable of Being Billed:')
})

test('Total by Name modal opens from the ⋯ tools menu and its Print builds the report popup', async ({ page }) => {
  await page.goto('/jobs?tab=stages')
  await expect(page.locator('main')).toContainText(/Working \(\d+\)/, { timeout: 20000 })
  // v2.1049 collapsed the Stages toolbar to New Job + search + a ⋯ menu; Total
  // by Name is a menuitem there and is not in the DOM until the menu opens.
  await page.getByRole('button', { name: 'Pipeline tools' }).click()
  await page.getByRole('menuitem', { name: /^Total by Name/ }).click()
  // Scope to the dialog: the board's Billed section header carries a print button
  // with the SAME accessible name, so page-level lookups are ambiguous.
  const dialog = page.getByRole('dialog', { name: 'Billed Awaiting Payment by Job Name' })
  await expect(dialog.getByRole('heading', { name: 'Billed Awaiting Payment by Job Name' })).toBeVisible()

  const popupPromise = page.waitForEvent('popup')
  await dialog.getByRole('button', { name: 'Print billed awaiting payment report' }).click()
  const popup = await popupPromise
  await popup.waitForLoadState('domcontentloaded')
  await expect(popup.locator('h1')).toContainText('Billed awaiting payment')
  await popup.close()

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog', { name: 'Billed Awaiting Payment by Job Name' })).toBeHidden()
})
