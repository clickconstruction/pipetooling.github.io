/**
 * Exact-match sweep for the AR bank-payments modal: pairs deposits with open
 * billed lines when — and only when — the pairing is unambiguous, so the
 * everyday "one check = one bill" cases can be reviewed and applied as a
 * batch instead of one select-search-type cycle each.
 *
 * A pair forms only when exactly ONE listed deposit and exactly ONE open bill
 * share a cents-exact amount (deposit remaining vs bill remaining). Buckets
 * with several deposits or several bills at the same amount are reported as
 * skipped, never guessed. Stripe-hosted bills are excluded entirely — they
 * carry the paid-outside-Stripe confirmation gate and stay manual.
 */

export type SweepDepositSlice = {
  mercury_transaction_id: string
  remaining_available: number | string
  counterparty_name: string | null
  posted_at: string | null
  kind: string
  returned?: boolean | null
}

export type SweepTargetSlice = {
  key: string
  remaining: number
  stripeHosted: boolean
}

export type ArSweepPair = { depositId: string; targetKey: string; amountCents: number }

export type ArSweepSkippedBucket = {
  amountCents: number
  depositCount: number
  targetCount: number
}

export type ArExactMatchSweep = {
  pairs: ArSweepPair[]
  /** Amounts where deposits and bills exist but the pairing is ambiguous. */
  skipped: ArSweepSkippedBucket[]
  totalCents: number
}

const toCents = (v: number | string | null | undefined): number => Math.round((Number(v) || 0) * 100)

export function buildArExactMatchSweep(
  deposits: SweepDepositSlice[],
  targets: SweepTargetSlice[],
): ArExactMatchSweep {
  const depositsByCents = new Map<number, SweepDepositSlice[]>()
  for (const d of deposits) {
    if (d.returned) continue
    const cents = toCents(d.remaining_available)
    if (cents <= 0) continue
    const list = depositsByCents.get(cents)
    if (list) list.push(d)
    else depositsByCents.set(cents, [d])
  }

  const targetsByCents = new Map<number, SweepTargetSlice[]>()
  for (const t of targets) {
    if (t.stripeHosted) continue
    const cents = toCents(t.remaining)
    if (cents <= 0) continue
    const list = targetsByCents.get(cents)
    if (list) list.push(t)
    else targetsByCents.set(cents, [t])
  }

  const pairs: ArSweepPair[] = []
  const skipped: ArSweepSkippedBucket[] = []
  let totalCents = 0
  for (const [cents, ds] of Array.from(depositsByCents.entries()).sort((a, b) => b[0] - a[0])) {
    const ts = targetsByCents.get(cents)
    if (!ts) continue
    if (ds.length === 1 && ts.length === 1) {
      pairs.push({ depositId: ds[0]!.mercury_transaction_id, targetKey: ts[0]!.key, amountCents: cents })
      totalCents += cents
    } else {
      skipped.push({ amountCents: cents, depositCount: ds.length, targetCount: ts.length })
    }
  }
  return { pairs, skipped, totalCents }
}
