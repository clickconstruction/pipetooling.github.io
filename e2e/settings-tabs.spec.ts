import { test, expect } from '@playwright/test'

/**
 * Settings tabs cold-load smoke (added after the v2.853–v2.859 decomposition
 * moved every tab's engine into hooks): each tab a dev sees renders its
 * distinctive marker with zero page errors. READ-ONLY: tab clicks and
 * collapsible toggles only — no saves, sends, deletes, or admin actions.
 */

/**
 * Labels must match `getSettingsJumpGroups` in `src/pages/Settings.tsx` exactly
 * — a renamed tab strands this spec (E2E_SMOKE.md rule 6). "Recent push" became
 * "Notifications" and "How it works" became "Guides"; because a missing tab makes
 * `.click()` wait out the whole 90s test budget, both renames read as a mystery
 * timeout rather than a name mismatch. The explicit click timeout below keeps the
 * next rename cheap to diagnose.
 */
const TABS: Array<{ label: string; marker: RegExp | string; expand?: string }> = [
  { label: 'Notifications', marker: 'Most recent push notifications' },
  { label: 'Your account', marker: 'My Profile' },
  { label: 'Dashboard & alerts', marker: 'Dashboard buttons' },
  { label: 'People & accounts', marker: 'Additional People' },
  { label: 'Email & notifications', marker: 'Payment received notifications' },
  { label: 'Data & migration', marker: /[Bb]ackup/ },
  { label: 'Jobs & dispatch', marker: 'Job creation overrides' },
  { label: 'Catalogs & trades', marker: 'Manage Parts' },
  { label: 'Templates & testing', marker: 'Notification Templates' },
  { label: 'Advanced', marker: 'Fix app', expand: 'Advanced' },
  { label: 'Guides', marker: 'How do I' },
  { label: 'Release notes', marker: 'Current version' },
]

test('every dev-visible Settings tab renders its marker without page errors', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  await page.goto('/settings')
  const main = page.locator('main')
  // Default landing tab is Notifications for every role.
  await expect(main).toContainText('Most recent push notifications')

  for (const tab of TABS) {
    // exact — two labels here differ only by case and surrounding words
    // ("Notifications" / "Email & notifications"); pin them literally.
    await page.getByRole('tab', { name: tab.label, exact: true }).click({ timeout: 15_000 })
    if (tab.expand) await page.getByRole('button', { name: tab.expand }).click()
    // useInnerText — inactive tabs stay mounted under `display: none`, so a
    // textContent match passes for every marker on the page whichever tab is
    // selected. Visible text is what makes this assertion mean anything.
    await expect(main).toContainText(tab.marker, { timeout: 15_000, useInnerText: true })
  }

  expect(pageErrors).toEqual([])
})

test('deep link ?tab=settings-data activates the Data & migration tab', async ({ page }) => {
  await page.goto('/settings?tab=settings-data')
  await expect(page.getByRole('tab', { name: 'Data & migration' })).toHaveAttribute('aria-selected', 'true', {
    timeout: 15_000,
  })
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
