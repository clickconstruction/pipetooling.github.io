import { test, expect } from '@playwright/test'

/**
 * Cold-load deep-link matrix — the exact regression class found by the
 * 2026-07-21 live sweep (v2.832/v2.833/v2.835 fixes): router effects that
 * drive imperative handles used to no-op on cold loads while stripping their
 * params. Every test here is a fresh page load (cold by construction).
 * READ-ONLY: nothing here confirms, saves, or sends.
 */

test('?showBilledTotalByName=true opens the Total by Name modal (v2.832 regression)', async ({ page }) => {
  await page.goto('/jobs?tab=stages&showBilledTotalByName=true')
  await expect(page.getByRole('heading', { name: 'Billed Awaiting Payment by Job Name' })).toBeVisible()
  await expect.poll(() => new URL(page.url()).searchParams.get('showBilledTotalByName')).toBeNull()
})

test('?openBankPayments=1 opens the Accounts Receivable modal (v2.832/v2.838 regressions)', async ({ page }) => {
  await page.goto('/jobs?tab=stages&openBankPayments=1')
  // .first(): the AR surface can render more than one 'Accounts Receivable' heading.
  await expect(page.getByRole('heading', { name: /Accounts Receivable/ }).first()).toBeVisible()
  await expect.poll(() => new URL(page.url()).searchParams.get('openBankPayments')).toBeNull()
})

test('?editLabor= with an unknown HCP opens New Sub Labor seeded with it (v2.835 regression)', async ({ page }) => {
  await page.goto('/jobs?tab=sub_sheet_ledger&editLabor=ZZE2E')
  await expect(page.getByRole('heading', { name: 'New Sub Labor' })).toBeVisible()
  await expect(page.locator('input[value="ZZE2E"]').first()).toBeVisible()
  await expect.poll(() => new URL(page.url()).searchParams.get('editLabor')).toBeNull()
})

test('?newJob=true&tab=sub_sheet_ledger opens the New Sub Labor modal (v2.835 regression)', async ({ page }) => {
  await page.goto('/jobs?newJob=true&tab=sub_sheet_ledger')
  await expect(page.getByRole('heading', { name: 'New Sub Labor' })).toBeVisible()
  await expect.poll(() => new URL(page.url()).searchParams.get('newJob')).toBeNull()
})

test('?stagesSection=billed opens and anchors the Billed section', async ({ page }) => {
  await page.goto('/jobs?stagesSection=billed')
  await expect(page.locator('#stages-billed')).toBeVisible()
  await expect.poll(() => new URL(page.url()).searchParams.get('stagesSection')).toBeNull()
})

test('/accounts-receivable loads directly instead of bouncing to the dashboard (v2.833 regression)', async ({ page }) => {
  await page.goto('/accounts-receivable')
  // .first(): the page h1 AND the always-open BankPaymentsModal both carry this heading.
  await expect(page.getByRole('heading', { name: 'Accounts Receivable' }).first()).toBeVisible()
  expect(new URL(page.url()).pathname).toBe('/accounts-receivable')
})

test('/map loads directly instead of bouncing to the dashboard (v2.833 regression)', async ({ page }) => {
  await page.goto('/map')
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).toBe('/map')
})
