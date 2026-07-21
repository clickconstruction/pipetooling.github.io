import { test, expect } from '@playwright/test'

/**
 * Settings tabs cold-load smoke (added after the v2.853–v2.859 decomposition
 * moved every tab's engine into hooks): each tab a dev sees renders its
 * distinctive marker with zero page errors. READ-ONLY: tab clicks and
 * collapsible toggles only — no saves, sends, deletes, or admin actions.
 */

const TABS: Array<{ label: string; marker: RegExp | string; expand?: string }> = [
  { label: 'Recent push', marker: 'Most recent push notifications' },
  { label: 'Your account', marker: 'My Profile' },
  { label: 'Dashboard & alerts', marker: 'Dashboard buttons' },
  { label: 'People & accounts', marker: 'Sharing and Adoption' },
  { label: 'Data & migration', marker: /[Bb]ackup/ },
  { label: 'Jobs & dispatch', marker: 'Job creation overrides' },
  { label: 'Catalogs & trades', marker: 'Manage Parts' },
  { label: 'Templates & testing', marker: 'Notification Templates' },
  { label: 'Advanced', marker: 'Fix app', expand: 'Advanced' },
  { label: 'How it works', marker: 'How It Works' },
]

test('every dev-visible Settings tab renders its marker without page errors', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  await page.goto('/settings')
  const main = page.locator('main')
  // Default landing tab is Recent push for every role.
  await expect(main).toContainText('Most recent push notifications')

  for (const tab of TABS) {
    await page.getByRole('tab', { name: tab.label }).click()
    if (tab.expand) await page.getByRole('button', { name: tab.expand }).click()
    await expect(main).toContainText(tab.marker, { timeout: 15_000 })
  }

  expect(pageErrors).toEqual([])
})

test('deep link ?tab=settings-data activates the Data & migration tab', async ({ page }) => {
  await page.goto('/settings?tab=settings-data')
  await expect(page.getByRole('tab', { name: 'Data & migration' })).toHaveAttribute('aria-selected', 'true', {
    timeout: 15_000,
  })
})

test('Sharing and Adoption expands and lists the adoption blocks (v2.853 extraction)', async ({ page }) => {
  await page.goto('/settings?tab=settings-people')
  await page.getByRole('button', { name: 'Sharing and Adoption' }).click()
  const main = page.locator('main')
  for (const heading of ['Adopt Assistants', 'Adopt Primaries', 'Adopt Superintendents', 'Share with other Master']) {
    await expect(main).toContainText(heading)
  }
  // Collapse again (still read-only).
  await page.getByRole('button', { name: 'Sharing and Adoption' }).click()
})

test('Catalogs engines load type lists per service type (v2.855 extraction)', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))
  await page.goto('/settings?tab=settings-catalogs')
  const main = page.locator('main')
  // The five type-CRUD engines render inside the collapsed "Manage Parts" section (pre-existing UI).
  await page.getByRole('button', { name: 'Manage Parts' }).click()
  await expect(main).toContainText('Service Types')
  await expect(main).toContainText('Material Part Types')
  await expect(main).toContainText('Takeoff, Labor, and Price Book Names')
  expect(pageErrors).toEqual([])
})
