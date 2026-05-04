import type { Database } from '../types/database'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import { resolveAccountingRuleAmountBounds } from './accountingLabelRuleMatch'
import type { MercuryJobSplit } from '../components/MercuryTransactionAllocationsModal'

export type BankingAccountingLedgerFiltersV1 = {
  v: 1
  /** Inclusive start `YYYY-MM-DD` in company calendar TZ; empty = no lower bound */
  postedFromYmd: string
  /** Inclusive end `YYYY-MM-DD`; empty = no upper bound */
  postedToYmd: string
  amountMin: number | null
  amountMax: number | null
  jobSplit: 'any' | 'has' | 'none'
  personUnassignedOnly: boolean
  /** API `kind` values; empty = any type */
  kinds: string[]
  /** Case-insensitive substring matches on `counterparty_name`; row excluded if any phrase matches */
  excludeCounterpartyContains: string[]
}

export type BankingAccountingLedgerFilterTx = Pick<
  Database['public']['Tables']['mercury_transactions']['Row'],
  'id' | 'amount' | 'posted_at' | 'kind' | 'counterparty_name'
>

export type BankingAccountingLedgerFilterCtx = {
  allocationsByTxId: Map<string, MercuryJobSplit[]>
  personIdByTxId: Map<string, string | null>
  userIdByTxId: Map<string, string | null>
}

export function defaultBankingAccountingLedgerFilters(): BankingAccountingLedgerFiltersV1 {
  return {
    v: 1,
    postedFromYmd: '',
    postedToYmd: '',
    amountMin: null,
    amountMax: null,
    jobSplit: 'any',
    personUnassignedOnly: false,
    kinds: [],
    excludeCounterpartyContains: [],
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
}

function parseKindsFromJson(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out = new Set<string>()
  for (const x of raw) {
    if (typeof x !== 'string') continue
    const t = x.trim()
    if (t !== '') out.add(t)
  }
  return [...out].sort()
}

function kindsArrayEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  for (let i = 0; i < sa.length; i += 1) {
    if (sa[i] !== sb[i]) return false
  }
  return true
}

/** Max phrases stored / applied for exclude counterparty (localStorage and UI). */
export const LEDGER_FILTER_EXCLUDE_COUNTERPARTY_PHRASES_MAX = 50

function parseExcludeCounterpartyContainsFromJson(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out = new Set<string>()
  for (const x of raw) {
    if (typeof x !== 'string') continue
    const t = x.trim()
    if (t !== '') out.add(t)
  }
  return [...out].sort().slice(0, LEDGER_FILTER_EXCLUDE_COUNTERPARTY_PHRASES_MAX)
}

/** Normalize textarea lines: trim, drop empty, dedupe case-insensitively (first spelling kept), cap, sort. */
export function normalizeExcludeCounterpartyContainsFromLines(text: string): string[] {
  const lines = text.split(/\r?\n/)
  const seenLower = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (t === '') continue
    const lk = t.toLowerCase()
    if (seenLower.has(lk)) continue
    seenLower.add(lk)
    out.push(t)
    if (out.length >= LEDGER_FILTER_EXCLUDE_COUNTERPARTY_PHRASES_MAX) break
  }
  return out.sort()
}

/** When every available kind is selected, treat as no filter (no badge). */
export function ledgerFilterKindsEquivalentToAllSelected(
  selected: readonly string[],
  availableKinds: readonly string[],
): boolean {
  if (availableKinds.length === 0) return false
  const set = new Set(selected)
  if (set.size !== availableKinds.length) return false
  return availableKinds.every((k) => set.has(k))
}

/** Clear `kinds` if selection covers all `availableKinds` (same persistence as default). */
export function withLedgerFilterKindsNormalizedIfAllSelected(
  f: BankingAccountingLedgerFiltersV1,
  availableKinds: string[],
): BankingAccountingLedgerFiltersV1 {
  if (availableKinds.length === 0 || f.kinds.length === 0) return f
  if (!ledgerFilterKindsEquivalentToAllSelected(f.kinds, availableKinds)) return f
  return { ...f, kinds: [] }
}

/** Safe parse for localStorage JSON; returns defaults when invalid. */
export function parseBankingAccountingLedgerFiltersJson(raw: string | null): BankingAccountingLedgerFiltersV1 {
  const def = defaultBankingAccountingLedgerFilters()
  if (raw == null || raw.trim() === '') return def
  try {
    const v = JSON.parse(raw) as unknown
    if (!isRecord(v) || v.v !== 1) return def
    const postedFromYmd = typeof v.postedFromYmd === 'string' ? v.postedFromYmd.trim() : ''
    const postedToYmd = typeof v.postedToYmd === 'string' ? v.postedToYmd.trim() : ''
    let amountMin: number | null = null
    let amountMax: number | null = null
    if (v.amountMin !== undefined && v.amountMin !== null) {
      const n = Number(v.amountMin)
      if (Number.isFinite(n)) amountMin = n
    }
    if (v.amountMax !== undefined && v.amountMax !== null) {
      const n = Number(v.amountMax)
      if (Number.isFinite(n)) amountMax = n
    }
    let jobSplit: 'any' | 'has' | 'none' = 'any'
    if (v.jobSplit === 'has' || v.jobSplit === 'none') jobSplit = v.jobSplit
    const personUnassignedOnly = v.personUnassignedOnly === true
    const kinds = parseKindsFromJson(v.kinds)
    const excludeCounterpartyContains = parseExcludeCounterpartyContainsFromJson(v.excludeCounterpartyContains)
    return {
      v: 1,
      postedFromYmd,
      postedToYmd,
      amountMin,
      amountMax,
      jobSplit,
      personUnassignedOnly,
      kinds,
      excludeCounterpartyContains,
    }
  } catch {
    return def
  }
}

