/**
 * Layout kernel for the dashboard finance drill-downs (v2.1483 mobile,
 * v2.1484 desktop):
 * search, sort, aging-chip, and aging-bucket logic shared by the AR / AP /
 * Not Billed Out ItemsModal on every screen size: the mobile sheet's and
 * desktop table's search box, "Biggest / Oldest" pills, the color-coded
 * aging chips that replaced the "(+34)" suffixes, and the desktop aging
 * summary strip ("0–14d $X · 15–30d $Y · 30d+ $Z").
 */
import { daysPastDue } from './supplyHouseAging'

export type FinanceDrillSort = 'amount' | 'oldest'

export type FinanceAgingTone = 'ok' | 'warn' | 'late'

/** Days since dateYmd as of todayYmd, or null when there's no date / not in the past. */
export function financeAgingDays(dateYmd: string | null | undefined, todayYmd: string): number | null {
  if (!dateYmd) return null
  const days = daysPastDue(dateYmd, todayYmd)
  return Number.isFinite(days) && days > 0 ? days : null
}

/** Chip color semantics: under 15 days quiet green, 15–30 amber, past 30 red. */
export function financeAgingTone(days: number): FinanceAgingTone {
  return days > 30 ? 'late' : days >= 15 ? 'warn' : 'ok'
}

type SearchableItem = { label: string; sublabel: string | null }

/** Case-insensitive substring match over label + sublabel; empty query returns the same array. */
export function filterFinanceItems<T extends SearchableItem>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((i) => `${i.label} ${i.sublabel ?? ''}`.toLowerCase().includes(q))
}

type SortableItem = { amount: number; dateYmd: string | null }

/**
 * 'amount' = biggest first (the buckets' native order); 'oldest' = earliest
 * date first with undated items last — amount desc breaks ties in both modes
 * so the order is stable and money-first within a day.
 */
export function sortFinanceItems<T extends SortableItem>(
  items: T[],
  mode: FinanceDrillSort,
  /** Override the date used for 'oldest' — AP rows age by the bill's DUE date, not the row date. */
  getYmd?: (item: T) => string | null,
): T[] {
  const out = [...items]
  if (mode === 'amount') return out.sort((a, b) => b.amount - a.amount)
  const ymd = (i: T) => (getYmd ? getYmd(i) : i.dateYmd)
  return out.sort((a, b) => {
    const ay = ymd(a)
    const by = ymd(b)
    if (!ay && !by) return b.amount - a.amount
    if (!ay) return 1
    if (!by) return -1
    return ay.localeCompare(by) || b.amount - a.amount
  })
}

export type FinanceAgingBuckets = Record<FinanceAgingTone, { count: number; total: number }>

/**
 * Totals per aging tone for the desktop summary strip. Items with no date or
 * not yet past it carry no age and land in no bucket — the strip answers
 * "how much is old?", and fresh money isn't old.
 */
export function financeAgingBuckets(
  items: Array<{ amount: number; ymd: string | null }>,
  todayYmd: string,
): FinanceAgingBuckets {
  const out: FinanceAgingBuckets = {
    ok: { count: 0, total: 0 },
    warn: { count: 0, total: 0 },
    late: { count: 0, total: 0 },
  }
  for (const item of items) {
    const days = financeAgingDays(item.ymd, todayYmd)
    if (days == null) continue
    const tone = financeAgingTone(days)
    out[tone].count++
    out[tone].total += item.amount
  }
  return out
}
