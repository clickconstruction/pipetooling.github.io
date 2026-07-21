import { test, expect } from '@playwright/test'

/**
 * Every Jobs tab cold-loads and renders its distinctive surface. Assertions
 * are STRUCTURAL (headings/column labels), never data-exact — prod data moves.
 */

const TABS: Array<{ tab: string; marker: RegExp | string }> = [
  { tab: 'teams-summary', marker: 'Labor Cost' },
  { tab: 'reports', marker: /Reports/ },
  { tab: 'stages', marker: 'Billed Awaiting Payment' },
  { tab: 'billing', marker: 'Specific Work' },
  { tab: 'combined-labor', marker: /./ },
  { tab: 'sub_sheet_ledger', marker: 'Sub Labor Due' },
  { tab: 'parts', marker: 'Parts from Tally' },
  { tab: 'job-summary', marker: 'Revenue before Overhead' },
  { tab: 'inspections', marker: /Inspections?/ },
]

for (const { tab, marker } of TABS) {
  test(`tab ${tab} cold-loads without erroring`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(`/jobs?tab=${tab}`)
    await expect(page.locator('main')).toContainText(marker, { timeout: 30_000 })
    await expect(page.locator('main')).not.toContainText('Something went wrong')
    expect(errors).toEqual([])
  })
}

test('Stages tab state survives switching tabs and back (always-mounted contract)', async ({ page }) => {
  await page.goto('/jobs?tab=stages')
  const search = page.getByPlaceholder(/Search HCP, name, address/)
  await search.fill('e2e-persistence-probe')
  await page.getByRole('button', { name: 'Billing' }).click()
  await expect(page.locator('main')).toContainText('Specific Work')
  await page.getByRole('button', { name: 'Stages' }).click()
  await expect(page.getByPlaceholder(/Search HCP, name, address/)).toHaveValue('e2e-persistence-probe')
})
