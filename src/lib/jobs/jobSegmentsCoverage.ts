/**
 * Job-stages billing (v2.1070): pure math for the ② Invoices segment bar and
 * the "create invoice from selected segments" flow.
 *
 * The bar shows the job's line items as ordered segments sized by their share
 * of the Job Total, each colored by the lifecycle stage of the invoice that
 * bills it (via FixtureRow.invoice_id). Hazmat riders fold in as one trailing
 * segment. This is a projection of existing billing data — the break-off /
 * remainder-bundle model is untouched.
 *
 * Per-line dollars mirror revenueDollarsFromFixtures exactly: named rows
 * only, qty = count > 0 ? count : 1, null price = 0.
 */

export type SegmentFixtureLine = {
  id: string
  name: string
  count: number
  line_unit_price: number | null
  invoice_id: string | null
}

export type JobBarSegmentStatus = 'unbilled' | 'ready_to_bill' | 'billed' | 'paid'

export type JobBarSegment = {
  /** FixtureRow.id for line segments; 'riders' for the hazmat segment. */
  key: string
  label: string
  dollars: number
  /** Share of the bar total, 0–100. */
  pctOfTotal: number
  kind: 'line' | 'riders'
  status: JobBarSegmentStatus
  invoiceId: string | null
  /** Unbilled dollar-bearing line segments can be picked for an invoice. */
  selectable: boolean
}

function lineDollars(f: SegmentFixtureLine): number {
  if (!(f.name ?? '').trim()) return 0
  const c = Number(f.count)
  const qty = Number.isFinite(c) && c > 0 ? c : 1
  const unit = f.line_unit_price ?? 0
  return Math.round(qty * (Number.isFinite(unit) ? unit : 0) * 100) / 100
}

function statusFor(invoiceId: string | null, invoiceStatusById: Record<string, string>): JobBarSegmentStatus {
  if (!invoiceId) return 'unbilled'
  const s = invoiceStatusById[invoiceId]
  if (s === 'paid' || s === 'billed' || s === 'ready_to_bill') return s
  // Linked to an invoice we can't see (just deleted; refresh pending): show unbilled.
  return 'unbilled'
}

/**
 * Segments in display order for the 100% bar. Rows with zero dollars are
 * omitted (they'd have no width); the riders segment appends when > 0.
 * Returns [] when nothing has a dollar value — the bar should not render.
 */
export function buildJobSegmentsBar(args: {
  fixtures: SegmentFixtureLine[]
  riderFeesDollars: number
  invoiceStatusById: Record<string, string>
}): JobBarSegment[] {
  const { fixtures, riderFeesDollars, invoiceStatusById } = args
  const lines = fixtures
    .map((f) => ({ f, dollars: lineDollars(f) }))
    .filter((x) => x.dollars > 0)
  const riders = Math.round((riderFeesDollars || 0) * 100) / 100
  const total = lines.reduce((s, x) => s + x.dollars, 0) + (riders > 0 ? riders : 0)
  if (!(total > 0)) return []
  const segments: JobBarSegment[] = lines.map(({ f, dollars }) => {
    const status = statusFor(f.invoice_id, invoiceStatusById)
    return {
      key: f.id,
      label: (f.name ?? '').trim(),
      dollars,
      pctOfTotal: (dollars / total) * 100,
      kind: 'line',
      status,
      invoiceId: status === 'unbilled' ? null : f.invoice_id,
      selectable: status === 'unbilled',
    }
  })
  if (riders > 0) {
    segments.push({
      key: 'riders',
      label: 'Riders (hazmat fees)',
      dollars: riders,
      pctOfTotal: (riders / total) * 100,
      kind: 'riders',
      status: 'unbilled',
      invoiceId: null,
      selectable: false,
    })
  }
  return segments
}

export type SegmentBoundaryMark = { frac: number; label: string }

/**
 * Line-item boundary ticks for the Billing % done bar (v2.1130): the
 * cumulative share (0–1) where each segment ENDS, labeled for the tooltip
 * ("Rough-in ends at 42%"). The last segment's edge is the bar's right end,
 * so it's skipped, as is anything within half a percent of either edge —
 * a tick under the bar's border reads as a rendering glitch.
 */
export function segmentBoundaryMarks(segments: JobBarSegment[]): SegmentBoundaryMark[] {
  const marks: SegmentBoundaryMark[] = []
  let cumPct = 0
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]
    if (!seg) continue
    cumPct += seg.pctOfTotal
    if (cumPct <= 0.5 || cumPct >= 99.5) continue
    marks.push({ frac: cumPct / 100, label: `${seg.label} ends at ${Math.round(cumPct)}%` })
  }
  return marks
}

/**
 * Cents-exact total of the selected, still-billable rows. Rows that are
 * unnamed, zero-dollar, or already linked are ignored even if selected —
 * selection can go stale across a refresh.
 */
export function segmentSelectionSummary(
  fixtures: SegmentFixtureLine[],
  selectedIds: ReadonlySet<string>,
): { totalDollars: number; count: number } {
  let cents = 0
  let count = 0
  for (const f of fixtures) {
    if (!selectedIds.has(f.id)) continue
    if (f.invoice_id != null) continue
    const d = lineDollars(f)
    if (!(d > 0)) continue
    cents += Math.round(d * 100)
    count += 1
  }
  return { totalDollars: cents / 100, count }
}

/**
 * Row ids that a "create invoice from selection" will actually link — the
 * same validity rules as segmentSelectionSummary. Used to mirror the DB link
 * write into local fixtures state so the next delete+reinsert keeps it.
 */
export function linkableSelectedIds(
  fixtures: SegmentFixtureLine[],
  selectedIds: ReadonlySet<string>,
): string[] {
  const ids: string[] = []
  for (const f of fixtures) {
    if (!selectedIds.has(f.id)) continue
    if (f.invoice_id != null) continue
    if (!(lineDollars(f) > 0)) continue
    ids.push(f.id)
  }
  return ids
}

/**
 * sequence_order positions the selected rows will occupy after a save flush.
 * MUST mirror the save engine's filter exactly (named rows only, in array
 * order) — the linking UPDATE keys on these positions right after a flush.
 * Ignores selected rows that are unlinked-invalid the same way
 * segmentSelectionSummary does.
 */
export function selectedSegmentSequencePositions(
  fixtures: Array<SegmentFixtureLine & { line_description?: string }>,
  selectedIds: ReadonlySet<string>,
): number[] {
  const positions: number[] = []
  let i = 0
  for (const f of fixtures) {
    if (!(f.name ?? '').trim()) continue
    const pos = i
    i += 1
    if (!selectedIds.has(f.id)) continue
    if (f.invoice_id != null) continue
    if (!(lineDollars(f) > 0)) continue
    positions.push(pos)
  }
  return positions
}
