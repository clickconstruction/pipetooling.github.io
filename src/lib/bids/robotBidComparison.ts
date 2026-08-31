/**
 * Robot-vs-human bid comparison (v2.2532, PR-2 of the robot readiness icon).
 * Pure math for the colorful-🤖 modal: classify each priced count row, total
 * both drafts the same way the Audits tab prices robot drafts (active version
 * rows only, override beats book price), and diff the summaries.
 */

export interface ComparisonCountRow {
  id: string
  fixture: string
  count: number
  bid_version_id: string | null
}

export interface ComparisonAssignment {
  count_row_id: string
  price_book_entry_id: string | null
  unit_price_override: number | null
}

export type CountRowClass = 'footage' | 'fitting' | 'fixture'

/** 'ft of …' rows are footage; '90/Tee/Ell/Wye/45' rows are fittings; the rest count as fixtures/equipment. */
export function classifyCountRow(fixture: string): CountRowClass {
  const f = fixture.trim().toLowerCase()
  if (f.startsWith('ft of')) return 'footage'
  if (/(?:^|[\s·])(?:90|45|tee|ell|wye|coupling)(?:$|[\s·/])/.test(f)) return 'fitting'
  return 'fixture'
}

export interface DraftComparisonSummary {
  /** Priced draft total (same rules as the Audits tab draft totals). */
  draftTotal: number
  rowCount: number
  /** Sum of counts on fixture/equipment rows. */
  fixtureCount: number
  /** Sum of counts on 'ft of …' rows. */
  footageFt: number
}

export function summarizeDraftForComparison(
  rows: ComparisonCountRow[],
  selectedVersionId: string | null,
  assignments: ComparisonAssignment[],
  entryPriceById: Record<string, number>,
): DraftComparisonSummary {
  const active = rows.filter((r) => (selectedVersionId ? r.bid_version_id === selectedVersionId : r.bid_version_id == null))
  const byRow = new Map(assignments.map((a) => [a.count_row_id, a]))
  let draftTotal = 0
  let fixtureCount = 0
  let footageFt = 0
  for (const r of active) {
    const cls = classifyCountRow(r.fixture)
    if (cls === 'fixture') fixtureCount += r.count
    else if (cls === 'footage') footageFt += r.count
    const a = byRow.get(r.id)
    if (!a) continue
    const unit = a.unit_price_override ?? (a.price_book_entry_id ? entryPriceById[a.price_book_entry_id] : undefined)
    if (unit == null) continue
    draftTotal += unit * r.count
  }
  return { draftTotal, rowCount: active.length, fixtureCount, footageFt }
}

/** Signed percent delta of robot vs ours; null when ours is 0/unknown. */
export function percentDelta(robot: number, ours: number): number | null {
  if (!Number.isFinite(ours) || ours === 0) return null
  return ((robot - ours) / ours) * 100
}
