/**
 * AR refresh PR 2 (v2.3380): the remaining meter under the deposit header.
 * How much of the deposit is already applied to jobs, how much the lines on
 * screen would add, and what is left after them. Pure; tested beside it.
 */

export type ArAllocationProgress = {
  /** Sum of the allocation lines on screen (dollars, ≥ 0). */
  allocatedNow: number
  /** The deposit's remaining balance minus the lines on screen (can go negative when over-allocated). */
  remainingAfter: number
  /** (applied to jobs + lines on screen) ÷ the deposit, clamped 0..1 — the bar's fill. */
  pctFilled: number
  /** True when the lines add up past the deposit's remaining balance. */
  over: boolean
}

/** The same lenient parse Bill Customer's allocation inputs use: digits and a dot; anything else ignored. */
export function parseAllocationDollars(raw: string): number {
  const n = Number(String(raw ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function arAllocationProgress(args: {
  amount: number | string | null
  consumed: number | string | null
  remainingAvailable: number | string | null
  lines: ReadonlyArray<{ amountStr: string }>
}): ArAllocationProgress {
  const amount = Math.abs(Number(args.amount) || 0)
  const consumed = Math.max(0, Number(args.consumed) || 0)
  const remaining = Math.max(0, Number(args.remainingAvailable) || 0)
  const allocatedNow = Math.round(args.lines.reduce((s, l) => s + parseAllocationDollars(l.amountStr), 0) * 100) / 100
  const remainingAfter = Math.round((remaining - allocatedNow) * 100) / 100
  const pctFilled = amount > 0 ? Math.min(1, Math.max(0, (consumed + allocatedNow) / amount)) : 0
  return { allocatedNow, remainingAfter, pctFilled, over: remainingAfter < -0.0005 }
}
