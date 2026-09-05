/**
 * "Who owes what" breakdown behind the Pipeline money card's WAITING ON
 * CUSTOMERS card (v2.1929): the Billed Awaiting Payment rows regrouped by
 * customer so the card's total answers its own question. Pure reshaping of
 * the board's `billedActiveRows` — amounts are the same per-row open
 * remainders the section total sums (the bill-truth kernel's clamp), ages use
 * the same clock as the 30/90 aging chips (`stageRowBilledAgeReference`:
 * hand-set est. bill date, else the billed date; rows with neither can't age —
 * `ageDays` null). Every row is kept, including a fully-paid bill never marked
 * Paid (`settled`, $0, never aged) — so the bill count here equals the strip's
 * (journey J4-1 (b): Quickfill used to say 58 where the board said 59).
 */
import type { StageRow } from '../jobsStagesBoard'
import { stageRowBilledAgeDays, stageRowBilledAgeReference, stageRowBilledRemainingAmount } from './invoiceBilling'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { fixturesForInvoiceBill } from '../invoiceScopedFixtures'
import { arLineItemFromFixture, type ArLineItem } from '../arModalLineItems'
import { isSettledRemainder } from '../billing/billTruth'

export type BilledBreakdownBill = {
  /** Jump handle: focus this invoice row when set, else focus the job shell row. */
  invoiceId: string | null
  jobId: string
  jobName: string
  jobNumber: string
  /** Job site address (`jobs_ledger.job_address`; may be blank). */
  jobAddress: string
  /** Open remainder on this row (what the section total sums). */
  amount: number
  /** Fully paid but still `billed` — needs Mark Paid, owes nothing, never ages. */
  settled: boolean
  /** Days since the bill's reference date — the aging chips' clock; null = no date (can't age). */
  ageDays: number | null
  /** True when the age counts from a hand-set est. bill date rather than the billed date. */
  ageHandSet: boolean
  /**
   * Billable fixture lines this bill genuinely covers: the invoice's linked
   * segments, or the primary bundle's exact-sum unlinked segments
   * (`fixturesForInvoiceBill`), or every line for a job-shell row. Empty for
   * an invoice on the whole-job-proration fallback — listing the whole job's
   * lines at real prices under a partial bill would oversell what this bill
   * asks for.
   */
  lineItems: ArLineItem[]
  /** Job's customer id (`jobs_ledger.customer_id`) — chase-touch target; null when the job has none linked. */
  customerId: string | null
  /** Job's customer email — the resend confirm shows who receives it. */
  customerEmail: string | null
  /** Stripe invoice behind this bill, when it was billed through Stripe. */
  stripeInvoiceId: string | null
  /** Stripe reports the invoice paid — a resend would only confuse. */
  stripePaid: boolean
  /** When the bill's email went out (`sent_to_customer_at`) — the card's evidence line. */
  sentAtIso: string | null
  /** Non-Stripe billing channel (`external_send_channel`): 'physical' | 'housecallpro' | null. */
  externalSendChannel: string | null
  /** The invoice's bill-to email override (alternate recipient), when set. */
  billToEmail: string | null
}

/** Board fixtures arrive sequence-sorted (enrichJobsLedgerPrimaryRows); scoping preserves that order. */
function billLineItems(row: StageRow): ArLineItem[] {
  const fixtures = row.job.fixtures ?? []
  let scoped = fixtures
  if (row.kind !== 'job') {
    const inv = row.inv
    scoped = fixturesForInvoiceBill(fixtures, inv.id, inv)
    // fixturesForInvoiceBill falls back to ALL lines when none belong to this
    // invoice (the bill itself prorates them); here that reads as the bill
    // covering the whole job — show no lines instead.
    if (scoped.length > 0 && !scoped.some((f) => (f.invoice_id ?? null) === inv.id)) {
      const exactSumBundle = inv.is_primary_rtb_bundle === true && scoped.every((f) => (f.invoice_id ?? null) === null)
      if (!exactSumBundle) return []
    }
  }
  const out: ArLineItem[] = []
  for (const f of scoped) {
    const item = arLineItemFromFixture(f)
    if (item) out.push(item)
  }
  return out
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
    const settled = isSettledRemainder(amount)
    const job = row.job
    const name = (job.customer_name ?? '').trim() || 'No customer'
    const key = (job.customer_id ?? '').trim() || `name:${name.toLowerCase()}`
    const inv = row.kind === 'job' ? null : row.inv
    const bill: BilledBreakdownBill = {
      invoiceId: inv?.id ?? null,
      jobId: job.id,
      jobName: (job.job_name ?? '').trim() || '—',
      jobNumber: effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—',
      jobAddress: (job.job_address ?? '').trim(),
      amount,
      settled,
      lineItems: billLineItems(row),
      ageDays: settled ? null : stageRowBilledAgeDays(row, now),
      ageHandSet: settled ? false : (stageRowBilledAgeReference(row)?.handSet ?? false),
      customerId: (job.customer_id ?? '').trim() || null,
      customerEmail: (job.customer_email ?? '').trim() || null,
      stripeInvoiceId: (inv?.stripe_invoice_id ?? '').trim() || null,
      stripePaid: inv?.stripe_invoice_status === 'paid',
      sentAtIso: inv?.sent_to_customer_at ?? null,
      externalSendChannel: (inv?.external_send_channel ?? '').trim() || null,
      billToEmail: (inv?.bill_to_email ?? '').trim() || null,
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
