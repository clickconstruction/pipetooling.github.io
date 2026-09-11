/**
 * Split by line (v2.3349): on a job whose "Bills go to" is `split`, each
 * work line item carries who pays it, and the Bill tab carves one draft
 * invoice per payer from the rows no invoice has claimed yet. Pure planning
 * — the shell runs the carves through the same segment-invoice path a
 * hand-picked selection uses (`createInvoiceFromSegmentIds`), then stamps
 * each draft's `bill_to_party`.
 */
import type { InvoiceBillToParty } from './billToParty'
import { segmentSelectionNetSummary, type JobDollarCoverage, type SegmentFixtureLine } from './jobSegmentsCoverage'

export type PayerTaggedLine = SegmentFixtureLine & { bill_to_party?: 'customer' | 'gc' | null }

export type PayerCarve = {
  party: InvoiceBillToParty
  /** Fixture ids in the group (unbilled, dollar-bearing work rows). */
  fixtureIds: string[]
  count: number
  /** What the draft would bill — net of dollar coverage, like any segment invoice. */
  netDollars: number
}

/** The tag a line carries on a split job; untagged rows bill the customer. */
export function linePayer(line: { bill_to_party?: string | null; line_kind?: string | null }): InvoiceBillToParty {
  if (line.line_kind === 'discount') return 'customer'
  return line.bill_to_party === 'gc' ? 'gc' : 'customer'
}

/**
 * One carve per party with at least one unbilled, dollar-bearing row — the
 * GC's first when both exist (the bigger bill usually), then the customer's.
 * A party whose rows are already fully covered by payments produces no carve.
 */
export function planPayerCarves(
  fixtures: readonly PayerTaggedLine[],
  coverage: JobDollarCoverage | null | undefined,
): PayerCarve[] {
  const groups: Record<InvoiceBillToParty, string[]> = { gc: [], customer: [] }
  for (const f of fixtures) {
    if (f.invoice_id != null) continue
    if (f.line_kind === 'discount') continue
    groups[linePayer(f)].push(f.id)
  }
  const out: PayerCarve[] = []
  for (const party of ['gc', 'customer'] as const) {
    const ids = groups[party]
    if (ids.length === 0) continue
    const summary = segmentSelectionNetSummary([...fixtures], new Set(ids), coverage)
    if (summary.count === 0 || !(summary.netDollars > 0)) continue
    out.push({ party, fixtureIds: ids, count: summary.count, netDollars: summary.netDollars })
  }
  return out
}

/** Row counts per party for the Bill tab's "Split by line" strip — every work row, billed or not. */
export function payerTagCounts(fixtures: readonly PayerTaggedLine[]): { gc: number; customer: number; untagged: number } {
  let gc = 0
  let customer = 0
  let untagged = 0
  for (const f of fixtures) {
    if (f.line_kind === 'discount') continue
    if (!(f.name ?? '').trim()) continue
    if (f.bill_to_party === 'gc') gc += 1
    else if (f.bill_to_party === 'customer') customer += 1
    else untagged += 1
  }
  return { gc, customer, untagged }
}
