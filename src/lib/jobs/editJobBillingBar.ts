/**
 * Money-lifecycle figures for the Edit-Job billing section's Progress & payment
 * bar, computed from the *live* Edit-Job form state (fixture-derived job total,
 * the payments table, the job's invoices):
 *   Job Total = Paid (green) + Billed-unpaid (blue) + Draft (striped) + Remaining
 *
 * Draft (ready_to_bill) gets its own segment here — unlike the Stages bar — so
 * the modal shows "carved into a bill but not sent yet" distinctly. Pure (no DB,
 * no React) so it unit-tests cleanly.
 */
export type BillingBarInvoice = { status: string; amount: number | null | undefined; id?: string | null }
export type BillingBarPayment = { amount: number | null | undefined; invoice_id?: string | null }

function num(v: number | null | undefined): number {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** Sum of every payment amount (the green "Paid" total). */
export function sumBillingPayments(payments: BillingBarPayment[]): number {
  return (payments ?? []).reduce((s, p) => s + num(p.amount), 0)
}

/** Payments recorded against a specific invoice id. */
export function paymentsAppliedToInvoice(payments: BillingBarPayment[], invoiceId: string | null | undefined): number {
  if (!invoiceId) return 0
  return (payments ?? []).reduce((s, p) => (p.invoice_id === invoiceId ? s + num(p.amount) : s), 0)
}

/**
 * Dollars already invoiced to the customer (status='billed') but not yet paid —
 * the blue segment. Ready-to-bill drafts are excluded (not a bill the customer
 * has received); they live in the "Remaining to bill" bucket instead.
 */
export function billedUnpaidDollars(invoices: BillingBarInvoice[], payments: BillingBarPayment[]): number {
  let s = 0
  for (const inv of invoices ?? []) {
    if (inv.status === 'billed') s += Math.max(0, num(inv.amount) - paymentsAppliedToInvoice(payments, inv.id ?? null))
  }
  return s
}

/**
 * Job total minus payments minus every allocated (ready_to_bill + billed)
 * invoice amount, floored at 0 — "value on the job not yet put on any bill".
 * Matches the modal's existing `unallocatedBillableDollars` / Stages unallocated.
 */
export function remainingToBillDollars(total: number, payments: BillingBarPayment[], invoices: BillingBarInvoice[]): number {
  let alloc = 0
  for (const inv of invoices ?? []) {
    if (inv.status === 'ready_to_bill' || inv.status === 'billed') alloc += num(inv.amount)
  }
  return Math.max(0, num(total) - sumBillingPayments(payments) - alloc)
}

/** Dollars carved into ready-to-bill drafts (allocated to a bill, not yet sent). */
export function draftDollars(invoices: BillingBarInvoice[]): number {
  let s = 0
  for (const inv of invoices ?? []) {
    if (inv.status === 'ready_to_bill') s += num(inv.amount)
  }
  return s
}

export type EditJobBillingBar = {
  /** False when there's no job total yet (no line items) — render the dashed empty track. */
  hasBar: boolean
  total: number
  paid: number
  billedUnpaid: number
  draft: number
  remaining: number
  /** Non-overlapping bar fractions (0–1), stacked paid → billed → draft; the rest is the empty track. */
  paidFrac: number
  billedFrac: number
  draftFrac: number
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

/**
 * The bar figures + non-overlapping stacked fractions for the Edit-Job billing
 * header. Segments never overrun the track: each is capped by the room the
 * earlier segments leave (paid, then billed-unpaid, then draft).
 */
export function buildEditJobBillingBar(args: {
  total: number
  payments: BillingBarPayment[]
  invoices: BillingBarInvoice[]
}): EditJobBillingBar {
  const total = num(args.total)
  const paid = sumBillingPayments(args.payments)
  const billedUnpaid = billedUnpaidDollars(args.invoices, args.payments)
  const draft = draftDollars(args.invoices)
  const remaining = remainingToBillDollars(total, args.payments, args.invoices)

  const hasBar = total > 0
  const paidFrac = hasBar ? clamp01(paid / total) : 0
  const billedFrac = hasBar ? Math.min(clamp01(billedUnpaid / total), 1 - paidFrac) : 0
  const draftFrac = hasBar ? Math.min(clamp01(draft / total), 1 - paidFrac - billedFrac) : 0

  return { hasBar, total, paid, billedUnpaid, draft, remaining, paidFrac, billedFrac, draftFrac }
}
