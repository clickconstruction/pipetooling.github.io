/**
 * HCP payment backfill (money-rail follow-up): jobs imported from HouseCall
 * Pro were stamped Paid without payment rows, so "collected" reads $0 for
 * them. This kernel plans one synthetic payment per such job — amount is the
 * app's own revenue (the billed figure the rail compares against), the date
 * comes from the HCP jobs export with a fallback chain:
 * paid-in-full date → HCP completed date → HCP created date → the ledger
 * row's created date. Pure — parsed CSV cells and flat job rows in, a
 * reviewable plan out; nothing writes here.
 */

export type BackfillJobInput = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  customer_name: string | null
  status: string | null
  revenue: number | null
  created_at: string | null
}

export type HcpExportRow = {
  /** Normalized job number (leading zeros and Excel `="…"` quoting stripped). */
  hcpNumber: string
  paidOn: string | null
  completedOn: string | null
  createdOn: string | null
  paidAmount: number
  /** HCP "Job amount" — the invoice total INCLUDING any tip (0 when the column is absent). */
  jobAmount: number
  /** HCP "Tip amount" (0 when the column is absent). */
  tipAmount: number
}

export type BackfillDateSource = 'hcp_paid' | 'hcp_completed' | 'hcp_created' | 'ledger_created'

export type BackfillPlanRow = {
  jobId: string
  /** Display number — HCP wins over Click, matching effectiveJobLedgerNumber. */
  label: string
  jobName: string
  customerName: string
  amount: number
  paidOn: string
  dateSource: BackfillDateSource
  /** What HCP recorded as collected, for the note / mismatch flag (null = not in export). */
  hcpPaid: number | null
}

/** Strip Excel `="…"` quoting, whitespace, and leading zeros: `="010"` → `10`. */
export function normalizeHcpNumber(raw: string | null | undefined): string {
  const cleaned = (raw ?? '').replace(/^="?/, '').replace(/"$/, '').trim()
  const unpadded = cleaned.replace(/^0+/, '')
  return unpadded
}

const ISO_DATE = /^(\d{4}-\d{2}-\d{2})/

function isoDate(cell: string | undefined): string | null {
  const m = ISO_DATE.exec((cell ?? '').trim())
  return m ? m[1]! : null
}

function money(cell: string | undefined): number {
  const n = Number((cell ?? '').replace(/[$,]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/**
 * Extract the columns we need from a parsed HCP jobs export (header row +
 * data rows, as returned by parseCsv). Unknown/missing headers make the
 * export unusable — return null so the UI can say which file to pick.
 */
export function parseHcpJobsExport(rows: string[][]): HcpExportRow[] | null {
  const header = rows[0]
  if (!header) return null
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name)
  const jobCol = col('job #')
  const paidDateCol = col('job paid in full date')
  const completedCol = col('job completed date')
  const createdCol = col('job created date')
  const paidAmtCol = col('paid amount')
  const jobAmtCol = col('job amount')
  const tipAmtCol = col('tip amount')
  if (jobCol === -1 || paidDateCol === -1 || createdCol === -1) return null

  const out: HcpExportRow[] = []
  const seen = new Map<string, number>()
  for (const row of rows.slice(1)) {
    const n = normalizeHcpNumber(row[jobCol])
    if (!n || !/^\d+$/.test(n)) continue
    const parsed: HcpExportRow = {
      hcpNumber: n,
      paidOn: isoDate(row[paidDateCol]),
      completedOn: completedCol === -1 ? null : isoDate(row[completedCol]),
      createdOn: isoDate(row[createdCol]),
      paidAmount: paidAmtCol === -1 ? 0 : money(row[paidAmtCol]),
      jobAmount: jobAmtCol === -1 ? 0 : money(row[jobAmtCol]),
      tipAmount: tipAmtCol === -1 ? 0 : money(row[tipAmtCol]),
    }
    const prev = seen.get(n)
    // Duplicate numbers: keep the row that actually has a paid date.
    if (prev != null && out[prev]!.paidOn != null && parsed.paidOn == null) continue
    if (prev != null) out[prev] = parsed
    else {
      seen.set(n, out.length)
      out.push(parsed)
    }
  }
  return out
}

/**
 * One synthetic payment per paid job with zero payment rows. Jobs already
 * carrying any payment row are untouched (partial or full), as are unpaid
 * jobs and $0 shells.
 */
export function planHcpPaymentBackfill(
  jobs: BackfillJobInput[],
  exportRows: HcpExportRow[],
  jobIdsWithPayments: Set<string>,
): BackfillPlanRow[] {
  const byNumber = new Map(exportRows.map((r) => [r.hcpNumber, r]))
  const plan: BackfillPlanRow[] = []
  for (const job of jobs) {
    if (job.status !== 'paid') continue
    const amount = Number(job.revenue ?? 0)
    if (amount <= 0) continue
    if (jobIdsWithPayments.has(job.id)) continue
    const hcp = byNumber.get(normalizeHcpNumber(job.hcp_number))
    let paidOn: string | null = null
    let dateSource: BackfillDateSource = 'ledger_created'
    if (hcp?.paidOn) {
      paidOn = hcp.paidOn
      dateSource = 'hcp_paid'
    } else if (hcp?.completedOn) {
      paidOn = hcp.completedOn
      dateSource = 'hcp_completed'
    } else if (hcp?.createdOn) {
      paidOn = hcp.createdOn
      dateSource = 'hcp_created'
    } else if (job.created_at) {
      paidOn = job.created_at.slice(0, 10)
    }
    if (!paidOn) continue
    const hcpLabel = (job.hcp_number ?? '').trim()
    const clickLabel = (job.click_number ?? '').trim()
    plan.push({
      jobId: job.id,
      label: hcpLabel || clickLabel || '—',
      jobName: (job.job_name ?? '').trim(),
      customerName: (job.customer_name ?? '').trim(),
      amount,
      paidOn,
      dateSource,
      hcpPaid: hcp ? hcp.paidAmount : null,
    })
  }
  plan.sort((a, b) => (a.paidOn < b.paidOn ? 1 : a.paidOn > b.paidOn ? -1 : 0))
  return plan
}

export function backfillPaymentNote(row: BackfillPlanRow): string {
  const src: Record<BackfillDateSource, string> = {
    hcp_paid: 'HCP paid-in-full date',
    hcp_completed: 'HCP completed date',
    hcp_created: 'HCP created date',
    ledger_created: 'job created date',
  }
  const hcpAmt =
    row.hcpPaid != null && Math.abs(row.hcpPaid - row.amount) > 0.005
      ? ` · HCP recorded $${row.hcpPaid.toFixed(2)}`
      : ''
  return `HCP payment backfill · date from ${src[row.dateSource]}${hcpAmt}`
}
