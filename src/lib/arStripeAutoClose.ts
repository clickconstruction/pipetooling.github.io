/**
 * AR → Stripe auto-close (v2.1639): after a successful Mercury allocation, the
 * modal marks exactly-covered Stripe-hosted bills paid out-of-band in Stripe so
 * the emailed link can't be paid a second time.
 *
 * This kernel decides WHICH bills qualify: direct invoice allocations to a
 * Stripe-hosted target whose summed amount exactly matches the bill's
 * outstanding (cent tolerance). Partial coverage never qualifies — Stripe's
 * paid_out_of_band is invoice-level, so closing a half-paid bill would kill a
 * link the customer may still owe on. Recorded-payment links (kind 'payment')
 * are out of scope here (their amounts were fixed when recorded).
 *
 * The edge function re-verifies the amount against Stripe's own
 * amount_remaining, so a stale client-side `remaining` fails loudly there
 * instead of closing the wrong amount.
 */

export type ArStripeAutoCloseLine = {
  kind: string
  targetKey: string | null
  /** Parsed allocation amount in dollars (NaN / <=0 lines are ignored). */
  amount: number
}

export type ArStripeAutoCloseTarget = {
  stripeHosted: boolean
  remaining: number
  invoiceId: string | null
  label: string
}

export type ArStripeAutoCloseCandidate = {
  invoiceId: string
  amountDollars: number
  label: string
}

/** Half-cent tolerance — mirrors the RPC's fully-paid comparison. */
const MATCH_EPSILON = 0.005

export function arStripeAutoCloseCandidates(
  lines: ArStripeAutoCloseLine[],
  targetByKey: Map<string, ArStripeAutoCloseTarget>,
): ArStripeAutoCloseCandidate[] {
  const sumByInvoice = new Map<string, { amount: number; remaining: number; label: string }>()
  for (const line of lines) {
    if (line.kind !== 'billed' || !line.targetKey) continue
    const t = targetByKey.get(line.targetKey)
    if (!t || !t.stripeHosted || !t.invoiceId) continue
    if (!Number.isFinite(line.amount) || line.amount <= 0) continue
    const prev = sumByInvoice.get(t.invoiceId)
    if (prev) {
      prev.amount += line.amount
    } else {
      sumByInvoice.set(t.invoiceId, { amount: line.amount, remaining: t.remaining, label: t.label })
    }
  }
  const out: ArStripeAutoCloseCandidate[] = []
  for (const [invoiceId, agg] of sumByInvoice) {
    if (Math.abs(agg.amount - agg.remaining) < MATCH_EPSILON) {
      out.push({ invoiceId, amountDollars: agg.amount, label: agg.label })
    }
  }
  return out
}

/**
 * True when every selected Stripe-hosted allocation line belongs to a bill the
 * apply will auto-close — drives the confirmation checkbox copy ("the app will
 * close the Stripe invoice" vs the manual-homework reminder).
 */
export function allStripeAllocationsAutoClose(
  lines: ArStripeAutoCloseLine[],
  targetByKey: Map<string, ArStripeAutoCloseTarget>,
): boolean {
  const candidates = new Set(arStripeAutoCloseCandidates(lines, targetByKey).map((c) => c.invoiceId))
  let sawStripeLine = false
  for (const line of lines) {
    if (line.kind !== 'billed' || !line.targetKey) continue
    const t = targetByKey.get(line.targetKey)
    if (!t?.stripeHosted) continue
    if (!Number.isFinite(line.amount) || line.amount <= 0) continue
    sawStripeLine = true
    if (!t.invoiceId || !candidates.has(t.invoiceId)) return false
  }
  return sawStripeLine
}
