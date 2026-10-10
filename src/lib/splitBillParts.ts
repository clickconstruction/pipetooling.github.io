import { parseMoneyInputToNumberOrNull } from './jobs/jobFormMoney'

/**
 * Split-bill kernel (v2.1520): one billed Stripe bill becomes N bills so a customer
 * can pay with multiple cards. Pure math for the parts editor in SplitBillModal —
 * the user types parts 1..N-1 and the last part is always the auto remainder.
 */

export const MIN_SPLIT_BILL_PARTS = 2
export const MAX_SPLIT_BILL_PARTS = 4

/** Stripe rejects charges under $0.50; keep every part safely above it. */
export const MIN_SPLIT_BILL_PART_CENTS = 50

export function dollarsInputToCents(input: string): number | null {
  const n = parseMoneyInputToNumberOrNull(input.replace(/[$\s]/g, ''))
  if (n === null || !Number.isFinite(n)) return null
  return Math.round(n * 100)
}

export function formatCentsAsDollars(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Last part = total minus the typed parts; negative means the typed parts overshoot. */
export function splitBillRemainderCents(totalCents: number, enteredCents: Array<number | null>): number {
  let sum = 0
  for (const c of enteredCents) sum += c ?? 0
  return totalCents - sum
}

export type SplitBillValidation = { ok: true; partsCents: number[] } | { ok: false; error: string }

/**
 * Validate the full parts list (typed parts + auto remainder). `enteredCents` is
 * parts 1..N-1 as parsed cents (null = blank/unparseable input).
 */
export function validateSplitBillParts(
  totalCents: number,
  enteredCents: Array<number | null>,
): SplitBillValidation {
  const partCount = enteredCents.length + 1
  if (partCount < MIN_SPLIT_BILL_PARTS || partCount > MAX_SPLIT_BILL_PARTS) {
    return { ok: false, error: `Split into ${MIN_SPLIT_BILL_PARTS}–${MAX_SPLIT_BILL_PARTS} parts.` }
  }
  if (totalCents < partCount * MIN_SPLIT_BILL_PART_CENTS) {
    return { ok: false, error: 'Bill is too small to split.' }
  }
  for (let i = 0; i < enteredCents.length; i++) {
    const c = enteredCents[i]
    if (c === null || c === undefined) {
      return { ok: false, error: `Enter an amount for part ${i + 1}.` }
    }
    if (c < MIN_SPLIT_BILL_PART_CENTS) {
      return { ok: false, error: `Part ${i + 1} must be at least $0.50.` }
    }
  }
  const remainder = splitBillRemainderCents(totalCents, enteredCents)
  if (remainder < MIN_SPLIT_BILL_PART_CENTS) {
    return {
      ok: false,
      error: `Parts must leave at least $0.50 for part ${partCount} — they currently total too much.`,
    }
  }
  return { ok: true, partsCents: [...enteredCents.map((c) => c ?? 0), remainder] }
}

/** Stripe memo for part n of m; keeps the original bill's memo when there is one. */
export function splitBillPartMemo(originalMemo: string | null | undefined, n: number, m: number): string {
  const base = (originalMemo ?? '').trim()
  const suffix = `Part ${n} of ${m}`
  if (!base) return suffix
  return `${base} — ${suffix.toLowerCase()}`
}

/**
 * Where a split bill's fee lines go (punch list #105, v2.5140). A fee that rides on a bill (a turnaway trip charge, a
 * GC card fee, `riderFeeLineCents`) is a `fee_lines` entry on that bill, and every rewrite of the job's revenue adds it
 * back from there. The parts are new rows, so the split hands each entry to one of them: the first part with room
 * left for its amount, so the first part takes them all unless one is larger than it. An entry no part can hold goes
 * on the part with the most room, so the fee is never lost. One list per part, null for a part that carries none.
 */
export function splitBillFeeLinesByPart(feeLines: unknown, partsCents: readonly number[]): Array<unknown[] | null> {
  const out: Array<unknown[] | null> = partsCents.map(() => null)
  if (!Array.isArray(feeLines) || partsCents.length === 0) return out
  const placed = partsCents.map(() => 0)
  for (const line of feeLines) {
    const amount = Number((line as { amount?: unknown } | null)?.amount)
    const cents = Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0
    let at = partsCents.findIndex((p, i) => placed[i]! + cents <= p)
    if (at < 0) {
      at = 0
      for (let i = 1; i < partsCents.length; i++) if (partsCents[i]! - placed[i]! > partsCents[at]! - placed[at]!) at = i
    }
    placed[at] = placed[at]! + cents
    out[at] = [...(out[at] ?? []), line]
  }
  return out
}

/**
 * Stripe invoice numbers are `<job digits>-<YYMMDD due date><HHmm now>` — two parts
 * created in the same minute with one due date would collide. Stagger each part's
 * `issued_at_ms` by a minute so every part gets a distinct number.
 */
export function splitBillIssuedAtMs(baseMs: number, partIndex: number): number {
  return baseMs + partIndex * 60_000
}
