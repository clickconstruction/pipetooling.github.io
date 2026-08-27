/**
 * Margin-breakdown jump-to-row (v2.2400, Wendi): the breakdown modal's
 * # Counts / 📐 Takeoffs / 🛠 Labor chips land on the destination tab's row
 * for that fixture — scrolled to center and flashed, the Jobs → Pipeline
 * idiom. This kernel owns the pure parts: where each tab's row DOM id comes
 * from, and the toast when the row doesn't exist yet.
 *
 * Keying: Counts and Takeoffs rows ARE the pricing grid's count rows, so they
 * land by count_row_id. Labor rows have no shared id — the HOURS row is found
 * by fixture name, exactly how the breakdown's own labor number is derived
 * (`pricingLaborRows.find` by lowercased fixture in BidsPricingTab).
 */

export type BreakdownJumpTab = 'counts' | 'takeoffs' | 'labor'

export type BreakdownJumpTarget = {
  tab: BreakdownJumpTab
  countRowId: string
  fixture: string
}

/** The labor-row match key — must stay in step with the breakdown's own labor lookup. */
export function normalizeFixtureKey(fixture: string | null | undefined): string {
  return (fixture ?? '').trim().toLowerCase()
}

export function countsRowDomId(countRowId: string): string {
  return `counts-row-${countRowId}`
}

export function takeoffRowDomId(countRowId: string): string {
  return `takeoff-row-${countRowId}`
}

export function laborRowDomId(fixture: string | null | undefined): string {
  return `labor-hours-row-${encodeURIComponent(normalizeFixtureKey(fixture))}`
}

/** The DOM id a jump target should land on. */
export function breakdownJumpDomId(target: BreakdownJumpTarget): string {
  if (target.tab === 'counts') return countsRowDomId(target.countRowId)
  if (target.tab === 'takeoffs') return takeoffRowDomId(target.countRowId)
  return laborRowDomId(target.fixture)
}

/** What the toast says when the tab opened but the row wasn't there to land on. */
export function breakdownJumpMissMessage(tab: BreakdownJumpTab, fixture: string): string {
  const name = fixture.trim() || 'this fixture'
  if (tab === 'labor') return `No labor row for “${name}” yet — add one below.`
  if (tab === 'takeoffs') return `No takeoff row for “${name}” on this version yet.`
  return `“${name}” isn’t on this version’s Counts.`
}
