/**
 * Accounts Receivable refresh, PR 1 (v2.3379): what a deposit row can say
 * about itself before anyone clicks it.
 *
 * The modal already computes everything a row needs — the exact-match sweep,
 * the ambiguous-amount buckets, the payer read from the counterparty / note /
 * memo, the unlinked recorded payments — but only ever showed it in the right
 * pane for the selected deposit. This kernel names one state per row from
 * that same data so the list is the map:
 *
 *   returned   — flagged as bounced (Mark returned)
 *   closed     — closed out with a reason (v2.3529): not a customer's payment
 *   applied    — nothing left to allocate
 *   exact      — the sweep pairs it with exactly one open bill
 *   recorded   — a recorded, unlinked payment carries the same amount: the
 *                money is probably already on a job (the link guard's case)
 *   ambiguous  — bills share its amount but more than one could be it
 *   payer      — we know who paid, no single bill matches the amount
 *   hand       — nothing to go on but the picker
 *
 * Pure; unit-tested in arDepositRowState.test.ts.
 */

import { matchArDepositToPayer, type ArDepositTextSlice, type PayerTargetSlice } from './arDepositCustomerMatch'
import type { ArExactMatchSweep } from './arExactMatchSweep'

export type ArDepositRowState = 'returned' | 'closed' | 'applied' | 'exact' | 'recorded' | 'ambiguous' | 'payer' | 'hand'

export type ArDepositRowSlice = ArDepositTextSlice & {
  mercury_transaction_id: string
  remaining_available: number | string | null
  returned?: boolean | null
  /** v2.3529: a close-out row exists for this deposit. */
  closed?: boolean | null
}

const REMAINING_EPS = 0.0005

const toCents = (v: number | string | null | undefined): number => Math.round((Number(v) || 0) * 100)

export function arDepositRowStates(args: {
  deposits: ArDepositRowSlice[]
  sweep: ArExactMatchSweep
  targets: PayerTargetSlice[]
  recordedPayments: ReadonlyArray<{ amount: number | string | null }>
}): Map<string, ArDepositRowState> {
  const exact = new Set(args.sweep.pairs.map((p) => p.depositId))
  const ambiguousCents = new Set(args.sweep.skipped.map((b) => b.amountCents))
  const recordedCents = new Set(args.recordedPayments.map((p) => Math.abs(toCents(p.amount))).filter((c) => c > 0))
  const out = new Map<string, ArDepositRowState>()
  for (const d of args.deposits) {
    const remaining = Number(d.remaining_available) || 0
    let state: ArDepositRowState
    if (d.returned) state = 'returned'
    else if (d.closed) state = 'closed'
    else if (remaining <= REMAINING_EPS) state = 'applied'
    else if (exact.has(d.mercury_transaction_id)) state = 'exact'
    else if (recordedCents.has(toCents(remaining))) state = 'recorded'
    else if (ambiguousCents.has(toCents(remaining))) state = 'ambiguous'
    else if (args.targets.length > 0 && matchArDepositToPayer(d, args.targets)) state = 'payer'
    else state = 'hand'
    out.set(d.mercury_transaction_id, state)
  }
  return out
}

export type ArDepositRowTone = 'green' | 'amber' | 'red' | 'blue' | 'muted'

/** The chip's words and colour. Null for `hand` — an unremarkable row wears no chip. */
export function arDepositRowStateLabel(state: ArDepositRowState): { text: string; tone: ArDepositRowTone } | null {
  switch (state) {
    case 'returned':
      return { text: 'returned', tone: 'red' }
    case 'closed':
      return { text: 'closed out', tone: 'muted' }
    case 'applied':
      return { text: 'applied', tone: 'muted' }
    case 'exact':
      return { text: '1 exact match', tone: 'green' }
    case 'recorded':
      return { text: 'probably recorded', tone: 'amber' }
    case 'ambiguous':
      return { text: 'same amount, several bills', tone: 'amber' }
    case 'payer':
      return { text: 'payer known', tone: 'blue' }
    default:
      return null
  }
}

/** The header strip: deposits still carrying balance, and the dollars they carry. */
export function arDepositSummary(deposits: ReadonlyArray<{ remaining_available: number | string | null; returned?: boolean | null }>): {
  toMatch: number
  unappliedCents: number
} {
  let toMatch = 0
  let unappliedCents = 0
  for (const d of deposits) {
    if (d.returned) continue
    const cents = toCents(d.remaining_available)
    if (cents <= 0) continue
    toMatch += 1
    unappliedCents += cents
  }
  return { toMatch, unappliedCents }
}

/** "4 deposits to match · $9,115.42 unapplied" — the pieces, so the strip can bold them. */
export function arDepositSummaryWords(s: { toMatch: number; unappliedCents: number }): { count: string; money: string } | null {
  if (s.toMatch === 0) return null
  const money = (s.unappliedCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  return { count: `${s.toMatch} ${s.toMatch === 1 ? 'deposit' : 'deposits'}`, money }
}
