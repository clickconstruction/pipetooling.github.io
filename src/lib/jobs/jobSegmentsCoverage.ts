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

export type SegmentDollarCoverage = {
  /** Unattributed spoken-for dollars applied to this segment by the waterfall. */
  coveredDollars: number
  /** Covered to the last cent — the row locks until an invoice is voided/deleted. */
  fullyCovered: boolean
}

export type JobDollarCoverage = {
  /**
   * Dollars already paid or on active invoices that are NOT accounted for by
   * invoice-linked line items — the slider/manual-invoice money the segment
   * strip would otherwise not show at all.
   */
  unattributedDollars: number
  /** What's still billable — identical to the Make Invoice slider's Remaining. */
  remainingDollars: number
  /** Waterfall attribution over unbilled segments in display order, by segment key. */
  bySegmentKey: Record<string, SegmentDollarCoverage>
}

/**
 * ② Invoices dollar-coverage model (v2.1132). Invoices created from segment
 * selection link their line items, so those blocks already read billed/paid.
 * Invoices carved by dollar amount (Make Invoice slider, partial-invoice
 * modal) link nothing — the strip stayed all-amber while real money was
 * already out. This computes:
 *
 *  - unattributedDollars: (payments + draft/billed invoice amounts) minus the
 *    dollars of already-linked segments — money spoken for that no block shows.
 *    The payments+invoices basis is unallocatedBillableDollars' exactly, so
 *    this and remainingDollars can never disagree with the slider.
 *  - a WATERFALL of that amount over unbilled segments in display order
 *    (riders included — their dollars are billable too): first items covered
 *    first. This is an interpretation — dollar invoices don't say which items
 *    they bought — so partially covered rows stay selectable; only rows
 *    covered to the last cent lock.
 */
export function dollarCoverageForSegments(args: {
  segments: JobBarSegment[]
  /** Job total including riders — same gross the break-off slider uses. */
  grossDollars: number
  paidDollars: number
  invoices: Array<{ status: string; amount: unknown; is_primary_rtb_bundle?: boolean | null }> | null | undefined
}): JobDollarCoverage {
  const { segments, grossDollars, paidDollars, invoices } = args
  // v2.1134: the never-sent PRIMARY remainder bundle is elastic — it exists to
  // equal whatever isn't billed yet and resizes via the ensure RPC whenever
  // other bills change. Counting it as spoken-for money would hatch the whole
  // strip and clamp segment invoicing to $0 on every Ready-to-Bill job.
  const allocated = (invoices ?? []).reduce(
    (sum, inv) =>
      (inv.status === 'ready_to_bill' && inv.is_primary_rtb_bundle !== true) || inv.status === 'billed'
        ? sum + (Number(inv.amount) || 0)
        : sum,
    0,
  )
  const attributedCents = segments.reduce(
    (sum, s) => (s.status !== 'unbilled' ? sum + Math.round(s.dollars * 100) : sum),
    0,
  )
  const spokenForCents = Math.round((paidDollars + allocated) * 100)
  const unattributedCents = Math.max(0, spokenForCents - attributedCents)
  const remainingCents = Math.max(0, Math.round(grossDollars * 100) - spokenForCents)

  const bySegmentKey: Record<string, SegmentDollarCoverage> = {}
  let pool = unattributedCents
  for (const seg of segments) {
    if (seg.status !== 'unbilled') continue
    if (pool <= 0) break
    const segCents = Math.round(seg.dollars * 100)
    const coveredCents = Math.min(segCents, pool)
    pool -= coveredCents
    bySegmentKey[seg.key] = {
      coveredDollars: coveredCents / 100,
      fullyCovered: coveredCents >= segCents,
    }
  }

  return {
    unattributedDollars: unattributedCents / 100,
    remainingDollars: remainingCents / 100,
    bySegmentKey,
  }
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
 * Selection totals net of dollar coverage: what "create invoice from
 * remaining on selected segments" will actually bill. For each selected,
 * still-billable row, the waterfall's covered dollars are subtracted from the
 * row's dollars (cents-exact, clamped at zero per row). With no coverage
 * model (new job) net equals gross. Fully covered rows are unselectable
 * upstream, so a non-empty selection always nets > 0.
 */
export function segmentSelectionNetSummary(
  fixtures: SegmentFixtureLine[],
  selectedIds: ReadonlySet<string>,
  coverage: JobDollarCoverage | null | undefined,
): { grossDollars: number; coveredDollars: number; netDollars: number; count: number } {
  let grossCents = 0
  let coveredCents = 0
  let count = 0
  for (const f of fixtures) {
    if (!selectedIds.has(f.id)) continue
    if (f.invoice_id != null) continue
    const d = lineDollars(f)
    if (!(d > 0)) continue
    const segCents = Math.round(d * 100)
    const c = Math.min(segCents, Math.round((coverage?.bySegmentKey[f.id]?.coveredDollars ?? 0) * 100))
    grossCents += segCents
    coveredCents += c
    count += 1
  }
  return {
    grossDollars: grossCents / 100,
    coveredDollars: coveredCents / 100,
    netDollars: (grossCents - coveredCents) / 100,
    count,
  }
}

/**
 * v2.2467: a typed New-Invoice dollar amount that exactly equals the remaining
 * net of EXACTLY ONE still-billable segment is that segment, billed by its
 * price — link it so the customer's bill lists that line, not the whole job
 * prorated (Taunya, job 978: typing the change order's $1,980 produced a bill
 * showing $1,080 + $900 across both line items). Exact single match only:
 * zero matches (arbitrary partial) and ambiguous matches (two segments share
 * the value) both return null and keep the historical unlinked carve — a
 * guessed link would misstate what the customer is paying for. Riders are not
 * fixtures, so a rider-sized amount never matches.
 */
export function exactSingleSegmentMatchForAmount(
  fixtures: SegmentFixtureLine[],
  coverage: JobDollarCoverage | null | undefined,
  amountCents: number,
): { fixtureId: string; label: string } | null {
  if (!Number.isFinite(amountCents) || !(amountCents > 0)) return null
  let match: { fixtureId: string; label: string } | null = null
  for (const f of fixtures) {
    if (f.invoice_id != null) continue
    const d = lineDollars(f)
    if (!(d > 0)) continue
    const segCents = Math.round(d * 100)
    const coveredCents = Math.min(
      segCents,
      Math.round((coverage?.bySegmentKey[f.id]?.coveredDollars ?? 0) * 100),
    )
    const netCents = segCents - coveredCents
    if (netCents <= 0 || netCents !== amountCents) continue
    if (match) return null
    match = { fixtureId: f.id, label: (f.name ?? '').trim() }
  }
  return match
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
