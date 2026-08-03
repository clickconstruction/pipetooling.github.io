import type { Database } from '../../types/database'
import { formatMercuryKind } from '../mercuryKindLabels'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

/**
 * Pure kernel for the Quickfill "Bank transfers needing attribution" queue
 * (non-card ACH/wire/check money-out Mercury transactions with no attribution).
 *
 * Row shape mirrors `list_unattributed_noncard_mercury_transactions` — the RPC
 * is not in the generated `types/database.ts` (substrate shipped ahead of a
 * types regen), so this module owns the parsed row type and the client-side
 * 90-day window + display formatting. Data calls live in
 * `hooks/useQuickfillNoncardAttribution.ts`.
 */
export type NoncardAttributionQueueRow = {
  mercury_transaction_id: string
  posted_at: string | null
  /** Signed amount from Mercury — negative for money out. */
  amount: number
  kind: string
  counterparty_name: string | null
  external_memo: string | null
}

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']

/** Client-side default window: today and the 89 days before it (90 calendar days). */
export const NONCARD_QUEUE_WINDOW_DAYS = 90

/** Server cap on the list RPC (`p_limit` is clamped to 500 in SQL). */
export const NONCARD_QUEUE_LIST_LIMIT = 500

/** Defensive parse of the list RPC payload — drops malformed entries instead of throwing. */
export function parseNoncardAttributionQueueRows(data: unknown): NoncardAttributionQueueRow[] {
  if (!Array.isArray(data)) return []
  const out: NoncardAttributionQueueRow[] = []
  for (const item of data) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const id = typeof o.mercury_transaction_id === 'string' ? o.mercury_transaction_id : null
    if (!id) continue
    const amount = Number(o.amount)
    if (!Number.isFinite(amount)) continue
    out.push({
      mercury_transaction_id: id,
      posted_at: typeof o.posted_at === 'string' ? o.posted_at : null,
      amount,
      kind: typeof o.kind === 'string' ? o.kind : '',
      counterparty_name: typeof o.counterparty_name === 'string' ? o.counterparty_name : null,
      external_memo: typeof o.external_memo === 'string' ? o.external_memo : null,
    })
  }
  return out
}

/**
 * Window cutoff: UTC day-start of "now" minus 89 days, so the window covers
 * today plus the 89 previous calendar days (= NONCARD_QUEUE_WINDOW_DAYS).
 */
export function noncardQueueWindowCutoffMs(nowMs: number): number {
  const DAY_MS = 24 * 60 * 60 * 1000
  const utcDayStart = Math.floor(nowMs / DAY_MS) * DAY_MS
  return utcDayStart - (NONCARD_QUEUE_WINDOW_DAYS - 1) * DAY_MS
}

/**
 * Split newest-first rows into the default 90-day window and the older rest
 * (behind the "Show older (N more)" toggle). Order is preserved. Rows whose
 * posted_at is missing/unparseable are kept in `recent` so they are never
 * silently hidden (the RPC predicate requires posted_at, so this is defensive).
 */
export function splitNoncardQueueRowsByWindow(
  rows: NoncardAttributionQueueRow[],
  nowMs: number,
): { recent: NoncardAttributionQueueRow[]; older: NoncardAttributionQueueRow[] } {
  const cutoff = noncardQueueWindowCutoffMs(nowMs)
  const recent: NoncardAttributionQueueRow[] = []
  const older: NoncardAttributionQueueRow[] = []
  for (const r of rows) {
    const t = r.posted_at ? Date.parse(r.posted_at) : Number.NaN
    if (Number.isNaN(t) || t >= cutoff) recent.push(r)
    else older.push(r)
  }
  return { recent, older }
}

/** Money-out display: absolute dollars, e.g. -1234.5 → "$1,234.50". */
export function formatNoncardOutflowAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Math.abs(amount),
  )
}

/** Sum of absolute outflow dollars across rows. */
export function noncardQueueTotalOutflow(rows: NoncardAttributionQueueRow[]): number {
  let sum = 0
  for (const r of rows) sum += Math.abs(r.amount)
  return Math.round(sum * 100) / 100
}

/**
 * Kind label: the shared map first (`mercuryKindLabels`), else split the raw
 * Mercury camelCase API string into words ("externalTransfer" → "External Transfer").
 */
export function noncardKindLabel(kind: string): string {
  const mapped = formatMercuryKind(kind)
  if (mapped !== kind) return mapped
  const t = kind.trim()
  if (t === '') return '—'
  const spaced = t.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  return spaced
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Posted cell in the company calendar, e.g. "Tue, Apr 19, 2026". */
export function formatNoncardPostedDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return new Intl.DateTimeFormat('en-US', {
      timeZone: APP_CALENDAR_TZ,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d)
  } catch {
    return iso
  }
}

/**
 * Adapter for `MercuryTransactionAllocationsModal` (same shape-fill approach as
 * `mercuryTxRowFromTallyRpc`): the queue RPC exposes minimal fields, so the
 * mercury_transactions columns it does not return are filled with placeholders.
 * The modal only reads id/amount/posted_at/counterparty/kind/memo for display
 * and passes `id` to the split-save RPC.
 */
export function mercuryTxRowFromNoncardQueueRow(row: NoncardAttributionQueueRow): MercuryTxRow {
  const posted = row.posted_at ?? new Date().toISOString()
  return {
    id: row.mercury_transaction_id,
    amount: row.amount,
    counterparty_id: null,
    counterparty_name: row.counterparty_name,
    created_at: posted,
    currency: 'USD',
    dashboard_link: null,
    external_memo: row.external_memo,
    kind: row.kind || '—',
    mercury_account_id: '',
    mercury_category: null,
    mercury_id: '',
    note: null,
    posted_at: row.posted_at,
    raw: null,
    status: '—',
    synced_at: posted,
    source: 'mercury',
    manual_upload_id: null,
    created_by: null,
    duplicate_of_transaction_id: null,
  }
}
