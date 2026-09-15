/**
 * Lead time on a picked quote line (Submittals stage 1, PR 1c).
 *
 * The estimator types the lead time from the quote or the phone call — the
 * house's own answer only arrives through the deferred written ask (stage 3b).
 * Stored as `bid_quote_lines.lead_time_days` (0 = in stock) with the derived
 * `availability`; this kernel owns the presets the chips offer, the parse of a
 * typed value, the short label the row wears, and the patch the modal writes.
 */

import type { ReasonKind, StatusOverride } from './productStatus'

export type Availability = 'in_stock' | 'lead_time' | 'discontinued' | 'unknown'

/** The chips: In stock · 1 wk · 2 wk · 4+ wk. Anything else is typed in days. */
export const LEAD_TIME_PRESETS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 0, label: 'In stock' },
  { days: 7, label: '1 wk' },
  { days: 14, label: '2 wk' },
  { days: 28, label: '4+ wk' },
]

export const MAX_LEAD_TIME_DAYS = 730

/** "in stock" · "1 wk" · "2 wk" · "3 wk" · "6 wk" · "10 days" — null when unknown. */
export function describeLeadTime(days: number | null | undefined): string | null {
  if (days == null || !Number.isFinite(days) || days < 0) return null
  if (days === 0) return 'in stock'
  if (days % 7 === 0) return `${days / 7} wk`
  if (days > 21) return `${Math.round(days / 7)} wk`
  return `${days} day${days === 1 ? '' : 's'}`
}

/**
 * A typed lead time: "2" / "2w" / "2 wk" / "2 weeks" → 14; "10d" / "10 days" → 10;
 * "stock" / "in stock" / "0" → 0. Bare numbers ≤ 12 read as weeks (nobody types
 * a 3-day lead time by hand), larger ones as days. null when it does not parse
 * or exceeds the cap.
 */
export function parseLeadTime(text: string): number | null {
  const t = text.trim().toLowerCase()
  if (!t) return null
  if (/^(in\s*)?stock$/.test(t)) return 0
  const m = /^(\d+(?:\.\d+)?)\s*\+?\s*(w|wk|wks|week|weeks|d|day|days)?\s*\+?$/.exec(t)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n < 0) return null
  const unit = m[2] ?? ''
  const days = unit.startsWith('d') ? Math.round(n) : unit.startsWith('w') || n <= 12 ? Math.round(n * 7) : Math.round(n)
  return days > MAX_LEAD_TIME_DAYS ? null : days
}

/** 0 → in_stock; a positive lead time → lead_time; a "discontinued" reason wins; null → unknown. */
export function availabilityFor(leadTimeDays: number | null, reasonKind: ReasonKind | null): Availability {
  if (reasonKind === 'discontinued') return 'discontinued'
  if (leadTimeDays == null) return 'unknown'
  return leadTimeDays === 0 ? 'in_stock' : 'lead_time'
}

export type PickAnnotation = {
  reasonKind: ReasonKind | null
  reasonNote: string | null
  leadTimeDays: number | null
  statusOverride: StatusOverride
}

/** The `bid_quote_lines` patch for one cell's lines (every line of a kit takes it, like `picked`). */
export function pickAnnotationPatch(a: PickAnnotation): {
  alternate_reason_kind: ReasonKind | null
  alternate_reason_note: string | null
  lead_time_days: number | null
  availability: Availability | null
  product_status_override: StatusOverride
} {
  const note = a.reasonNote?.trim() || null
  const days = a.leadTimeDays != null && Number.isFinite(a.leadTimeDays) && a.leadTimeDays >= 0 ? Math.min(Math.round(a.leadTimeDays), MAX_LEAD_TIME_DAYS) : null
  const availability = availabilityFor(days, a.reasonKind)
  return {
    alternate_reason_kind: a.reasonKind,
    alternate_reason_note: note,
    lead_time_days: days,
    availability: availability === 'unknown' ? null : availability,
    product_status_override: a.statusOverride,
  }
}
