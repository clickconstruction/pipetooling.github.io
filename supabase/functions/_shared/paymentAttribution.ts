/**
 * Which bill does a payment pay? — the one rule every reader shares (v2.3592).
 *
 * `jobs_ledger_payments.invoice_id` is nullable, and most of the money on the
 * ledger is recorded on the job with no bill attached (191 payments, $2.32M on
 * 2026-09-16). Before this kernel two readers disagreed in opposite directions:
 * the invoice's payment history printed an unlinked payment on every open bill
 * of the job (job 273: three open bills, each subtracting the same $38,780, all
 * three reading nothing due), while the demand letter's claim counted none of
 * it on a multi-bill job. The owner's rule, 2026-09-18: **oldest bill first**.
 *
 * - A payment linked to a bill is that bill's, in full, whatever its amount.
 * - An unlinked payment is applied to the job's sent bills (billed or paid — a
 *   ready-to-bill draft was never in the customer's hands) oldest first, by
 *   `sequence_order` then `billed_at`, each bill taking no more than what it
 *   still needs after its own linked money; one payment may split across bills.
 * - Money left after every sent bill is covered is the job's `surplus` — shown
 *   as a job-level line, never smeared onto a bill (that is the double credit
 *   v2.3498 removed).
 *
 * Pure, no imports: used by the client (re-exported from
 * `src/lib/jobs/paymentAttribution.ts`, tested there) and by `customer-portal`.
 */

export type AttributionBill = {
  id: string
  amount: number | string | null | undefined
  status: string | null | undefined
  sequence_order?: number | null
  billed_at?: string | null
}

export type AttributionPayment = {
  invoice_id: string | null | undefined
  amount: number | string | null | undefined
  paid_on?: string | null
  sequence_order?: number | null
}

/** One payment's share of one bill; `partial` when the payment also pays another bill or leaves a surplus. */
export type PaymentSlice<P extends AttributionPayment = AttributionPayment> = {
  payment: P
  amount: number
  partial: boolean
}

export type BillAttribution<P extends AttributionPayment = AttributionPayment> = {
  /** Payments recorded against this bill, in full. */
  linked: number
  /** Unlinked money this bill absorbed under oldest-first. */
  unlinked: number
  /** linked + unlinked — what this bill has been paid. */
  applied: number
  slices: PaymentSlice<P>[]
}

export type JobPaymentAttribution<P extends AttributionPayment = AttributionPayment> = {
  byBill: Map<string, BillAttribution<P>>
  /** Every unlinked dollar on the job. */
  unlinkedTotal: number
  /** Unlinked money no sent bill needed — a job-level line, never a bill's. */
  surplus: number
}

const round2 = (n: number): number => Math.round(n * 100) / 100
const num = (v: number | string | null | undefined): number => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** A bill the customer could have paid: sent (billed) or settled (paid). */
export function isSentBill(status: string | null | undefined): boolean {
  return status === 'billed' || status === 'paid'
}

function billOrder(a: AttributionBill, b: AttributionBill): number {
  const sa = a.sequence_order ?? Number.POSITIVE_INFINITY
  const sb = b.sequence_order ?? Number.POSITIVE_INFINITY
  if (sa !== sb) return sa - sb
  const ba = a.billed_at ?? '9999'
  const bb = b.billed_at ?? '9999'
  if (ba !== bb) return ba < bb ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function paymentOrder(a: AttributionPayment, b: AttributionPayment): number {
  const sa = a.sequence_order ?? Number.POSITIVE_INFINITY
  const sb = b.sequence_order ?? Number.POSITIVE_INFINITY
  if (sa !== sb) return sa - sb
  const pa = a.paid_on ?? '9999'
  const pb = b.paid_on ?? '9999'
  return pa < pb ? -1 : pa > pb ? 1 : 0
}

export function attributeJobPayments<P extends AttributionPayment>(
  bills: readonly AttributionBill[],
  payments: readonly P[],
): JobPaymentAttribution<P> {
  const byBill = new Map<string, BillAttribution<P>>()
  for (const b of bills) byBill.set(b.id, { linked: 0, unlinked: 0, applied: 0, slices: [] })

  // 1. Linked money is its bill's, in full.
  for (const p of payments) {
    const id = p.invoice_id ?? null
    if (!id) continue
    const amt = num(p.amount)
    // A payment linked to a bill this reader was not given still counts for that bill —
    // linked money is a fact, not an attribution.
    let b = byBill.get(id)
    if (!b) {
      b = { linked: 0, unlinked: 0, applied: 0, slices: [] }
      byBill.set(id, b)
    }
    b.linked = round2(b.linked + amt)
    b.slices.push({ payment: p, amount: round2(amt), partial: false })
  }

  // 2. Unlinked money walks the sent bills oldest first.
  const sent = bills.filter((b) => isSentBill(b.status)).sort(billOrder)
  const need = new Map<string, number>()
  for (const b of sent) need.set(b.id, Math.max(0, round2(num(b.amount) - (byBill.get(b.id)?.linked ?? 0))))
  const unlinked = payments.filter((p) => !p.invoice_id).sort(paymentOrder)
  let unlinkedTotal = 0
  let surplus = 0
  for (const p of unlinked) {
    let left = round2(num(p.amount))
    unlinkedTotal = round2(unlinkedTotal + left)
    if (left <= 0) continue
    const touched: Array<{ id: string; amount: number }> = []
    for (const b of sent) {
      if (left <= 0) break
      const n = need.get(b.id) ?? 0
      if (n <= 0) continue
      const take = round2(Math.min(n, left))
      need.set(b.id, round2(n - take))
      left = round2(left - take)
      touched.push({ id: b.id, amount: take })
    }
    const split = touched.length > 1 || left > 0
    for (const t of touched) {
      const b = byBill.get(t.id)!
      b.unlinked = round2(b.unlinked + t.amount)
      b.slices.push({ payment: p, amount: t.amount, partial: split })
    }
    surplus = round2(surplus + left)
  }
  for (const b of byBill.values()) b.applied = round2(b.linked + b.unlinked)
  return { byBill, unlinkedTotal, surplus }
}

/** What one bill has been paid under the rule; 0 for a bill the job does not carry. */
export function paymentsAppliedToBill(bills: readonly AttributionBill[], payments: readonly AttributionPayment[], billId: string): number {
  return attributeJobPayments(bills, payments).byBill.get(billId)?.applied ?? 0
}

/** The payments (and shares of payments) one bill shows on its paper, in ledger order. */
export function billPaymentSlices<P extends AttributionPayment>(bills: readonly AttributionBill[], payments: readonly P[], billId: string): PaymentSlice<P>[] {
  const slices = attributeJobPayments(bills, payments).byBill.get(billId)?.slices ?? []
  return [...slices].sort((a, b) => paymentOrder(a.payment, b.payment))
}
