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

/** `fees`: the refusal is about the bill's fee lines, and the editor says so (the amount checks only hold the button). */
export type SplitBillValidation =
  | { ok: true; partsCents: number[]; /** Each part's fee lines (`placeSplitBillFeeLines`), null for none. */ feeLinesByPart: Array<unknown[] | null> }
  | { ok: false; error: string; fees?: true }

/**
 * Validate the full parts list (typed parts + auto remainder). `enteredCents` is
 * parts 1..N-1 as parsed cents (null = blank/unparseable input). `feeLines` is the bill's
 * `fee_lines` (punch list #105): a GC card fee refuses the split, and so does a fee no part has room for.
 */
export function validateSplitBillParts(
  totalCents: number,
  enteredCents: Array<number | null>,
  feeLines?: unknown,
): SplitBillValidation {
  const cardRefusal = splitBillCardFeeRefusal(feeLines)
  if (cardRefusal) return { ok: false, error: cardRefusal, fees: true }
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
  const partsCents = [...enteredCents.map((c) => c ?? 0), remainder]
  const placement = placeSplitBillFeeLines(feeLines, partsCents)
  if (!placement.ok) return { ok: false, error: placement.error, fees: true }
  return { ok: true, partsCents, feeLinesByPart: placement.byPart }
}

/** Stripe memo for part n of m; keeps the original bill's memo when there is one. */
export function splitBillPartMemo(originalMemo: string | null | undefined, n: number, m: number): string {
  const base = (originalMemo ?? '').trim()
  const suffix = `Part ${n} of ${m}`
  if (!base) return suffix
  return `${base} — ${suffix.toLowerCase()}`
}

function feeLineCents(line: unknown): number {
  const amount = Number((line as { amount?: unknown } | null)?.amount)
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0
}

function feeLineWords(line: unknown): string {
  const l = (line ?? {}) as Record<string, unknown>
  if (typeof l.trip_charge === 'string' && l.trip_charge.trim()) return 'trip charge'
  if (typeof l.case_id === 'string' && l.case_id.trim()) return 'returned check fee'
  return 'fee'
}

/**
 * A bill that carries a GC card fee is not split (punch list #105, review on #5274): its entry names the card bill
 * (`card_bill`, v2.5113), and `gc_owner_card_bills` points at this bill, so a part would carry a fee for a bill that is
 * gone and the GC's figures would overstate. The card bill's half is GC mode's. Words when it refuses, else null.
 */
export function splitBillCardFeeRefusal(feeLines: unknown): string | null {
  if (!Array.isArray(feeLines)) return null
  const card = feeLines.some((l) => {
    const v = (l as Record<string, unknown> | null)?.card_bill
    return typeof v === 'string' && v.trim() !== ''
  })
  return card ? 'This bill carries the GC’s card fee, so it cannot be split. A card bill stays one bill.' : null
}

export type SplitBillFeePlacement = { ok: true; byPart: Array<unknown[] | null> } | { ok: false; error: string }

/**
 * Where a split bill's fee lines go (punch list #105, v2.5140). A fee that rides on a bill (a turnaway trip charge,
 * `riderFeeLineCents`) is a `fee_lines` entry on that bill, and every rewrite of the job's revenue adds it back from
 * there. The parts are new rows, so the split hands each entry to one of them: the first part with room left for its
 * amount, so the first part takes them all unless one is larger than it. No part holds more fees than its own amount:
 * a fee no part has room for refuses the split, in words. One list per part, null for a part that carries none.
 */
export function placeSplitBillFeeLines(feeLines: unknown, partsCents: readonly number[]): SplitBillFeePlacement {
  const byPart: Array<unknown[] | null> = partsCents.map(() => null)
  if (!Array.isArray(feeLines)) return { ok: true, byPart }
  const placed = partsCents.map(() => 0)
  for (const line of feeLines) {
    const cents = feeLineCents(line)
    const at = partsCents.findIndex((p, i) => placed[i]! + cents <= p)
    if (at < 0) {
      return { ok: false, error: `The $${formatCentsAsDollars(cents)} ${feeLineWords(line)} on this bill needs a part of at least $${formatCentsAsDollars(cents)}.` }
    }
    placed[at] = placed[at]! + cents
    byPart[at] = [...(byPart[at] ?? []), line]
  }
  return { ok: true, byPart }
}

/**
 * Stripe invoice numbers are `<job digits>-<YYMMDD due date><HHmm now>` — two parts
 * created in the same minute with one due date would collide. Stagger each part's
 * `issued_at_ms` by a minute so every part gets a distinct number.
 */
export function splitBillIssuedAtMs(baseMs: number, partIndex: number): number {
  return baseMs + partIndex * 60_000
}