export function bankingAccountingLedgerFiltersEqual(
  a: BankingAccountingLedgerFiltersV1,
  b: BankingAccountingLedgerFiltersV1,
): boolean {
  return (
    a.postedFromYmd === b.postedFromYmd &&
    a.postedToYmd === b.postedToYmd &&
    a.amountMin === b.amountMin &&
    a.amountMax === b.amountMax &&
    a.jobSplit === b.jobSplit &&
    a.personUnassignedOnly === b.personUnassignedOnly &&
    kindsArrayEqual(a.kinds, b.kinds) &&
    kindsArrayEqual(a.excludeCounterpartyContains, b.excludeCounterpartyContains)
  )
}

/** Number of non-default dimensions (for toolbar badge). */
export function activeBankingAccountingLedgerFilterCount(f: BankingAccountingLedgerFiltersV1): number {
  let n = 0
  if (f.postedFromYmd.trim() !== '') n += 1
  if (f.postedToYmd.trim() !== '') n += 1
  if (f.amountMin != null) n += 1
  if (f.amountMax != null) n += 1
  if (f.jobSplit !== 'any') n += 1
  if (f.personUnassignedOnly) n += 1
  if (f.kinds.length > 0) n += 1
  if (f.excludeCounterpartyContains.length > 0) n += 1
  return n
}

export function isDefaultBankingAccountingLedgerFilters(f: BankingAccountingLedgerFiltersV1): boolean {
  return activeBankingAccountingLedgerFilterCount(f) === 0
}

export function applyBankingAccountingLedgerFilters(
  tx: BankingAccountingLedgerFilterTx,
  f: BankingAccountingLedgerFiltersV1,
  ctx: BankingAccountingLedgerFilterCtx,
): boolean {
  const from = f.postedFromYmd.trim()
  const to = f.postedToYmd.trim()
  if (from !== '' || to !== '') {
    const iso = tx.posted_at
    if (iso == null || iso === '') return false
    const ymd = calendarYmdInAppTzFromIso(iso)
    if (ymd === '') return false
    if (from !== '' && ymd < from) return false
    if (to !== '' && ymd > to) return false
  }

  const amtBounds = {
    min: f.amountMin ?? undefined,
    max: f.amountMax ?? undefined,
  }
  if (amtBounds.min !== undefined || amtBounds.max !== undefined) {
    const { lower, upper } = resolveAccountingRuleAmountBounds(amtBounds)
    const amt = Number(tx.amount)
    if (!Number.isFinite(amt)) return false
    if (lower !== undefined && amt < lower) return false
    if (upper !== undefined && amt > upper) return false
  }

  if (f.jobSplit !== 'any') {
    const n = (ctx.allocationsByTxId.get(tx.id) ?? []).length
    if (f.jobSplit === 'has' && n === 0) return false
    if (f.jobSplit === 'none' && n > 0) return false
  }

  if (f.personUnassignedOnly) {
    const uid = ctx.userIdByTxId.get(tx.id) ?? null
    const pid = ctx.personIdByTxId.get(tx.id) ?? null
    if (uid || pid) return false
  }

  if (f.kinds.length > 0 && !f.kinds.includes(tx.kind)) {
    return false
  }

  if (f.excludeCounterpartyContains.length > 0) {
    const haystack = (tx.counterparty_name ?? '').trim().toLowerCase()
    for (const phrase of f.excludeCounterpartyContains) {
      const needle = phrase.trim().toLowerCase()
      if (needle === '') continue
      if (haystack.includes(needle)) return false
    }
  }

  return true
}

export function filterRowsByAccountingLedgerFilters<T extends BankingAccountingLedgerFilterTx>(
  rows: T[],
  f: BankingAccountingLedgerFiltersV1,
  ctx: BankingAccountingLedgerFilterCtx,
): T[] {
  if (isDefaultBankingAccountingLedgerFilters(f)) return rows
  return rows.filter((tx) => applyBankingAccountingLedgerFilters(tx, f, ctx))
}

/** Persist JSON or `null` when filters are default (clears storage). */
export function serializeBankingAccountingLedgerFiltersForStorage(
  f: BankingAccountingLedgerFiltersV1,
): string | null {
  if (isDefaultBankingAccountingLedgerFilters(f)) return null
  return JSON.stringify(f)
}
