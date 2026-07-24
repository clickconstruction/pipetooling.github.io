import { test, expect, type Page } from '@playwright/test'

/**
 * Phone-viewport smoke (v2.1003, improvement-plan item #5): the whole class of
 * "page pushes sideways on a phone" and "modal close button scrolls away"
 * bugs fixed across v2.980–v2.992 (Stages toolbar/tables, header collapse,
 * Additional Report ✕) was only ever caught by humans on phones. This spec
 * pins both invariants at iPhone size. READ-ONLY: navigation, section toggles,
 * and modal open/close only.
 */

const PHONE = { width: 375, height: 812 }

test.use({ viewport: PHONE })

async function expectNoSidewaysOverflow(page: Page, label: string) {
  // Layout viewport must not exceed the visual viewport: scrollWidth at the
  // document level is the exact regression signature of v2.980/v2.982.
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(metrics.scrollWidth, `${label}: page overflows sideways (${metrics.scrollWidth}px layout in ${metrics.clientWidth}px viewport)`).toBeLessThanOrEqual(metrics.clientWidth)
}

const PAGES: Array<{ path: string; marker: RegExp | string }> = [
  { path: '/dashboard', marker: 'My Schedule' },
  { path: '/jobs?tab=stages', marker: /Working \(\d+\)/ },
  { path: '/estimates', marker: 'Estimates' },
  { path: '/quickfill', marker: /Quickfill/i },
  { path: '/people', marker: /People|Users/ },
  { path: '/materials', marker: /Price Book|Supply|Templates|Purchase/i },
  { path: '/settings', marker: /Settings/ },
]

for (const { path, marker } of PAGES) {
  test(`no sideways overflow at 375px: ${path}`, async ({ page }) => {
    await page.goto(path)
    await expect(page.locator('main')).toContainText(marker, { timeout: 20000 })
    await expectNoSidewaysOverflow(page, path)
  })
}

test('Stages tables scroll inside their own wrappers, not the page', async ({ page }) => {
  await page.goto('/jobs?tab=stages')
  await expect(page.locator('main')).toContainText(/Working \(\d+\)/, { timeout: 20000 })
  await expectNoSidewaysOverflow(page, 'stages after load')
  // Every board table's scroll container must clip to the viewport while the
  // table itself is wider (the v2.984 contract: wide tables scroll internally).
  const info = await page.evaluate(() => {
    const out: Array<{ containerW: number; tableW: number }> = []
    for (const table of Array.from(document.querySelectorAll('main table'))) {
      const container = table.parentElement
      if (!container) continue
      out.push({ containerW: container.clientWidth, tableW: table.scrollWidth })
    }
    return { viewport: document.documentElement.clientWidth, tables: out.slice(0, 6) }
  })
  for (const t of info.tables) {
    expect(t.containerW, 'table scroll container wider than the viewport').toBeLessThanOrEqual(info.viewport)
  }
})

test('Additional Report modal: ✕ stays reachable at max scroll (v2.990 pin)', async ({ page }) => {
  await page.goto('/jobs?tab=stages')
  await expect(page.locator('main')).toContainText(/Working \(\d+\)/, { timeout: 20000 })
  // Open any job's Reports modal, then the Additional Report form from it.
  const reportsBtn = page.getByRole('button', { name: /\d+ Reports?$/ }).first()
  await reportsBtn.click()
  const addBtn = page.getByRole('button', { name: /Add additional report/i })
  await addBtn.click()
  const heading = page.getByRole('heading', { name: 'Additional Report' })
  await expect(heading).toBeVisible()
  // Scroll the modal panel to its bottom; the sticky title bar (and its ✕)
  // must remain inside the panel's visible box.
  const result = await page.evaluate(() => {
    const closeBtn = Array.from(document.querySelectorAll('button[aria-label="Close"]')).find(
      (b) => b.textContent?.trim() === '×' && (b as HTMLElement).offsetParent !== null,
    ) as HTMLElement | undefined
    if (!closeBtn) return { ok: false, why: 'close button not found' }
    let panel: HTMLElement | null = closeBtn.parentElement as HTMLElement | null
    while (panel && panel.scrollHeight <= panel.clientHeight + 2) panel = panel.parentElement as HTMLElement | null
    if (!panel) return { ok: true, why: 'panel does not scroll at this height' }
    panel.scrollTop = panel.scrollHeight
    const pr = panel.getBoundingClientRect()
    const cr = closeBtn.getBoundingClientRect()
    return {
      ok: cr.bottom > pr.top && cr.top < pr.bottom,
      why: `close at ${Math.round(cr.top)}, panel ${Math.round(pr.top)}–${Math.round(pr.bottom)} after scrolling ${panel.scrollTop}px`,
    }
  })
  expect(result.ok, result.why).toBe(true)
  // Close everything (read-only: no save). Escape avoids the ambiguous
  // two-dialogs-both-named-Close click that flaked the first CI run.
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
})
