/**
 * Customer profile modal — derived stats kernel (v2.1322).
 *
 * Pure math over a customer's jobs/invoices/payments for the three money
 * cells and the aging chip:
 *  - open balance: billed-invoice remainders + billed job-shells (the board's
 *    remaining semantics), INCLUDING Collections jobs — flagged money is
 *    still owed to this customer's ledger;
 *  - aging buckets: estimated_bill_date rule at 30/90 days with remaining > 0
 *    (keep in sync with billedStageRowAgingBucket in lib/jobs/invoiceBilling —
 *    same rule, restated here over lean structural inputs);
 *  - lifetime collected: every payment row on their jobs;
 *  - "pays in ~N days": MEDIAN gap between an invoice's billed_at and its
 *    invoice-linked payments' paid_on, last 12 months (job-level payments
 *    excluded — no bill date to measure from).
 */

export type ProfileInvoice = {
  id: string
  status: string
  amount: number | null
  billed_at: string | null
  estimated_bill_date: string | null
}

export type ProfilePayment = {
  invoice_id: string | null
  amount: number | null
  paid_on: string | null
}

export type ProfileJob = {
  id: string
  status: string | null
  revenue: number | null
  payments_made: number | null
  invoices: ProfileInvoice[]
  payments: ProfilePayment[]
}

export type CustomerAging = { count30_90: number; sum30_90: number; count90: number; sum90: number }

export type CustomerMoneyStats = {
  openBalance: number
  aging: CustomerAging
  lifetimeCollected: number
  jobCount: number
}

function daysBetweenYmdUtc(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T12:00:00Z`).getTime()
  const b = new Date(`${toYmd}T12:00:00Z`).getTime()
  return Math.round((b - a) / 86_400_000)
}

/** timestamptz/date → YYYY-MM-DD (UTC slice — consistent with the board's date handling). */
function ymdOf(iso: string): string {
  return iso.slice(0, 10)
}

export function customerMoneyStats(jobs: ProfileJob[], todayYmd: string): CustomerMoneyStats {
  let open = 0
  let lifetime = 0
  const aging: CustomerAging = { count30_90: 0, sum30_90: 0, count90: 0, sum90: 0 }
  for (const job of jobs) {
    const appliedByInvoice = new Map<string, number>()
    for (const p of job.payments) {
      const amt = Number(p.amount ?? 0)
      lifetime += amt
      if (p.invoice_id) appliedByInvoice.set(p.invoice_id, (appliedByInvoice.get(p.invoice_id) ?? 0) + amt)
    }
    const status = (job.status ?? 'working') as string
    if (status === 'paid') continue
    const billed = job.invoices.filter((i) => i.status === 'billed')
    if (billed.length === 0) {
      if (status === 'billed') open += Number(job.revenue ?? 0) - Number(job.payments_made ?? 0)
      continue
    }
    for (const inv of billed) {
      const remaining = Math.max(0, Number(inv.amount ?? 0) - (appliedByInvoice.get(inv.id) ?? 0))
      open += remaining
      if (remaining <= 0 || !inv.estimated_bill_date) continue
      const days = daysBetweenYmdUtc(ymdOf(inv.estimated_bill_date), todayYmd)
      if (days >= 90) {
        aging.count90 += 1
        aging.sum90 += remaining
      } else if (days >= 30) {
        aging.count30_90 += 1
        aging.sum30_90 += remaining
      }
    }
  }
  return { openBalance: open, aging, lifetimeCollected: lifetime, jobCount: jobs.length }
}

export type DaysToPay = { medianDays: number; samples: number } | null

/**
 * Median billed_at → paid_on gap across invoice-linked payments in the last
 * 12 months (by paid_on). Null when there are no measurable samples. Negative
 * gaps (payment recorded before the bill date) are clamped to 0.
 */
export function customerDaysToPay(jobs: ProfileJob[], todayYmd: string): DaysToPay {
  const cutoffYmd = `${Number(todayYmd.slice(0, 4)) - 1}${todayYmd.slice(4)}`
  const gaps: number[] = []
  for (const job of jobs) {
    const billedAtByInvoice = new Map<string, string>()
    for (const inv of job.invoices) {
      if (inv.billed_at) billedAtByInvoice.set(inv.id, ymdOf(inv.billed_at))
    }
    for (const p of job.payments) {
      if (!p.invoice_id || !p.paid_on) continue
      const billedYmd = billedAtByInvoice.get(p.invoice_id)
      if (!billedYmd) continue
      const paidYmd = ymdOf(p.paid_on)
      if (paidYmd < cutoffYmd) continue
      gaps.push(Math.max(0, daysBetweenYmdUtc(billedYmd, paidYmd)))
    }
  }
  if (gaps.length === 0) return null
  gaps.sort((a, b) => a - b)
  const mid = Math.floor(gaps.length / 2)
  const median = gaps.length % 2 === 1 ? gaps[mid]! : Math.round((gaps[mid - 1]! + gaps[mid]!) / 2)
  return { medianDays: median, samples: gaps.length }
}
