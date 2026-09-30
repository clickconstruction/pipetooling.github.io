import type { StageRow } from './jobsStagesBoard'
import { billedRowReferenceYmd, printBilledRowReferenceDate, stageRowBilledRemainingAmount } from './jobs/invoiceBilling'
import { effectiveJobLedgerNumber } from './ledgerDisplayPrefixes'
import { effectiveInvoiceParty } from './jobs/billToParty'
import { billPaidByWords } from './jobs/gcChecksApplied'

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
  /** Job street address — the lead column on GC-facing statements (v2.1414). */
  jobAddress: string
  customerName: string
  referenceDateDisplay: string
  ageDays: number | null
  remaining: number
  inCollections: boolean
  /** The line under the bill (v2.4044): what paid it and when, what is still open — or "nothing applied yet". */
  paidBy?: string
  /**
   * What the statement by property reads (v2.4255) — absent on a hand-built row,
   * and the statement then groups by address and words no payment.
   */
  /** The job's property record (`jobs_ledger.customer_address_id`). */
  propertyId?: string | null
  /** The day the bill went out (YYYY-MM-DD), and whether that is the estimated bill date. */
  referenceYmd?: string | null
  referenceIsEstimate?: boolean
  /** The bill's amount; null for a job balance with no bill behind it. */
  billed?: number | null
  /** Payments recorded against this bill; for a job balance, every payment on the job. */
  billPayments?: GcReviewRowPayment[]
  retainageHeld?: number | null
  /** Money on the job that no bill carries — the statement cannot count it toward this bill. 0 for a job balance. */
  unmatchedOnJob?: number
}

export type GcReviewRowPayment = {
  invoice_id: string | null
  amount: number | string | null
  paid_on: string | null
  payment_type: string | null
  reference_number: string | null
  sequence_order: number | null
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

/** A review row's key for its board row — how a statement row finds its bill again (the unpaid-invoices print). */
export function gcReviewRowKey(r: StageRow): string {
  return r.kind === 'invoice' ? r.inv.id : r.job.id
}

function toReviewRow(r: StageRow, inCollections: boolean, now: Date): GcReviewRow {
  const ref = printBilledRowReferenceDate(r, now)
  const refYmd = billedRowReferenceYmd(r)
  const invoiceId = r.kind === 'job' ? null : r.inv.id
  const jobPayments = r.job.payments ?? []
  const billPayments: GcReviewRowPayment[] = jobPayments
    .filter((p) => invoiceId == null || p.invoice_id === invoiceId)
    .map((p) => ({
      invoice_id: p.invoice_id ?? null,
      amount: p.amount,
      paid_on: p.paid_on ?? null,
      payment_type: p.payment_type ?? null,
      reference_number: p.reference_number ?? null,
      sequence_order: p.sequence_order ?? null,
    }))
  return {
    key: gcReviewRowKey(r),
    jobId: r.job.id,
    hcp: effectiveJobLedgerNumber(r.job.hcp_number, r.job.click_number) || '—',
    jobName: (r.job.job_name ?? '').trim(),
    jobAddress: (r.job.job_address ?? '').trim(),
    customerName: (r.job.customer_name ?? '').trim() || '—',
    referenceDateDisplay: ref.display,
    ageDays: ref.ageDays,
    remaining: stageRowBilledRemainingAmount(r),
    inCollections,
    paidBy: billPaidByWords(r.job, r.kind === 'job' ? null : r.inv),
    propertyId: r.job.customer_address_id ?? null,
    referenceYmd: refYmd?.ymd ?? null,
    referenceIsEstimate: refYmd?.isEstimate ?? false,
    billed: r.kind === 'job' ? null : Number(r.inv.amount ?? 0),
    billPayments,
    retainageHeld: r.job.lien_retainage_held == null ? null : Number(r.job.lien_retainage_held),
    unmatchedOnJob: invoiceId == null ? 0 : jobPayments.filter((p) => !p.invoice_id).reduce((s, p) => s + Number(p.amount ?? 0), 0),
  }
}

/**
 * Address A→Z (v2.1434 — rows for the same street/site sit together on the
 * statement), blank addresses last, then oldest-first / largest-remaining as
 * the tiebreak inside one address.
 */
function sortReviewRows(rows: GcReviewRow[]): GcReviewRow[] {
  return [...rows].sort((a, b) => {
    const aa = a.jobAddress.trim().toLowerCase()
    const ba = b.jobAddress.trim().toLowerCase()
    if (aa !== ba) {
      if (aa === '') return 1
      if (ba === '') return -1
      return aa.localeCompare(ba)
    }
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
  // Who pays (v2.3346): the bucket holds jobs with no GC AND jobs whose GC is not the payer.
  const noEntityLabel = byDevelopment ? 'No development set' : 'Not billed to a GC'

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
    const gc = (byDevelopment ? row.job.development : gcThatPaysRow(row)) ?? null
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

/**
 * Who pays (v2.3346): the GC this row files under — only when the GC pays it.
 * The invoice's own pick, else the job's rule, never a typed someone-else
 * recipient; a GC entered as the job customer pays by definition (the 72
 * jobs recorded that way). Mirrors the CASE in get_gc_statement_email_payload.
 */
export function gcThatPaysRow(row: StageRow): { id: string; name: string | null } | null {
  const gc = row.job.gcCustomer ?? null
  if (!gc) return null
  const gcId = row.job.gc_customer_id ?? gc.id
  if (gcId === row.job.customer_id) return gc
  const inv = row.kind === 'job' ? null : row.inv
  return effectiveInvoiceParty({ ...row.job, gc_customer_id: gcId }, inv) === 'gc' ? gc : null
}
