/**
 * Bill-choice chips for the Edit-Job payments table (v2.2570) — the data
 * behind "which bill does this payment pay?".
 *
 * Builds on paymentInvoiceLinking's flagging: every flagged row sits on a job
 * with 2+ open bills (the single-bill case auto-links), so the fix UI must
 * present the candidates instead of hiding them in the details fold. These
 * kernels compute what each chip shows: the bill's amount, when it went out,
 * what's still unpaid on it after the payments already applied in the current
 * form state, and whether that open balance exactly matches the payment being
 * placed. A match is a highlight and sort-first only — never an auto-apply.
 */

export type MatchableInvoiceSlice = {
  id: string
  status: string
  amount: number | string | null
  sent_to_customer_at?: string | null
  billed_at?: string | null
  estimated_bill_date?: string | null
}

export type MatchablePaymentSlice = {
  id?: string
  amount: number | string | null
  invoice_id: string | null
}

export type BillChoice = {
  id: string
  amount: number
  /** YYYY-MM-DD the bill went out: sent date, else billed date, else est. bill date. */
  sentYmd: string | null
  /** Bill amount minus payments applied to it in the current form state (negative = over-applied). */
  remaining: number
  /** This bill's open balance equals the payment being placed, to the cent. */
  matchesAmount: boolean
}

const toCents = (v: number | string | null | undefined): number => Math.round((Number(v) || 0) * 100)

function ymdOf(value: string | null | undefined): string | null {
  const s = (value ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null
}

function billSentYmd(inv: MatchableInvoiceSlice): string | null {
  return ymdOf(inv.sent_to_customer_at) ?? ymdOf(inv.billed_at) ?? ymdOf(inv.estimated_bill_date)
}

/**
 * The chips for one payment: every open (billed) invoice with its live
 * remaining balance. Amount-match chips sort first; within each group, the
 * oldest bill leads (dateless bills last). The payment itself never counts
 * toward a bill's applied total, so a "change which bill" flow sees the
 * balance as if this payment were unplaced.
 */
export function billChoicesForPayment(
  payment: MatchablePaymentSlice,
  invoices: MatchableInvoiceSlice[] | null | undefined,
  payments: MatchablePaymentSlice[] | null | undefined,
): BillChoice[] {
  const billed = (invoices ?? []).filter((i) => i.status === 'billed')
  if (billed.length === 0) return []

  const appliedCents = new Map<string, number>()
  for (const p of payments ?? []) {
    if (!p.invoice_id) continue
    if (payment.id != null && p.id === payment.id) continue
    appliedCents.set(p.invoice_id, (appliedCents.get(p.invoice_id) ?? 0) + toCents(p.amount))
  }

  const payCents = toCents(payment.amount)
  const choices = billed.map((inv): BillChoice => {
    const remainingCents = toCents(inv.amount) - (appliedCents.get(inv.id) ?? 0)
    return {
      id: inv.id,
      amount: Number(inv.amount) || 0,
      sentYmd: billSentYmd(inv),
      remaining: remainingCents / 100,
      matchesAmount: payCents > 0 && remainingCents === payCents,
    }
  })

  return choices.sort((a, b) => {
    if (a.matchesAmount !== b.matchesAmount) return a.matchesAmount ? -1 : 1
    if (a.sentYmd && b.sentYmd && a.sentYmd !== b.sentYmd) return a.sentYmd < b.sentYmd ? -1 : 1
    if (Boolean(a.sentYmd) !== Boolean(b.sentYmd)) return a.sentYmd ? -1 : 1
    return 0
  })
}
