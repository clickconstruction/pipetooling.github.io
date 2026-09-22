/**
 * Pay run → Payments (v2.3577): one row per payment made, from `pay_stub_payments` joined to
 * its `pay_stubs` row. Pure — the window, the name-or-memo search, the method filter, the sorts,
 * the totals. The method is the row's `source_kind` (v2.3578's column, written by every Record
 * payment door since v2.3717); a row from before that is read off its memo's first words. The
 * view fetches and renders.
 */
import { PAY_SOURCE_KINDS, isPaySourceKind, paySourceKindFromMemo, paySourceLabel, type PaySourceKind } from './paySources'

export type PayRunPaymentRow = {
  id: string
  /** ISO timestamp the payment was made. */
  paidAt: string
  amount: number
  memo: string | null
  /** `pay_stub_payments.source_kind` as stored (null before the column was written). */
  sourceKind: string | null
  sourceId: string | null
  createdBy: string | null
  createdAt: string | null
  stub: { id: string; personName: string; periodStart: string; periodEnd: string }
}

export type PayRunPaymentWindow = '30d' | '90d' | 'ytd' | 'all'

export const PAY_RUN_PAYMENT_WINDOWS: ReadonlyArray<{ key: PayRunPaymentWindow; label: string }> = [
  { key: '30d', label: '30 d' },
  { key: '90d', label: '90 d' },
  { key: 'ytd', label: 'This year' },
  { key: 'all', label: 'All' },
]

function ymdAdd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const t = new Date(Date.UTC(y!, (m ?? 1) - 1, (d ?? 1) + days))
  return t.toISOString().slice(0, 10)
}

/** The first day the window includes (YYYY-MM-DD), or null for all time. */
export function paymentWindowStartYmd(window: PayRunPaymentWindow, todayYmd: string): string | null {
  if (window === 'all') return null
  if (window === 'ytd') return `${todayYmd.slice(0, 4)}-01-01`
  return ymdAdd(todayYmd, window === '30d' ? -30 : -90)
}

/** The memo-derived method, kept under its v2.3577 name; the reading itself lives with the kinds in `paySources.ts`. */
export const derivePaymentMethod = paySourceKindFromMemo

export type PaymentSource = { kind: PaySourceKind | null; /** true when the column was empty and the memo's first words said it. */ fromMemo: boolean }

/** The method a row wears: the column when it carries one, else what the memo's first words say, else nothing. */
export function paymentSource(row: Pick<PayRunPaymentRow, 'sourceKind' | 'memo'>): PaymentSource {
  if (isPaySourceKind(row.sourceKind)) return { kind: row.sourceKind, fromMemo: false }
  const kind = paySourceKindFromMemo(row.memo)
  return { kind, fromMemo: kind !== null }
}

export type PayRunMethodFilter = 'all' | PaySourceKind | 'none'

/** The filter chips, in the picker's order, ending with the rows that say nothing. */
export const PAY_RUN_METHOD_FILTERS: ReadonlyArray<{ key: PayRunMethodFilter; label: string }> = [
  { key: 'all', label: 'All methods' },
  ...PAY_SOURCE_KINDS.map((k) => ({ key: k as PayRunMethodFilter, label: paySourceLabel(k) })),
  { key: 'none', label: 'No method' },
]

/** How many rows each filter chip would keep, over the rows the window loaded. */
export function countPaymentsByMethod(rows: readonly PayRunPaymentRow[]): Record<PayRunMethodFilter, number> {
  const counts = Object.fromEntries(PAY_RUN_METHOD_FILTERS.map((f) => [f.key, 0])) as Record<PayRunMethodFilter, number>
  for (const r of rows) {
    counts.all += 1
    counts[paymentSource(r).kind ?? 'none'] += 1
  }
  return counts
}

/** Name or memo contains the query (case-insensitive) and the method matches the filter; blank query keeps everything. */
export function filterPayRunPayments(rows: readonly PayRunPaymentRow[], query: string, method: PayRunMethodFilter = 'all'): PayRunPaymentRow[] {
  const q = query.trim().toLowerCase()
  return rows.filter((r) => {
    if (method !== 'all' && (paymentSource(r).kind ?? 'none') !== method) return false
    if (!q) return true
    return r.stub.personName.toLowerCase().includes(q) || (r.memo ?? '').toLowerCase().includes(q)
  })
}

export type PayRunPaymentSortKey = 'paid' | 'person' | 'period' | 'amount' | 'method' | 'memo' | 'recorded'
export const PAY_RUN_PAYMENT_SORT_KEYS: readonly PayRunPaymentSortKey[] = ['paid', 'person', 'period', 'amount', 'method', 'memo', 'recorded']
export type SortDir = 'asc' | 'desc'

/** The direction a header opens with: dates and amounts newest / largest first, text A → Z. */
export function defaultSortDir(key: PayRunPaymentSortKey): SortDir {
  return key === 'paid' || key === 'amount' || key === 'period' || key === 'recorded' ? 'desc' : 'asc'
}

/** Sort a copy; ties break by paid-at newest first so the order is stable across clicks. */
export function sortPayRunPayments(rows: readonly PayRunPaymentRow[], key: PayRunPaymentSortKey, dir: SortDir): PayRunPaymentRow[] {
  const cmpStr = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' })
  const primary = (a: PayRunPaymentRow, b: PayRunPaymentRow): number => {
    switch (key) {
      case 'paid':
        return a.paidAt.localeCompare(b.paidAt)
      case 'person':
        return cmpStr(a.stub.personName, b.stub.personName)
      case 'period':
        return a.stub.periodStart.localeCompare(b.stub.periodStart)
      case 'amount':
        return a.amount - b.amount
      case 'method':
        return cmpStr(paySourceLabel(paymentSource(a).kind), paySourceLabel(paymentSource(b).kind))
      case 'memo':
        return cmpStr(a.memo ?? '', b.memo ?? '')
      case 'recorded':
        return (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
    }
  }
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const p = primary(a, b)
    if (p !== 0) return p * sign
    return b.paidAt.localeCompare(a.paidAt)
  })
}

export type PayRunPaymentTotals = { count: number; sumUsd: number; people: number; newestYmd: string | null }

export function payRunPaymentTotals(rows: readonly PayRunPaymentRow[]): PayRunPaymentTotals {
  let sum = 0
  const people = new Set<string>()
  let newest: string | null = null
  for (const r of rows) {
    sum += r.amount
    people.add(r.stub.personName.trim().toLowerCase())
    const ymd = r.paidAt.slice(0, 10)
    if (!newest || ymd > newest) newest = ymd
  }
  return { count: rows.length, sumUsd: Math.round(sum * 100) / 100, people: people.size, newestYmd: newest }
}

/** "31 payments · $8,417.32 in the last 90 days · 12 people · newest Sep 16". */
export function payRunPaymentsSummaryLine(t: PayRunPaymentTotals, window: PayRunPaymentWindow, money: (n: number) => string, shortDate: (ymd: string) => string): string {
  if (t.count === 0) return window === 'all' ? 'no payments recorded' : 'no payments in this window'
  const span = window === '30d' ? 'in the last 30 days' : window === '90d' ? 'in the last 90 days' : window === 'ytd' ? 'this year' : 'all time'
  const parts = [`${t.count} ${t.count === 1 ? 'payment' : 'payments'} · ${money(t.sumUsd)} ${span}`, `${t.people} ${t.people === 1 ? 'person' : 'people'}`]
  if (t.newestYmd) parts.push(`newest ${shortDate(t.newestYmd)}`)
  return parts.join(' · ')
}
