/**
 * Break-off ("carve a bill out of the job total") math for the Edit-Job form's
 * billing section. Extracted verbatim from JobFormModal so it can be unit-tested
 * and reused. Pure — no React, no DOM, no DB.
 */
import type { JobWithDetails } from '../../types/jobWithDetails'

/** Gross (job total) minus payments minus ready_to_bill and billed invoice line amounts — same basis as Stages unallocated. */
export function unallocatedBillableDollars(
  gross: number,
  paidSum: number,
  invoices: Array<{ status: string; amount: unknown }> | null | undefined,
): number {
  let alloc = 0
  for (const inv of invoices ?? []) {
    if (inv.status === 'ready_to_bill' || inv.status === 'billed') {
      alloc += Number(inv.amount) || 0
    }
  }
  return Math.max(0, gross - paidSum - alloc)
}

/** Break-off dollars for target combined % ((paid + break) / gross) * 100, clamped to remaining unallocated. */
export function breakDollarsFromCombinedPct(
  combinedPct: number,
  gross: number,
  paidSum: number,
  remainingUnallocated: number,
): number {
  const rawBreak = (combinedPct / 100) * gross - paidSum
  const cents = Math.min(
    Math.round(remainingUnallocated * 100),
    Math.max(0, Math.round(rawBreak * 100)),
  )
  return cents / 100
}

export const BREAK_OFF_COMBINED_SLIDER_STEP_PCT = 5

/**
 * Map a pointer position on the break-off track (ratio 0–1 across its width)
 * to a combined (paid + this bill) percent. The track's visual axis is ALWAYS
 * 0–100% of the job total — ticks at 20/40/60/80, thumb at the combined pct —
 * so the ratio maps straight onto that axis and [min, max] only clamps it.
 * (Mapping into min + ratio*(max−min) compresses the axis and makes clicks
 * land left of the cursor whenever billed invoices lower `max` — the "slider
 * jumps" bug, v2.776.)
 */
export function combinedPctFromTrackRatio(ratio: number, min: number, max: number): number {
  const r = Math.min(1, Math.max(0, ratio))
  return Math.min(max, Math.max(min, r * 100))
}

export function snapBreakOffCombinedPctToStep(
  pct: number,
  min: number,
  max: number,
  step: number = BREAK_OFF_COMBINED_SLIDER_STEP_PCT,
): number {
  const snapped = Math.round(pct / step) * step
  return Math.min(max, Math.max(min, snapped))
}

export function breakOffPrefillAmountStringFromJob(job: JobWithDetails): string {
  const gross = job.revenue != null ? Number(job.revenue) : 0
  const paid = (job.payments ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const remaining = unallocatedBillableDollars(gross, paid, job.invoices)
  if (!(gross > 0) || !(remaining > 0)) return ''
  const paidCents = Math.round(paid * 100)
  const threshold80Cents = Math.round(0.8 * gross * 100)
  const rawTarget = paidCents > threshold80Cents ? 0.95 * gross : 0.8 * gross
  const useCents = Math.min(
    Math.round(remaining * 100),
    Math.max(0, Math.round(rawTarget * 100)),
  )
  const amount = useCents / 100
  return amount > 0 ? amount.toFixed(2) : ''
}
