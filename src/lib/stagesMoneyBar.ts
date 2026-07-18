/**
 * Model for the Jobs → Stages merged "Progress & payment" cell.
 *
 * One quantity — the job's total bill (bid) — sliced two ways:
 *   work:  done vs not done            (from pct_complete)
 *   money: paid vs owed                (from payments_made)
 * The bar renders paid (green) then done-but-unpaid = unbilled (amber);
 * the empty track is work not yet done.
 */

export type StagesMoneyBarInput = {
  /** jobs_ledger.revenue — the job's total bill / bid value. */
  totalBill: number | null | undefined
  /** Sum of payments received. */
  paymentsMade: number | null | undefined
  /** jobs_ledger.pct_complete, 0–100, or null when the field hasn't reported one. */
  pctComplete: number | null | undefined
}

export type StagesMoneyBarModel = {
  /** False when there is no positive total bill — render the empty/dashed state. */
  hasBar: boolean
  /** Green segment width, fraction of the bar (0–1). */
  paidFrac: number
  /** Amber segment width, fraction of the bar (0–1); paidFrac + unbilledFrac ≤ 1. */
  unbilledFrac: number
  total: number
  paid: number
  /** Dollar value of work performed (total × pct); null when pct unknown. */
  valueCreated: number | null
  /** Work done but not yet paid for, floored at 0; null when pct unknown. */
  unbilled: number | null
  /** total − paid. Can be negative when payments exceed the bill. */
  owed: number
  /** Payments exceed the total bill. */
  overpaid: boolean
}

function toNumber(v: number | null | undefined): number {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

export function buildStagesMoneyBarModel(input: StagesMoneyBarInput): StagesMoneyBarModel {
  const total = toNumber(input.totalBill)
  const paid = toNumber(input.paymentsMade)
  const pct =
    input.pctComplete != null && Number.isFinite(Number(input.pctComplete))
      ? Math.min(100, Math.max(0, Number(input.pctComplete)))
      : null

  const hasBar = total > 0
  const valueCreated = pct != null ? (total * pct) / 100 : null
  const unbilled = valueCreated != null ? Math.max(0, valueCreated - paid) : null
  const owed = total - paid
  const overpaid = paid > total && total > 0

  const paidFrac = hasBar ? clamp01(paid / total) : 0
  const doneFrac = hasBar && valueCreated != null ? clamp01(valueCreated / total) : 0
  const unbilledFrac = Math.max(0, doneFrac - paidFrac)

  return { hasBar, paidFrac, unbilledFrac, total, paid, valueCreated, unbilled, owed, overpaid }
}
