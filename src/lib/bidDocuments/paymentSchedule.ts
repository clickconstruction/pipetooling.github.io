/**
 * Pure helpers for the Cover Letter Schedule of Values (payment schedule).
 *
 * A schedule row = a payment timing (before start, before/after Rough In / Top Out / Trim Set)
 * + a percent of the contract amount. Rows persist in `bid_payment_schedule_rows`; the per-bid
 * opt-in flag is `bids.include_payment_schedule`. No DOM, React, or Supabase access.
 */

import { formatCurrency } from '../format'

export type PaymentScheduleTiming =
  | 'before_start'
  | 'before_rough_in'
  | 'after_rough_in'
  | 'before_top_out'
  | 'after_top_out'
  | 'before_trim_set'
  | 'after_trim_set'

/** Dropdown order for the timing picker. */
export const PAYMENT_SCHEDULE_TIMINGS: PaymentScheduleTiming[] = [
  'before_start',
  'before_rough_in',
  'after_rough_in',
  'before_top_out',
  'after_top_out',
  'before_trim_set',
  'after_trim_set',
]

export const PAYMENT_SCHEDULE_TIMING_LABELS: Record<PaymentScheduleTiming, string> = {
  before_start: 'before start',
  before_rough_in: 'before Rough In',
  after_rough_in: 'after Rough In',
  before_top_out: 'before Top Out',
  after_top_out: 'after Top Out',
  before_trim_set: 'before Trim Set',
  after_trim_set: 'after Trim Set',
}

/**
 * `timing` is `string` (not the union) because rows arrive from the database: a timing added in
 * SQL before the client knows it must render as its raw value, never crash.
 */
export type PaymentScheduleRowInput = { timing: string; percent: number }

/** The company standard 30/30/30/10: 30% before each phase, 10% retainage after Trim Set. */
export const DEFAULT_PAYMENT_SCHEDULE_ROWS: { timing: PaymentScheduleTiming; percent: number }[] = [
  { timing: 'before_rough_in', percent: 30 },
  { timing: 'before_top_out', percent: 30 },
  { timing: 'before_trim_set', percent: 30 },
  { timing: 'after_trim_set', percent: 10 },
]

export function paymentScheduleTimingLabel(timing: string): string {
  return (PAYMENT_SCHEDULE_TIMING_LABELS as Record<string, string>)[timing] ?? timing
}

export function paymentSchedulePercentTotal(rows: PaymentScheduleRowInput[]): number {
  return rows.reduce((sum, r) => sum + (Number.isFinite(r.percent) ? r.percent : 0), 0)
}

/** 30 -> '30%', 12.5 -> '12.5%' (no trailing zeros). */
export function formatPaymentSchedulePercent(percent: number): string {
  if (!Number.isFinite(percent)) return '0%'
  const rounded = Math.round(percent * 100) / 100
  return `${rounded}%`
}

export function computePaymentScheduleLines(
  rows: PaymentScheduleRowInput[],
  amountDollars: number,
): { label: string; percent: number; amountFormatted: string; line: string }[] {
  return rows.map((r) => {
    const label = paymentScheduleTimingLabel(r.timing)
    const percent = Number.isFinite(r.percent) ? r.percent : 0
    const amountFormatted = `$${formatCurrency((amountDollars * percent) / 100)}`
    return {
      label,
      percent,
      amountFormatted,
      line: `Due ${label}: ${formatPaymentSchedulePercent(percent)} — ${amountFormatted}`,
    }
  })
}

/**
 * The letter section shared by the HTML and text builders: a 'Schedule of Values:' heading
 * followed by one line per row, or [] when there are no rows (section omitted entirely).
 */
export function buildPaymentScheduleSectionLines(
  rows: PaymentScheduleRowInput[],
  amountDollars: number,
): string[] {
  if (rows.length === 0) return []
  return ['Schedule of Values:', ...computePaymentScheduleLines(rows, amountDollars).map((l) => l.line)]
}
