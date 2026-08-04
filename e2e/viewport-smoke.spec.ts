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

/**
 * Tablet band (v2.1357). Between the 640px hamburger breakpoint and a wide
 * desktop the header row is the thing that can overflow: the nav links plus the
 * right-hand icon strip need ~925px, and `useNavFitCollapse` is what folds them
 * into the hamburger when they don't fit. These widths pin that it actually
 * happens — the collapse used to depend on a ResizeObserver callback, which a
 * tab that never renders never receives.
 */
const TABLET_WIDTHS = [760, 900]

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

/**
 * Same invariant, asserted on the settled page. The header measures itself once
 * the role lands and folds to the hamburger if the row doesn't fit, so the
 * contract is that the page is not overflowing once it has settled — not that
 * it never overflows for a frame during boot.
 */
async function expectSettledNoSidewaysOverflow(page: Page, label: string) {
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        ),
      { timeout: 15000, message: `${label}: page still overflows sideways after settling` }
    )
    .toBeLessThanOrEqual(0)
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

// The header is global, so two pages are enough to pin it; both already have
// cold-load coverage above, which keeps the marker waits honest.
const TABLET_PAGES: Array<{ path: string; marker: RegExp | string }> = [
  { path: '/dashboard', marker: 'My Schedule' },
  { path: '/jobs?tab=stages', marker: /Working \(\d+\)/ },
]

for (const width of TABLET_WIDTHS) {
  for (const { path, marker } of TABLET_PAGES) {
    test(`no sideways overflow at ${width}px: ${path}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1024 })
      await page.goto(path)
      await expect(page.locator('main')).toContainText(marker, { timeout: 20000 })
      await expectSettledNoSidewaysOverflow(page, `${path} @ ${width}px`)
    })
  }
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

test('sticky modal header: ✕ stays reachable at max scroll (v2.990 pin)', async ({ page }) => {
  // The contract under test is `stickyModalHeaderStyle.ts` — the panel is the
  // scroller and the title bar (with its ✕) must stay pinned inside it. It was
  // reported from the field on Additional Report (v2.990) and generalised to
  // New report / Report view / Edit report / Add inspection / Create trip
  // charge / Review hours in v2.992, so ANY consumer pins the same helper.
  //
  // Add inspection is the one reachable in a single click from a tab that
  // already has cold-load coverage. Reaching Additional Report instead now
  // costs three nested modals (v2.1052 repointed the Stages "N Reports" pill at
  // the full-screen activity view, leaving Job Detail → Reports → Add as the
  // only route) — depth that made this spec fail for reasons unrelated to the
  // invariant. Prefer the shallowest consumer.
  await page.goto('/jobs?tab=inspections')
  // exact: true — "Add inspection type" would otherwise match as a substring.
  await page.getByRole('button', { name: 'Add Inspection', exact: true }).click({ timeout: 30000 })
  const heading = page.getByRole('heading', { name: 'Add inspection' })
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
  // Close (read-only: never save). Escape avoids the ambiguous
  // two-dialogs-both-named-Close click that flaked the first CI run.
  await page.keyboard.press('Escape')
})
