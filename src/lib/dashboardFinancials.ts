/**
 * Dashboard "Financials" one-pager: Accounts Receivable, Accounts Payable, and Not billed out.
 * Pure shaping — the hook fetches rows; every formula mirrors the owning feature's kernel so the
 * cards can never disagree with Jobs Stages (unallocated), Supply Houses (unpaid), or the Payroll
 * ledger (open balances):
 *
 * - AR   = per billed invoice: max(0, amount − payments applied to it) [write-downs already
 *          reduce invoice.amount], plus billed jobs with no billed invoice rows:
 *          max(0, revenue − payments_made). Mirrors useBilledTotal.
 * - AP   = unpaid supply-house invoices + open payroll balances
 *          (stubNetPay(gross, less, additional) − payments). Mirrors the Payroll ledger summary.
 * - Not billed = working / ready_to_bill jobs: max(0, (revenue − payments_made) − Σ billed
 *          invoice amounts). Ready-to-Bill draft lines are NOT subtracted — they aren't on a
 *          customer invoice yet. Mirrors the Stages gross/alloc basis (jobsStagesBoard.ts).
 */

export type FinancialItem = {
  key: string
  label: string
  sublabel: string | null
  amount: number
  /** YYYY-MM-DD used for the "oldest" hint; null when the source has no meaningful date. */
  dateYmd: string | null
  /** jobs_ledger id for AR / Not-billed rows — powers click-to-open-job; null for AP rows. */
  jobId: string | null
  /** Job street address — shown on Not-billed rows; null elsewhere. */
  address: string | null
}

export type FinancialBucket = {
  total: number
  count: number
  oldestDateYmd: string | null
  /** Sorted by amount desc. */
  items: FinancialItem[]
}

export type FinancialJobRow = {
  id: string
  hcp_number: string | null
  click_number?: string | null
  job_name: string | null
  job_address?: string | null
  status: string | null
  revenue: number | null
  payments_made: number | null
  last_bill_date: string | null
  last_work_date: string | null
}

export type FinancialInvoiceRow = {
  id: string
  job_id: string
  amount: number | null
  status: string | null
  billed_at: string | null
}

export type FinancialInvoicePaymentRow = { invoice_id: string | null; amount: number | null }

export type FinancialSupplyInvoiceRow = {
  id: string
  amount: number | null
  invoice_date: string | null
  supply_houses: { name: string | null } | null
}

export type FinancialPayrollStubRow = {
  id: string
  person_name: string
  period_start: string
  period_end: string
  /** Net pay (gross − deductions + additional lines), computed by the hook via stubNetPay. */
  netPay: number
  paidSum: number
}

const EPSILON = 0.005

