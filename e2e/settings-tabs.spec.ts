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
 *
 * Since v2.3816 `src/lib/settingsGroups.test.ts` reads this list and fails CI when it and the
 * dev's tab list differ — the rename to "Digital twins & samples" (v2.3705) went unseen for
 * over a hundred versions because this suite never gates a PR. Markers are not gated the same
 * way: when a tab's wording moves on purpose (v2.4108 rewrote Contracts & terms as an index)
 * this suite goes red on every deploy until the marker is amended here.
 */
const TABS: Array<{ label: string; marker: RegExp | string; expand?: string }> = [
  { label: 'Your account', marker: 'My Profile' },
  { label: 'Your dashboard', marker: 'Dashboard buttons' },
  { label: 'Jobs, bills and liens', marker: 'Collections law firm' },
  { label: 'Bids & materials', marker: 'Manage Parts' },
  { label: 'People & teams', marker: 'Additional People' },
  { label: 'Training', marker: 'Every course the app ships' },
  { label: 'Emails & reports', marker: 'Payment received notifications' },
  { label: 'What customers see', marker: 'Sample data:' },
  { label: 'What the team sees', marker: 'Sample data:' },
  { label: 'What everyone sees', marker: 'Nothing here reads or writes a real row.' },
  // The v2.4108 index dropped the "Contracts customers accept or sign" section heading; this
  // line is the toolbar's intro and only renders once the wording has loaded (v2.4223).
  { label: 'Contracts & terms', marker: 'The wording as it stands today' },
  // Messages, cut 4c (v2.5285): the papers built from clauses; the lede renders before the clauses load.
  { label: 'Contracts and clauses', marker: 'A contract here is an ordered set of clauses' },
  // Messages, cut 2's screens (v2.5311): who gets a new message; its heading renders before the seats load.
  { label: 'Phone and texts', marker: 'Who gets a new message' },
  // Messages, cut 4: the flows; the lede renders before the flow loads.
  { label: 'Flows', marker: 'One flow for each kind of person' },
  { label: 'Company', marker: 'Company documents' },
  // Dev doors (v2.5882): the card's title renders before anything loads — the list is a kernel.
  { label: 'Dev doors', marker: 'Only devs and the controller see these' },
  { label: 'Usage', marker: 'Where the time goes' },
  { label: 'Data & recovery', marker: /[Bb]ackup/ },
  { label: 'Email templates & testing', marker: 'Notification Templates' },
  // Renamed from "Digital twins" in v2.3705 (the View-as sample accounts moved in).
  { label: 'Digital twins & samples', marker: 'Mint a twin' },
  { label: 'Advanced', marker: 'Fix app', expand: 'Advanced' },
  { label: 'Activity logs', marker: 'Most recent push notifications' },
  { label: 'Guides', marker: 'How do I' },
  { label: 'Release notes', marker: 'Current version' },
  { label: 'How fast a change ships', marker: 'How long a change takes' },
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

/**
 * The finder's rows read at phone width (v2.6512): on a narrow pane a long-titled door ("How fast a change ships")
 * broke one word a line with its trail drawn over the first word. The title now takes the room it needs and wraps as
 * a sentence, the trail sits after it when it fits and drops whole to its own line when it does not, and the matched
 * keyword stays last. Measured, not read: the title's line count from its client rects, and the trail's box against
 * the title's. READ-ONLY: typing in the search box only.
 */
test('the finder\'s rows read at phone width: no one-word lines, the trail never over the title', async ({ page }) => {
  await page.goto('/settings')
  const box = page.getByRole('combobox', { name: 'Search settings' })
  await expect(box).toBeVisible()
  for (const width of [375, 520, 1280]) {
    await page.setViewportSize({ width, height: 812 })
    for (const query of ['merge', 'e']) {
      await box.fill('')
      await box.fill(query)
      await expect(page.getByRole('option').first()).toBeVisible()
      const rows = await page.getByRole('option').evaluateAll((els) =>
        els.map((el) => {
          const title = el.querySelector('[data-settings-search-title]') as HTMLElement
          const trail = el.querySelector('[data-settings-search-trail]') as HTMLElement
          const keyword = el.querySelector('[data-settings-search-keyword]') as HTMLElement | null
          const range = document.createRange()
          range.selectNodeContents(title)
          const lines = new Set(Array.from(range.getClientRects()).map((r) => Math.round(r.top))).size
          const t = title.getBoundingClientRect()
          const r = trail.getBoundingClientRect()
          const row = el.getBoundingClientRect()
          const overlaps = t.right > r.left + 0.5 && t.left < r.right - 0.5 && t.bottom > r.top + 0.5 && t.top < r.bottom - 0.5
          return {
            title: title.textContent ?? '',
            trail: trail.textContent ?? '',
            words: (title.textContent ?? '').trim().split(/\s+/).length,
            lines,
            overlaps,
            trailInside: r.right <= row.right + 0.5 && r.left >= row.left - 0.5,
            keywordLast: keyword == null || keyword.getBoundingClientRect().top >= Math.max(t.bottom, r.bottom) - 1,
          }
        }),
      )
      expect(rows.length).toBeGreaterThan(0)
      for (const row of rows) {
        const where = `${width}px "${query}" → ${row.title} · ${row.trail}`
        expect(row.overlaps, `${where}: the trail is drawn over the title`).toBe(false)
        expect(row.trailInside, `${where}: the trail runs past the row`).toBe(true)
        expect(row.keywordLast, `${where}: the keyword is not the last line`).toBe(true)
        // A sentence, never a stack: a title of n words takes fewer than n lines (one word is one line).
        if (row.words > 1) expect(row.lines, `${where}: ${row.lines} lines for ${row.words} words`).toBeLessThan(row.words)
        if (row.title === 'How fast a change ships') {
          expect(row.lines, `${where}: the long title wraps`).toBe(1)
          expect(row.trail, where).toBe('a tab →')
        }
      }
    }
  }
})
