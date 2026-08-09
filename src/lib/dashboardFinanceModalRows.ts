/**
 * Mobile layout kernel for the dashboard finance drill-downs (v2.1483):
 * search, sort, and aging-chip logic shared by the AR / AP / Not Billed Out
 * ItemsModal card layout on phones. The desktop table keeps its own column
 * sort (AR header clicks); these helpers power the mobile sheet's search box,
 * "Biggest / Oldest" pills, and the color-coded aging chips that replace the
 * "(+34)" suffixes.
 */
import { daysPastDue } from './supplyHouseAging'

export type FinanceMobileSort = 'amount' | 'oldest'

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
export function sortFinanceItemsMobile<T extends SortableItem>(items: T[], mode: FinanceMobileSort): T[] {
  const out = [...items]
  if (mode === 'amount') return out.sort((a, b) => b.amount - a.amount)
  return out.sort((a, b) => {
    if (!a.dateYmd && !b.dateYmd) return b.amount - a.amount
    if (!a.dateYmd) return 1
    if (!b.dateYmd) return -1
    return a.dateYmd.localeCompare(b.dateYmd) || b.amount - a.amount
  })
}
