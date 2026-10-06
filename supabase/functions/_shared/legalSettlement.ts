/**
 * Settlement authority as a threshold (punch list #85, item 20; the owner's
 * decision of 2026-10-05). The office sets ONE floor per matter — dollars
 * (`legal_matters.settlement_floor_amount`) or a percent of the open balance
 * (`settlement_floor_pct`); null = no floor, the firm settles freely. The firm
 * settles at or above it; below it, its `settled` step becomes a settlement ask
 * the office signs off (`legal_answer_settlement`).
 *
 * Pure and shared: `submit-legal-portal` decides with it, the portal shows the
 * floor with it, the desk words it with it — one rule, so the firm never sees
 * one floor and meets another.
 */
import { legalJobMoneyOf, type LegalMoneyInvoice, type LegalMoneyPayment } from './legalJobMoney.ts'

export type LegalSettlementFloor = { amount: number | null; pct: number | null }

export const SETTLEMENT_ASK_FLAVOR = 'settlement' as const

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

/** The matter row's floor; null when none is set. */
export function settlementFloorOf(row: { settlement_floor_amount?: unknown; settlement_floor_pct?: unknown } | null | undefined): LegalSettlementFloor | null {
  if (!row) return null
  const amount = num(row.settlement_floor_amount)
  const pct = num(row.settlement_floor_pct)
  if (amount != null && amount > 0) return { amount: Math.round(amount * 100) / 100, pct: null }
  if (pct != null && pct > 0 && pct <= 100) return { amount: null, pct }
  return null
}

/** The floor in dollars today: the amount, or the percent of the open balance (to the cent). */
export function settlementFloorDollars(floor: LegalSettlementFloor | null, balance: number): number | null {
  if (!floor) return null
  if (floor.amount != null) return floor.amount
  if (floor.pct != null) return Math.round(Math.max(0, balance) * floor.pct) / 100
  return null
}

/** True when the proposal is under the floor (and so goes to the office as an ask). No floor → never. */
export function settlementBelowFloor(proposed: number, floor: LegalSettlementFloor | null, balance: number): boolean {
  const f = settlementFloorDollars(floor, balance)
  return f != null && proposed < f
}

type JobLike = { id: string; revenue?: number | string | null; payments_made?: number | string | null }
type InvoiceLike = LegalMoneyInvoice & { job_id: string }
type PaymentLike = LegalMoneyPayment & { job_id: string }

/**
 * The matter's open balance by the one money rule the firm's card reads (`_shared/legalJobMoney.ts`, item 5):
 * each job's balance summed, never below 0. The floor and the card can no longer disagree.
 */
export function matterOpenBalance(jobs: ReadonlyArray<JobLike>, invoices: ReadonlyArray<InvoiceLike>, payments: ReadonlyArray<PaymentLike>): number {
  let total = 0
  for (const j of jobs) {
    total += legalJobMoneyOf({ revenue: j.revenue, payments_made: j.payments_made, invoices: invoices.filter((i) => i.job_id === j.id), payments: payments.filter((p) => p.job_id === j.id) }).balance
  }
  return Math.max(0, Math.round(total * 100) / 100)
}

function usd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** The firm's line on the matter card: `You may settle at $14,000.00 or above (70% of the balance). Below that, ask.` */
export function settlementFloorWords(floor: LegalSettlementFloor | null, balance: number): string {
  const f = settlementFloorDollars(floor, balance)
  if (f == null || !floor) return 'No settlement floor: you may settle at any amount.'
  return `You may settle at ${usd(f)} or above${floor.pct != null ? ` (${floor.pct}% of the balance)` : ''}. Below that, ask.`
}
