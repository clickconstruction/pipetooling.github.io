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

type JobLike = { id: string; revenue?: unknown; payments_made?: unknown }
type InvoiceLike = { id: string; job_id: string; amount?: unknown; status?: unknown }
type PaymentLike = { job_id: string; invoice_id?: unknown; amount?: unknown }

/**
 * The matter's open balance by the packet's rule (`src/lib/legal/legalPacket.ts`
 * `jobOpenBalance`): per job, its open billed lines when it has any (each line's
 * amount less what was paid against it), else revenue less payments made.
 */
export function matterOpenBalance(jobs: ReadonlyArray<JobLike>, invoices: ReadonlyArray<InvoiceLike>, payments: ReadonlyArray<PaymentLike>): number {
  let total = 0
  for (const j of jobs) {
    const billed = invoices.filter((i) => i.job_id === j.id && i.status === 'billed')
    if (billed.length > 0) {
      for (const inv of billed) {
        const applied = payments.filter((p) => p.invoice_id === inv.id).reduce((s, p) => s + (num(p.amount) ?? 0), 0)
        total += Math.max(0, (num(inv.amount) ?? 0) - applied)
      }
    } else {
      total += Math.max(0, (num(j.revenue) ?? 0) - (num(j.payments_made) ?? 0))
    }
  }
  return Math.round(total * 100) / 100
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
