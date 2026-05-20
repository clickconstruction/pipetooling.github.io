import type { Database } from '../types/database'

export type MercuryLedgerSortKey = 'posted_at' | 'counterparty_name' | 'amount'
export type MercuryLedgerSortDir = 'asc' | 'desc'

export type MercuryLedgerSortState = {
  key: MercuryLedgerSortKey
  dir: MercuryLedgerSortDir
}

export type MercuryLedgerSortRow = Pick<
  Database['public']['Tables']['mercury_transactions']['Row'],
  'id' | 'posted_at' | 'created_at' | 'counterparty_name' | 'amount'
>

export const DEFAULT_MERCURY_LEDGER_SORT: MercuryLedgerSortState = {
  key: 'posted_at',
  dir: 'desc',
}

/** First click defaults: date desc, name asc, amount desc (largest first). */
export function nextMercuryLedgerSortState(
  current: MercuryLedgerSortState,
  next: MercuryLedgerSortKey,
): MercuryLedgerSortState {
  if (current.key !== next) {
    if (next === 'counterparty_name') return { key: next, dir: 'asc' }
    return { key: next, dir: 'desc' }
  }
  return { key: next, dir: current.dir === 'desc' ? 'asc' : 'desc' }
}

export function compareMercuryLedgerRows(
  a: MercuryLedgerSortRow,
  b: MercuryLedgerSortRow,
  key: MercuryLedgerSortKey,
  dir: MercuryLedgerSortDir,
): number {
  let cmp = 0
  if (key === 'posted_at') {
    const aIso = a.posted_at ?? a.created_at ?? ''
    const bIso = b.posted_at ?? b.created_at ?? ''
    cmp = aIso.localeCompare(bIso)
  } else if (key === 'counterparty_name') {
    const aN = a.counterparty_name?.trim() ?? ''
    const bN = b.counterparty_name?.trim() ?? ''
    if (aN === '' && bN !== '') return 1
    if (bN === '' && aN !== '') return -1
    cmp = aN.localeCompare(bN, undefined, { sensitivity: 'base' })
  } else if (key === 'amount') {
    const aA = Number.isFinite(a.amount) ? a.amount : 0
    const bA = Number.isFinite(b.amount) ? b.amount : 0
    cmp = aA - bA
  }
  if (cmp === 0) {
    cmp = a.id.localeCompare(b.id)
  }
  return dir === 'desc' ? -cmp : cmp
}

export function parseMercuryLedgerSortJson(raw: string | null): MercuryLedgerSortState {
  const def = DEFAULT_MERCURY_LEDGER_SORT
  if (raw == null || raw.trim() === '') return def
  try {
    const v = JSON.parse(raw) as unknown
    if (v == null || typeof v !== 'object' || Array.isArray(v)) return def
    const o = v as Record<string, unknown>
    const keyValid =
      o.key === 'posted_at' || o.key === 'counterparty_name' || o.key === 'amount'
    const dirValid = o.dir === 'asc' || o.dir === 'desc'
    if (!keyValid || !dirValid) return def
    return {
      key: o.key as MercuryLedgerSortKey,
      dir: o.dir as MercuryLedgerSortDir,
    }
  } catch {
    return def
  }
}
