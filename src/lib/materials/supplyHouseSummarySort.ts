/**
 * Materials → Supply Houses: the summary table's sort (v2.3604 — the May follow-up "Last Paid
 * sortable", widened to every column). One rule for the order, one for what a header click
 * does, one for the remembered pick. Nulls sort last in both directions; ties break by name.
 */
export type SupplyHouseSummarySortKey = 'name' | 'outstanding' | 'due' | 'updated' | 'lastPaid'
export type SupplyHouseSummarySort = { key: SupplyHouseSummarySortKey; dir: 'asc' | 'desc' }

export type SupplyHouseSummarySortable = {
  name: string
  outstanding: number
  monthlyPaymentDay: number | null
  lastInvoiceUpdatedAt: string | null
  lastInvoicePaidAt: string | null
}

export const DEFAULT_SUPPLY_HOUSE_SUMMARY_SORT: SupplyHouseSummarySort = { key: 'outstanding', dir: 'desc' }

const KEYS: ReadonlySet<string> = new Set(['name', 'outstanding', 'due', 'updated', 'lastPaid'])

/** The direction a column starts in: names read A→Z, money and dates newest / biggest first. */
export const firstDirFor = (key: SupplyHouseSummarySortKey): 'asc' | 'desc' => (key === 'name' ? 'asc' : 'desc')

const valueOf = (r: SupplyHouseSummarySortable, key: SupplyHouseSummarySortKey): string | number | null => {
  switch (key) {
    case 'name':
      return r.name.toLowerCase()
    case 'outstanding':
      return r.outstanding
    case 'due':
      return r.monthlyPaymentDay
    case 'updated':
      return r.lastInvoiceUpdatedAt
    case 'lastPaid':
      return r.lastInvoicePaidAt
  }
}

export function sortSupplyHouseSummary<T extends SupplyHouseSummarySortable>(rows: ReadonlyArray<T>, sort: SupplyHouseSummarySort): T[] {
  const sign = sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const av = valueOf(a, sort.key)
    const bv = valueOf(b, sort.key)
    if (av == null && bv == null) return a.name.localeCompare(b.name)
    if (av == null) return 1
    if (bv == null) return -1
    const c = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
    return c !== 0 ? c * sign : a.name.localeCompare(b.name)
  })
}

/** A header click: the same column flips; another column starts in its natural direction. */
export function nextSupplyHouseSummarySort(current: SupplyHouseSummarySort, key: SupplyHouseSummarySortKey): SupplyHouseSummarySort {
  if (current.key === key) return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
  return { key, dir: firstDirFor(key) }
}

/** The remembered pick (`"outstanding:desc"`); anything else is the default. */
export function parseSupplyHouseSummarySort(raw: string | null | undefined): SupplyHouseSummarySort {
  if (!raw) return DEFAULT_SUPPLY_HOUSE_SUMMARY_SORT
  const [key, dir] = raw.split(':')
  if (!key || !KEYS.has(key) || (dir !== 'asc' && dir !== 'desc')) return DEFAULT_SUPPLY_HOUSE_SUMMARY_SORT
  return { key: key as SupplyHouseSummarySortKey, dir }
}

export const serializeSupplyHouseSummarySort = (s: SupplyHouseSummarySort): string => `${s.key}:${s.dir}`

export const ariaSortFor = (sort: SupplyHouseSummarySort, key: SupplyHouseSummarySortKey): 'ascending' | 'descending' | 'none' =>
  sort.key !== key ? 'none' : sort.dir === 'asc' ? 'ascending' : 'descending'
