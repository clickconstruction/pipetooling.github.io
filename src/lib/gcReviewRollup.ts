import type { StageRow } from './jobsStagesBoard'
import { printBilledRowReferenceDate, stageRowBilledRemainingAmount } from './jobs/invoiceBilling'
import { effectiveJobLedgerNumber } from './ledgerDisplayPrefixes'

/**
 * GC Review (v2.1181): group the Billed Awaiting Payment board rows by the
 * job's GC (jobs_ledger.gc_customer_id, v2.1175) so office can see each
 * General Contractor's outstanding balance and how long ago their customers
 * were billed out. Pure — consumes the same StageRows the section renders, so
 * the modal's grand total reconciles with the section header by construction.
 *
 * `groupBy: 'development'` reuses the whole rollup for the job's development
 * (jobs_ledger.development_id) — the Gc-named fields then hold the
 * development's id/name and the bucket reads "No development set".
 *
 * Dates use printBilledRowReferenceDate — the ACTUAL billed date with an
 * "(est.)" fallback — matching the existing Billed print report, NOT the
 * header aging chips (which run on est. bill date only).
 */

export type GcReviewGroupBy = 'gc' | 'development'

export type GcReviewRow = {
  /** Stable row key: jobId for shells/merged rows, invoice id for invoice rows. */
  key: string
  jobId: string
  /** Effective job number (HCP else Click), '—' when neither. */
  hcp: string
  jobName: string
  customerName: string
  referenceDateDisplay: string
  ageDays: number | null
  remaining: number
  inCollections: boolean
}

export type GcReviewGroup = {
  /** Grouping-entity id (gc customer / development), or the no-entity sentinel. */
  key: string
  /** The grouping entity's id/name — the GC by default, the development under groupBy: 'development'. */
  gcId: string | null
  gcName: string
  isNoGc: boolean
  rows: GcReviewRow[]
  subtotal: number
  /** Distinct jobs in the group (a job can contribute several invoice rows). */
  jobCount: number
  oldestAgeDays: number | null
}

export type GcReviewRollup = {
  /** GC groups by subtotal descending; the No-GC bucket is always last. */
  groups: GcReviewGroup[]
  grandTotal: number
  /** Collections stats regardless of the toggle, for the checkbox label. */
  collectionsCount: number
  collectionsTotal: number
}

function toReviewRow(r: StageRow, inCollections: boolean, now: Date): GcReviewRow {
  const ref = printBilledRowReferenceDate(r, now)
  return {
    key: r.kind === 'invoice' ? r.inv.id : r.job.id,
    jobId: r.job.id,
    hcp: effectiveJobLedgerNumber(r.job.hcp_number, r.job.click_number) || '—',
    jobName: (r.job.job_name ?? '').trim(),
    customerName: (r.job.customer_name ?? '').trim() || '—',
    referenceDateDisplay: ref.display,
    ageDays: ref.ageDays,
    remaining: stageRowBilledRemainingAmount(r),
    inCollections,
  }
}

/** Oldest first (unknown dates last), then largest remaining. */
function sortReviewRows(rows: GcReviewRow[]): GcReviewRow[] {
  return [...rows].sort((a, b) => {
    if (a.ageDays != null && b.ageDays != null && a.ageDays !== b.ageDays) return b.ageDays - a.ageDays
    if (a.ageDays != null && b.ageDays == null) return -1
    if (a.ageDays == null && b.ageDays != null) return 1
    return b.remaining - a.remaining
  })
}

export const GC_REVIEW_NO_GC_KEY = 'no-gc'
export const GC_REVIEW_NO_DEVELOPMENT_KEY = 'no-development'

export function buildGcReviewRollup(
  billedActiveRows: StageRow[],
  collectionsRows: StageRow[],
  opts?: { includeCollections?: boolean; now?: Date; groupBy?: GcReviewGroupBy },
): GcReviewRollup {
  const now = opts?.now ?? new Date()
  const includeCollections = opts?.includeCollections === true
  const byDevelopment = opts?.groupBy === 'development'
  const noEntityKey = byDevelopment ? GC_REVIEW_NO_DEVELOPMENT_KEY : GC_REVIEW_NO_GC_KEY
  const noEntityLabel = byDevelopment ? 'No development set' : 'No GC set'

  let collectionsCount = 0
  let collectionsTotal = 0
  for (const r of collectionsRows) {
    collectionsCount++
    collectionsTotal += stageRowBilledRemainingAmount(r)
  }

  const sourceRows: Array<{ row: StageRow; inCollections: boolean }> = [
    ...billedActiveRows.map((row) => ({ row, inCollections: false })),
    ...(includeCollections ? collectionsRows.map((row) => ({ row, inCollections: true })) : []),
  ]

  const byKey = new Map<string, GcReviewGroup>()
  for (const { row, inCollections } of sourceRows) {
    const gc = (byDevelopment ? row.job.development : row.job.gcCustomer) ?? null
    const gcName = (gc?.name ?? '').trim()
    const key = gc?.id ?? noEntityKey
    let group = byKey.get(key)
    if (!group) {
      group = {
        key,
        gcId: gc?.id ?? null,
        gcName: gc ? gcName || '—' : noEntityLabel,
        isNoGc: gc == null,
        rows: [],
        subtotal: 0,
        jobCount: 0,
        oldestAgeDays: null,
      }
      byKey.set(key, group)
    }
    const reviewRow = toReviewRow(row, inCollections, now)
    group.rows.push(reviewRow)
    group.subtotal += reviewRow.remaining
    if (reviewRow.ageDays != null && (group.oldestAgeDays == null || reviewRow.ageDays > group.oldestAgeDays)) {
      group.oldestAgeDays = reviewRow.ageDays
    }
  }

  const groups = [...byKey.values()]
  for (const g of groups) {
    g.rows = sortReviewRows(g.rows)
    g.jobCount = new Set(g.rows.map((r) => r.jobId)).size
  }
  groups.sort((a, b) => {
    if (a.isNoGc !== b.isNoGc) return a.isNoGc ? 1 : -1
    if (b.subtotal !== a.subtotal) return b.subtotal - a.subtotal
    return a.gcName.localeCompare(b.gcName)
  })

  const grandTotal = groups.reduce((s, g) => s + g.subtotal, 0)
  return { groups, grandTotal, collectionsCount, collectionsTotal }
}
