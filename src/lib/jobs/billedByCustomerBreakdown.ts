/**
 * "Who owes what" breakdown behind the Pipeline money card's WAITING ON
 * CUSTOMERS card (v2.1929): the Billed Awaiting Payment rows regrouped by
 * customer so the card's total answers its own question. Pure reshaping of
 * the board's `billedActiveRows` — amounts are the same per-row open
 * remainders the section total sums, ages use the same clock as the 30/90
 * aging chips (`stageRowBilledAgeReference`: hand-set est. bill date, else the
 * billed date; rows with neither can't age — `ageDays` null).
 */
import type { StageRow } from '../jobsStagesBoard'
import { stageRowBilledAgeDays, stageRowBilledAgeReference, stageRowBilledRemainingAmount } from './invoiceBilling'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'

export type BilledBreakdownBill = {
  /** Jump handle: focus this invoice row when set, else focus the job shell row. */
  invoiceId: string | null
  jobId: string
  jobName: string
  jobNumber: string
  /** Open remainder on this row (what the section total sums). */
  amount: number
  /** Days since the bill's reference date — the aging chips' clock; null = no date (can't age). */
  ageDays: number | null
  /** True when the age counts from a hand-set est. bill date rather than the billed date. */
  ageHandSet: boolean
}

export type BilledBreakdownCustomerGroup = {
  key: string
  customerName: string
  total: number
  count: number
  /** Oldest first; undated bills last. */
  bills: BilledBreakdownBill[]
  worstAgeDays: number | null
  /** Whether the bill behind `worstAgeDays` is aged by a hand-set date. */
  worstAgeHandSet: boolean
}

/** Groups sorted by total owed descending; ties broken oldest-first. */
export function buildBilledByCustomerBreakdown(
  billedActiveRows: readonly StageRow[],
  now = new Date(),
): BilledBreakdownCustomerGroup[] {
  const groups = new Map<string, BilledBreakdownCustomerGroup>()
  for (const row of billedActiveRows) {
    const amount = stageRowBilledRemainingAmount(row)
    if (amount <= 0) continue
    const job = row.job
    const name = (job.customer_name ?? '').trim() || 'No customer'
    const key = (job.customer_id ?? '').trim() || `name:${name.toLowerCase()}`
    const bill: BilledBreakdownBill = {
      invoiceId: row.kind === 'job' ? null : row.inv.id,
      jobId: job.id,
      jobName: (job.job_name ?? '').trim() || '—',
      jobNumber: effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—',
      amount,
      ageDays: stageRowBilledAgeDays(row, now),
      ageHandSet: stageRowBilledAgeReference(row)?.handSet ?? false,
    }
    const g = groups.get(key)
    if (g) {
      g.bills.push(bill)
      g.total += amount
      g.count += 1
      if (bill.ageDays != null && (g.worstAgeDays == null || bill.ageDays > g.worstAgeDays)) {
        g.worstAgeDays = bill.ageDays
        g.worstAgeHandSet = bill.ageHandSet
      }
    } else {
      groups.set(key, {
        key,
        customerName: name,
        total: amount,
        count: 1,
        bills: [bill],
        worstAgeDays: bill.ageDays,
        worstAgeHandSet: bill.ageDays != null && bill.ageHandSet,
      })
    }
  }
  const out = [...groups.values()]
  for (const g of out) {
    g.bills.sort((a, b) => {
      if (a.ageDays != null && b.ageDays != null && a.ageDays !== b.ageDays) return b.ageDays - a.ageDays
      if (a.ageDays != null && b.ageDays == null) return -1
      if (a.ageDays == null && b.ageDays != null) return 1
      return b.amount - a.amount
    })
  }
  out.sort((a, b) => {
    if (a.total !== b.total) return b.total - a.total
    return (b.worstAgeDays ?? -1) - (a.worstAgeDays ?? -1)
  })
  return out
}

export function billedBreakdownTotal(groups: readonly BilledBreakdownCustomerGroup[]): number {
  return groups.reduce((s, g) => s + g.total, 0)
}
