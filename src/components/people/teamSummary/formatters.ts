// Pure formatting helpers used across the inline Team Summary surface.
//
// Mirrors the `escH`, `fmtH`, `fmtPct`, `fmtPct1`, `fmtMoney`,
// `fmtMoneyPerHr`, `dowShort`, and `dayHeaderLabel` helpers that lived
// inside the iframe IIFE in `People.tsx`. React handles HTML-escaping
// for us in JSX, so `escH` is unnecessary — text content goes straight
// through `{value}`.

import type {
  TeamSummaryBreakdown,
  TeamSummaryRow,
  PayConfigSource,
} from './types'

/** "1,248.1" — one decimal, with en-US thousands separators. */
export function fmtH(n: number): string {
  return (Math.round(n * 10) / 10).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

/** Whole percent, e.g. "75%". */
export function fmtPct(n: number): string {
  return `${Math.round(n)}%`
}

/** One-decimal percent, e.g. "12.5%". */
export function fmtPct1(n: number): string {
  return `${(Math.round(n * 10) / 10).toFixed(1)}%`
}

/**
 * Money formatter — rounds to whole dollars and uses en-US thousands
 * separators. Negative values render with a leading "-$" rather than
 * the locale-default "($)" notation so they read as accounting deltas.
 */
export function fmtMoney(n: number): string {
  return `${n < 0 ? '-$' : '$'}${Math.round(Math.abs(n)).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`
}

/** Money per hour, e.g. "$45/hr". */
export function fmtMoneyPerHr(n: number): string {
  return `${fmtMoney(n)}/hr`
}

/** Three-letter day-of-week from "YYYY-MM-DD"; "" on bad input. */
export function dowShort(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  // Local-noon parse to dodge UTC drift, e.g. 2026-05-12T12:00:00.
  const dt = new Date(`${dateStr}T12:00:00`)
  if (Number.isNaN(dt.getTime())) return ''
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()] ?? ''
}

/** "Mon 2026-05-12"; weekday omitted when `dateStr` is invalid. */
export function dayHeaderLabel(dateStr: string): string {
  const dow = dowShort(dateStr)
  return (dow ? `${dow} ` : '') + dateStr
}

/**
 * Enrich a raw `TeamSummaryRow[]` (from `loadTeamSummaryData()`) with the
 * derived `profitAfterOverhead`, `profitPerHourAfterOverhead`, and the
 * payConfig source classification used by the modals. Sorts the result
 * by Profit (after overhead) desc — matching the default sort baked into
 * the table.
 */
export function enrichTeamSummaryRowsForInline(
  rows: TeamSummaryRow[],
  partsRate: number | null,
  payConfigSourceForName: (name: string) => PayConfigSource,
): TeamSummaryBreakdown[] {
  const enriched = rows.map((r) => {
    // Split overhead model:
    //  • Overhead labor  — this person's OWN office + bid wages
    //    (`overheadLaborCost`, already stored negative) — charged directly.
    //  • Overhead burden — this person's field-hour share of the NON-labor
    //    overhead pool (office parts) at `partsRate` $/field hour, stored
    //    negative so it reads as a cost.
    // Profit (after overhead) = Net − own overhead labor − overhead burden.
    // Office/bid labor and office parts are disjoint, so summed across the
    // team the two deductions reconcile to the overhead pool exactly once
    // (no double-count). `partsRate` is null until the 90-day rate loads.
    const overheadBurden =
      partsRate != null ? -(r.fieldHours * partsRate) : null
    const profitAfterOverhead =
      overheadBurden != null ? r.profit + r.overheadLaborCost + overheadBurden : null
    const profitPerHourAfterOverhead =
      profitAfterOverhead != null && r.totalHours > 0
        ? profitAfterOverhead / r.totalHours
        : null
    return { ...r, profitAfterOverhead, profitPerHourAfterOverhead, overheadBurden }
  })
  // Default order: profit desc, name asc on tie. Matches the iframe's
  // pre-render sort (sortedRows) and the table's initial sort key.
  enriched.sort(
    (a, b) => b.profit - a.profit || a.personName.localeCompare(b.personName),
  )
  return enriched.map((r, i) => ({
    idx: i,
    name: r.personName,
    hb: r.hoursBreakdown,
    gb: r.grossBreakdown,
    nb: r.netBreakdown,
    pb: r.profitBreakdown,
    totalHours: r.totalHours,
    overheadHours: r.overheadHours,
    officeHours: r.officeHours,
    bidHours: r.bidHours,
    fieldHours: r.fieldHours,
    hourlyWage: r.hourlyWage,
    overheadLaborCost: r.overheadLaborCost,
    overheadSessions: r.overheadSessions,
    gross: r.gross,
    net: r.profit,
    profitAfterOverhead: r.profitAfterOverhead,
    overheadBurden: r.overheadBurden,
    revPerHour: r.revPerHour,
    netPerHour: r.profitPerHour,
    profitPerHourAfterOverhead: r.profitPerHourAfterOverhead,
    payConfigSource: payConfigSourceForName(r.personName),
  }))
}