function isoToYmd(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  return `${y}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function financialJobLabel(job: Pick<FinancialJobRow, 'hcp_number' | 'click_number' | 'job_name'>): string {
  const num = (job.hcp_number ?? '').trim() || (job.click_number ?? '').trim()
  const name = (job.job_name ?? '').trim()
  if (num && name) return `${num} · ${name}`
  return num || name || '—'
}

function finishBucket(items: FinancialItem[]): FinancialBucket {
  const sorted = [...items].sort((a, b) => b.amount - a.amount)
  let oldest: string | null = null
  for (const i of sorted) {
    if (i.dateYmd && (oldest === null || i.dateYmd < oldest)) oldest = i.dateYmd
  }
  return {
    total: sorted.reduce((s, i) => s + i.amount, 0),
    count: sorted.length,
    oldestDateYmd: oldest,
    items: sorted,
  }
}

/** AR: open remainders on billed invoices + billed jobs without billed invoice rows. */
export function buildArBucket(
  jobs: FinancialJobRow[],
  invoices: FinancialInvoiceRow[],
  invoicePayments: FinancialInvoicePaymentRow[],
): FinancialBucket {
  const jobsById = new Map(jobs.map((j) => [j.id, j]))
  const appliedByInvoice = new Map<string, number>()
  for (const p of invoicePayments) {
    if (!p.invoice_id) continue
    appliedByInvoice.set(p.invoice_id, (appliedByInvoice.get(p.invoice_id) ?? 0) + Number(p.amount ?? 0))
  }
  const billedInvoices = invoices.filter((i) => i.status === 'billed')
  const jobIdsWithBilledInvoice = new Set(billedInvoices.map((i) => i.job_id))
  const items: FinancialItem[] = []
  for (const inv of billedInvoices) {
    const remaining = Math.max(0, Number(inv.amount ?? 0) - (appliedByInvoice.get(inv.id) ?? 0))
    if (remaining <= EPSILON) continue
    const job = jobsById.get(inv.job_id)
    items.push({
      key: `inv:${inv.id}`,
      label: job ? financialJobLabel(job) : 'Unknown job',
      sublabel: 'Billed invoice',
      amount: remaining,
      dateYmd: isoToYmd(inv.billed_at),
      jobId: inv.job_id,
      address: null,
    })
  }
  for (const job of jobs) {
    if ((job.status ?? '') !== 'billed') continue
    if (jobIdsWithBilledInvoice.has(job.id)) continue
    const remaining = Math.max(0, Number(job.revenue ?? 0) - Number(job.payments_made ?? 0))
    if (remaining <= EPSILON) continue
    items.push({
      key: `job:${job.id}`,
      label: financialJobLabel(job),
      sublabel: 'Billed job (no invoice rows)',
      amount: remaining,
      dateYmd: job.last_bill_date,
      jobId: job.id,
      address: null,
    })
  }
  return finishBucket(items)
}

/** AP: unpaid supply-house invoices + open payroll balances. */
export function buildApBucket(
  supplyInvoices: FinancialSupplyInvoiceRow[],
  payrollStubs: FinancialPayrollStubRow[],
): FinancialBucket & { supplyTotal: number; payrollTotal: number } {
  const items: FinancialItem[] = []
  let supplyTotal = 0
  for (const inv of supplyInvoices) {
    const amount = Number(inv.amount ?? 0)
    if (amount <= EPSILON) continue
    supplyTotal += amount
    items.push({
      key: `supply:${inv.id}`,
      label: (inv.supply_houses?.name ?? '').trim() || 'Supply house',
      sublabel: 'Supply invoice',
      amount,
      dateYmd: inv.invoice_date,
      jobId: null,
      address: null,
    })
  }
  let payrollTotal = 0
  for (const stub of payrollStubs) {
    const remaining = Math.max(0, stub.netPay - stub.paidSum)
    if (remaining <= EPSILON) continue
    payrollTotal += remaining
    items.push({
      key: `stub:${stub.id}`,
      label: stub.person_name,
      sublabel: `Payroll ${stub.period_start} – ${stub.period_end}`,
      amount: remaining,
      dateYmd: stub.period_end,
      jobId: null,
      address: null,
    })
  }
  return { ...finishBucket(items), supplyTotal, payrollTotal }
}

/** Not billed out: working / ready_to_bill jobs' revenue not yet on a billed customer invoice. */
export function buildUnbilledBucket(jobs: FinancialJobRow[], invoices: FinancialInvoiceRow[]): FinancialBucket {
  const billedAmountByJob = new Map<string, number>()
  for (const inv of invoices) {
    if (inv.status !== 'billed') continue
    billedAmountByJob.set(inv.job_id, (billedAmountByJob.get(inv.job_id) ?? 0) + Number(inv.amount ?? 0))
  }
  const items: FinancialItem[] = []
  for (const job of jobs) {
    const status = job.status ?? ''
    if (status !== 'working' && status !== 'ready_to_bill') continue
    const gross = Math.max(0, Number(job.revenue ?? 0) - Number(job.payments_made ?? 0))
    const unbilled = Math.max(0, gross - (billedAmountByJob.get(job.id) ?? 0))
    if (unbilled <= EPSILON) continue
    items.push({
      key: `job:${job.id}`,
      label: financialJobLabel(job),
      sublabel: status === 'ready_to_bill' ? 'Ready to Bill' : 'Working',
      amount: unbilled,
      dateYmd: job.last_work_date,
      jobId: job.id,
      address: (job.job_address ?? '').trim() || null,
    })
  }
  return finishBucket(items)
}
