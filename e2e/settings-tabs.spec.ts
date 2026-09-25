import { test, expect } from '@playwright/test'

/**
 * Settings tabs cold-load smoke (added after the v2.853–v2.859 decomposition
 * moved every tab's engine into hooks): each tab a dev sees renders its
 * distinctive marker with zero page errors. READ-ONLY: tab clicks and
 * collapsible toggles only — no saves, sends, deletes, or admin actions.
 */

/**
 * Labels must match the group list in `src/lib/settingsGroups.ts` exactly — a
 * renamed tab strands this spec (E2E_SMOKE.md rule 6). Because a missing tab
 * makes `.click()` wait out the whole 90s test budget, a rename reads as a
 * mystery timeout rather than a name mismatch; the explicit click timeout below
 * keeps the next one cheap to diagnose.
 *
 * Rebuilt 2026-09-15 against the running app: eight of the twelve labels had
 * drifted (the tab list also moved out of `src/pages/Settings.tsx`), and because
 * the spec dies at the first mismatch CI only ever reported the first one. Every
 * marker below was checked visible on its own tab. Only "Job creation overrides"
 * was genuinely gone; the rest of the markers survived their tab's rename.
 * Four dev-visible tabs the old list never covered are now included.
 */
const TABS: Array<{ label: string; marker: RegExp | string; expand?: string }> = [
  { label: 'Your account', marker: 'My Profile' },
  { label: 'Your dashboard', marker: 'Dashboard buttons' },
  { label: 'Jobs & billing', marker: 'Collections law firm' },
  { label: 'Bids & materials', marker: 'Manage Parts' },
  { label: 'People & teams', marker: 'Additional People' },
  { label: 'Emails & reports', marker: 'Payment received notifications' },
  { label: 'What customers see', marker: 'Sample data:' },
  { label: 'Company', marker: 'Company documents' },
  { label: 'Usage', marker: 'Where the time goes' },
  { label: 'Data & recovery', marker: /[Bb]ackup/ },
  { label: 'Email templates & testing', marker: 'Notification Templates' },
  // Renamed from "Digital twins" in v2.3705 (the View-as sample accounts moved in).
  { label: 'Digital twins & samples', marker: 'Mint a twin' },
  { label: 'Advanced', marker: 'Fix app', expand: 'Advanced' },
  { label: 'Activity logs', marker: 'Most recent push notifications' },
  { label: 'Guides', marker: 'How do I' },
  { label: 'Release notes', marker: 'Current version' },
]

test('every dev-visible Settings tab renders its marker without page errors', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  await page.goto('/settings')
  const main = page.locator('main')
  // Default landing tab is Your account for every role.
  await expect(main).toContainText('My Profile')

  for (const tab of TABS) {
    // exact — several labels share words ("Emails & reports" / "Email templates
    // & testing", "Your account" / "Your dashboard"); pin them literally.
    await page.getByRole('tab', { name: tab.label, exact: true }).click({ timeout: 15_000 })
    if (tab.expand) await page.getByRole('button', { name: tab.expand }).click()
    // useInnerText — inactive tabs stay mounted under `display: none`, so a
    // textContent match passes for every marker on the page whichever tab is
    // selected. Visible text is what makes this assertion mean anything.
    await expect(main).toContainText(tab.marker, { timeout: 15_000, useInnerText: true })
  }

  expect(pageErrors).toEqual([])
})

test('deep link ?tab=settings-data activates the Data & recovery tab', async ({ page }) => {
  await page.goto('/settings?tab=settings-data')
  await expect(page.getByRole('tab', { name: 'Data & recovery' })).toHaveAttribute('aria-selected', 'true', {
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
