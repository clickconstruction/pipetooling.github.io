/**
 * Break-off ("carve a bill out of the job total") math for the Edit-Job form's
 * billing section. Extracted verbatim from JobFormModal so it can be unit-tested
 * and reused. Pure — no React, no DOM, no DB.
 */
import type { JobWithDetails } from '../../types/jobWithDetails'
import { allocatedOpenCents, type LinkedPayment } from '../billing/openLineAllocation'

export type BreakOffInvoice = { id?: string | null; status: string; amount: unknown; is_primary_rtb_bundle?: boolean | null }

/**
 * Sum of ready_to_bill + billed invoice line amounts — the dollars already
 * carved off the job total. The never-sent PRIMARY remainder bundle is
 * excluded (same rule as dollarCoverageForSegments and the ensure RPC since
 * v2.1134): it is elastic — it exists to equal whatever isn't billed yet — so
 * counting it made every Ready-to-Bill job read "100% billed / $0 left" and
 * clamped typed New-Invoice amounts to $0. Each line counts for what is still
 * unpaid on it (v2.3775): `paidSum` already holds the payments applied to it,
 * so its face amount would subtract them twice (`openLineAllocation.ts`).
 */
export function allocatedInvoiceDollars(
  invoices: Array<BreakOffInvoice> | null | undefined,
  payments: ReadonlyArray<LinkedPayment> | null | undefined = [],
): number {
  return allocatedOpenCents(
    (invoices ?? []).map((inv) => ({ ...inv, amount: inv.amount as number | string | null | undefined })),
    payments,
    { excludeRtbPrimary: true },
  ) / 100
}

/** Gross (job total) minus payments minus allocated invoice dollars (primary remainder bundle excluded, lines net of their payments). */
export function unallocatedBillableDollars(
  gross: number,
  paidSum: number,
  invoices: Array<BreakOffInvoice> | null | undefined,
  payments: ReadonlyArray<LinkedPayment> | null | undefined = [],
): number {
  return Math.max(0, gross - paidSum - allocatedInvoiceDollars(invoices, payments))
}

/**
 * Break-off dollars for a target combined % ((base + break) / gross) * 100,
 * clamped to remaining unallocated. `baseDollars` is whatever sits left of the
 * new invoice on the track — paid only historically; paid + billed since the
 * v2.1137 reorder (allocated money coalesces on the left).
 */
export function breakDollarsFromCombinedPct(
  combinedPct: number,
  gross: number,
  baseDollars: number,
  remainingUnallocated: number,
): number {
  const rawBreak = (combinedPct / 100) * gross - baseDollars
  const cents = Math.min(
    Math.round(remainingUnallocated * 100),
    Math.max(0, Math.round(rawBreak * 100)),
  )
  return cents / 100
}

export const BREAK_OFF_COMBINED_SLIDER_STEP_PCT = 5

/**
 * Normalize a typed break-off amount on blur: round to cents and clamp to the
 * remaining unallocated dollars — no percent-step snapping. The 5% grid is a
 * drag/keyboard affordance only; a typed amount is exact by intent (typing
 * 81,916.60 on a $123,600 job used to snap to $80,340 = the nearest 5% step).
 */
export function clampTypedBreakOffAmount(n: number, remainingUnallocated: number): number {
  const cents = Math.min(Math.round(n * 100), Math.round(remainingUnallocated * 100))
  return Math.max(0, cents) / 100
}

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
