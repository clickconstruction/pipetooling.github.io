/**
 * "Their Word" PR 3 — the reliability line under every Billed row.
 *
 * Two readings that never say "never asked":
 *   - the pay-speed SPREAD ("Pays in 9–41d") from the receipts the pay-speed
 *     RPC already returns — capture-free, on every customer with two or more
 *     measurable payments;
 *   - the promise record ("keeps 3 of 7 · slips ~9d") from the classified
 *     promise events, when any exist.
 * Plus a six-bar sparkline of the customer's last bills, and the forecast's
 * slip adjustment: a promised date moved by the customer's usual slip.
 *
 * Pure: no React, no supabase.
 */

import type { PayReceipt } from './billedExpectedPay'
import { formatKeptRecord, formatUsualSlip, type CustomerPromiseRecord } from './paymentPromises'

/** Bars in the sparkline: the customer's most recent measurable bills. */
export const RELIABILITY_SPARK_BARS = 6
/** Fewer measurable payments than this and there is no spread to show. */
export const RELIABILITY_MIN_RECEIPTS = 2

export type PaySpeedSpread = {
  /** Typical fast end (25th percentile; the minimum with < 4 samples). */
  loDays: number
  /** Typical slow end (75th percentile; the maximum with < 4 samples). */
  hiDays: number
  medianDays: number
  samples: number
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]!
  const w = idx - lo
  return sorted[lo]! * (1 - w) + sorted[hi]! * w
}

/** The customer's typical range of days from bill to money, from their measurable receipts. */
export function paySpeedSpread(receipts: ReadonlyArray<PayReceipt> | null | undefined): PaySpeedSpread | null {
  const gaps = (receipts ?? []).map((r) => r.gapDays).filter((g) => Number.isFinite(g) && g >= 0).sort((a, b) => a - b)
  if (gaps.length < RELIABILITY_MIN_RECEIPTS) return null
  const wide = gaps.length >= 4
  const lo = wide ? percentile(gaps, 0.25) : gaps[0]!
  const hi = wide ? percentile(gaps, 0.75) : gaps[gaps.length - 1]!
  return { loDays: Math.round(lo), hiDays: Math.round(hi), medianDays: Math.round(percentile(gaps, 0.5)), samples: gaps.length }
}

/** "Pays in 9–41d" · "Pays in ~30d" when the range collapses · null with too little history. */
export function formatPaysIn(spread: PaySpeedSpread | null): string | null {
  if (!spread) return null
  if (spread.loDays === spread.hiDays) return `Pays in ~${spread.loDays}d`
  return `Pays in ${spread.loDays}–${spread.hiDays}d`
}

export type ReliabilityBar = {
  /** Days from bill to money. */
  gapDays: number
  /** Bar height 0–1 relative to the tallest of the shown bars. */
  height: number
  /** 'fast' ≤ median · 'slow' ≤ 1.5× median · 'late' beyond. */
  tone: 'fast' | 'slow' | 'late'
  paidYmd: string
}

/** The last N measurable bills, oldest → newest, scaled for a sparkline. No spread (one payment) → no bars: a lone bar says nothing. */
export function reliabilityBars(receipts: ReadonlyArray<PayReceipt> | null | undefined, spread: PaySpeedSpread | null): ReliabilityBar[] {
  if (!spread) return []
  const recent = (receipts ?? []).filter((r) => Number.isFinite(r.gapDays) && r.gapDays >= 0).slice(0, RELIABILITY_SPARK_BARS).slice().reverse()
  if (!recent.length) return []
  const max = Math.max(1, ...recent.map((r) => r.gapDays))
  const median = spread?.medianDays ?? max
  return recent.map((r) => ({
    gapDays: r.gapDays,
    height: Math.max(0.12, r.gapDays / max),
    tone: r.gapDays <= median ? 'fast' : r.gapDays <= median * 1.5 ? 'slow' : 'late',
    paidYmd: r.paidYmd,
  }))
}

export type ReliabilityLine = {
  paysIn: string | null
  kept: string | null
  slip: string | null
  bars: ReliabilityBar[]
  /** Everything joined with " · " — empty when nothing is known. */
  text: string
  /** Hover text spelling out the sources. */
  title: string
}

/**
 * One line per Billed row. `record` is the customer's promise record when
 * promises exist and the viewer may see it (office roles); pass null for
 * primary, who sees the spread only.
 */
export function buildReliabilityLine(receipts: ReadonlyArray<PayReceipt> | null | undefined, record: CustomerPromiseRecord | null | undefined): ReliabilityLine {
  const spread = paySpeedSpread(receipts)
  const paysIn = formatPaysIn(spread)
  const kept = record ? formatKeptRecord(record) : null
  const slip = record ? formatUsualSlip(record) : null
  const parts = [paysIn, kept, slip].filter((x): x is string => x != null)
  const titleParts: string[] = []
  if (spread) titleParts.push(`Days from bill to money over their last ${spread.samples} measurable payments (last 12 months): typically ${spread.loDays}–${spread.hiDays}, median ${spread.medianDays}.`)
  if (record && record.decided > 0) titleParts.push(`Promises: ${record.kept} kept, ${record.late} late, ${record.broken} broken${record.open ? `, ${record.open} open` : ''}${record.usualSlipDays != null && record.usualSlipDays >= 1 ? ` — money usually lands ~${Math.round(record.usualSlipDays)} days after the date they give` : ''}.`)
  else if (record && record.open > 0) titleParts.push(`${record.open} promise${record.open === 1 ? '' : 's'} open, none decided yet.`)
  return { paysIn, kept, slip, bars: reliabilityBars(receipts, spread), text: parts.join(' · '), title: titleParts.join(' ') }
}

/**
 * The forecast's honest date for a promise: the promised day moved by the
 * customer's usual slip (rounded, never negative). No slip → the promise.
 */
export function slipAdjustedYmd(promisedYmd: string, usualSlipDays: number | null | undefined): string {
  const slip = usualSlipDays != null && Number.isFinite(usualSlipDays) ? Math.max(0, Math.round(usualSlipDays)) : 0
  if (!slip) return promisedYmd
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(promisedYmd)
  if (!m) return promisedYmd
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12))
  d.setUTCDate(d.getUTCDate() + slip)
  return d.toISOString().slice(0, 10)
}
