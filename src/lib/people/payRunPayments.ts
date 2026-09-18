/**
 * Pay run → Payments (v2.3577): one row per payment made, from `pay_stub_payments` joined to
 * its `pay_stubs` row. Pure — the window, the name-or-memo search, the sorts, the totals, and
 * the method chip derived from the memo (there is no method column; the office types
 * "Cash App #D-…", "CashApp", "Mercury", or a note). The view fetches and renders.
 */

export type PayRunPaymentRow = {
  id: string
  /** ISO timestamp the payment was made. */
  paidAt: string
  amount: number
  memo: string | null
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

export type PaymentMethod = 'cash-app' | 'apple-pay' | 'mercury' | 'check' | 'client'

/**
 * A chip read off the memo's words. "Cash App #…", "CashApp", "cashapp advance" → Cash App;
 * "Mercury" → Mercury; "check …" → check; "client …", "paid via client …" → client-direct.
 * Anything else → null (no chip). Deliberately a whole-word test at the start of the memo or
 * after "via", so a note that merely mentions a client's balance does not become a method.
 */
export function derivePaymentMethod(memo: string | null | undefined): PaymentMethod | null {
  const m = (memo ?? '').trim().toLowerCase()
  if (!m) return null
  if (/^cash\s?app\b/.test(m)) return 'cash-app'
  if (/^apple\s?(pay|cash|wallet)\b/.test(m)) return 'apple-pay'
  if (/^mercury\b/.test(m)) return 'mercury'
  if (/^(check|cheque|ck)\b/.test(m)) return 'check'
  if (/^(paid\s+)?(via|by|from)\s+client\b/.test(m) || /^client\b/.test(m)) return 'client'
  return null
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = { 'cash-app': 'Cash App', 'apple-pay': 'Apple Pay', mercury: 'Mercury', check: 'Check', client: 'Client-direct' }

/** Name or memo contains the query (case-insensitive); blank keeps everything. */
export function filterPayRunPayments(rows: readonly PayRunPaymentRow[], query: string): PayRunPaymentRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...rows]
  return rows.filter((r) => r.stub.personName.toLowerCase().includes(q) || (r.memo ?? '').toLowerCase().includes(q))
}

export type PayRunPaymentSortKey = 'paid' | 'person' | 'period' | 'amount' | 'memo' | 'recorded'
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
