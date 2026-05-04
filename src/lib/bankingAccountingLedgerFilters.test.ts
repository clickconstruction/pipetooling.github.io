import { describe, expect, it } from 'vitest'
import {
  activeBankingAccountingLedgerFilterCount,
  applyBankingAccountingLedgerFilters,
  defaultBankingAccountingLedgerFilters,
  filterRowsByAccountingLedgerFilters,
  normalizeExcludeCounterpartyContainsFromLines,
  parseBankingAccountingLedgerFiltersJson,
  withLedgerFilterKindsNormalizedIfAllSelected,
  type BankingAccountingLedgerFilterCtx,
} from './bankingAccountingLedgerFilters'

const emptyCtx = (): BankingAccountingLedgerFilterCtx => ({
  allocationsByTxId: new Map(),
  personIdByTxId: new Map(),
  userIdByTxId: new Map(),
})

describe('bankingAccountingLedgerFilters', () => {
  it('defaults have zero active count', () => {
    expect(activeBankingAccountingLedgerFilterCount(defaultBankingAccountingLedgerFilters())).toBe(0)
  })

  it('active count includes exclude counterparty when non-empty', () => {
    const f = defaultBankingAccountingLedgerFilters()
    f.excludeCounterpartyContains = ['x']
    expect(activeBankingAccountingLedgerFilterCount(f)).toBe(1)
  })

  it('parses storage JSON and ignores junk', () => {
    const d = defaultBankingAccountingLedgerFilters()
    expect(parseBankingAccountingLedgerFiltersJson(null)).toEqual(d)
    expect(parseBankingAccountingLedgerFiltersJson('')).toEqual(d)
    expect(parseBankingAccountingLedgerFiltersJson('not json')).toEqual(d)
    expect(parseBankingAccountingLedgerFiltersJson('{"v":2}')).toEqual(d)
  })

  it('amount bounds swap like rule matcher', () => {
    const f = defaultBankingAccountingLedgerFilters()
    f.amountMin = -20
    f.amountMax = -120
    const ctx = emptyCtx()
    expect(applyBankingAccountingLedgerFilters({ id: '1', amount: -50, posted_at: '2026-01-01T12:00:00Z', kind: 't', counterparty_name: null }, f, ctx)).toBe(true)
    expect(applyBankingAccountingLedgerFilters({ id: '1', amount: -5, posted_at: '2026-01-01T12:00:00Z', kind: 't', counterparty_name: null }, f, ctx)).toBe(false)
  })

  it('job split filters', () => {
    const ctx = emptyCtx()
    ctx.allocationsByTxId.set('a', [{ job_id: 'j', amount: 1 }])
    const f = defaultBankingAccountingLedgerFilters()
    f.jobSplit = 'has'
    expect(applyBankingAccountingLedgerFilters({ id: 'a', amount: 1, posted_at: null, kind: 't', counterparty_name: null }, f, ctx)).toBe(true)
    expect(applyBankingAccountingLedgerFilters({ id: 'b', amount: 1, posted_at: null, kind: 't', counterparty_name: null }, f, ctx)).toBe(false)
    f.jobSplit = 'none'
    expect(applyBankingAccountingLedgerFilters({ id: 'b', amount: 1, posted_at: null, kind: 't', counterparty_name: null }, f, ctx)).toBe(true)
    expect(applyBankingAccountingLedgerFilters({ id: 'a', amount: 1, posted_at: null, kind: 't', counterparty_name: null }, f, ctx)).toBe(false)
  })

  it('person unassigned only', () => {
    const ctx = emptyCtx()
    ctx.userIdByTxId.set('u', 'user-1')
    const f = defaultBankingAccountingLedgerFilters()
    f.personUnassignedOnly = true
    expect(applyBankingAccountingLedgerFilters({ id: 'u', amount: 1, posted_at: null, kind: 't', counterparty_name: null }, f, ctx)).toBe(false)
    expect(applyBankingAccountingLedgerFilters({ id: 'x', amount: 1, posted_at: null, kind: 't', counterparty_name: null }, f, ctx)).toBe(true)
  })

  it('filterRows no-ops when default', () => {
    const rows = [{ id: '1', amount: 1, posted_at: null, kind: 't', counterparty_name: null }]
    expect(filterRowsByAccountingLedgerFilters(rows, defaultBankingAccountingLedgerFilters(), emptyCtx())).toBe(rows)
  })

  it('kind filter includes only selected API kinds', () => {
    const ctx = emptyCtx()
    const f = defaultBankingAccountingLedgerFilters()
    f.kinds = ['debit']
    expect(applyBankingAccountingLedgerFilters({ id: '1', amount: 1, posted_at: null, kind: 'debit', counterparty_name: null }, f, ctx)).toBe(true)
    expect(applyBankingAccountingLedgerFilters({ id: '1', amount: 1, posted_at: null, kind: 'credit', counterparty_name: null }, f, ctx)).toBe(false)
    f.kinds = []
    expect(applyBankingAccountingLedgerFilters({ id: '1', amount: 1, posted_at: null, kind: 'credit', counterparty_name: null }, f, ctx)).toBe(true)
  })

  it('parses kinds from JSON', () => {
    const parsed = parseBankingAccountingLedgerFiltersJson('{"v":1,"kinds":["b","a","b"]}')
    expect(parsed.kinds).toEqual(['a', 'b'])
  })

  it('normalizes kinds to empty when all available types selected', () => {
    const f = defaultBankingAccountingLedgerFilters()
    f.kinds = ['a', 'b']
    const out = withLedgerFilterKindsNormalizedIfAllSelected(f, ['b', 'a'])
    expect(out.kinds).toEqual([])
  })

  it('excludes rows when counterparty contains any phrase (case-insensitive)', () => {
    const ctx = emptyCtx()
    const f = defaultBankingAccountingLedgerFilters()
    f.excludeCounterpartyContains = ['amazon']
    expect(
      applyBankingAccountingLedgerFilters(
        { id: '1', amount: 1, posted_at: null, kind: 't', counterparty_name: 'Amazon.com Bill' },
        f,
        ctx,
      ),
    ).toBe(false)
    expect(
      applyBankingAccountingLedgerFilters(
        { id: '1', amount: 1, posted_at: null, kind: 't', counterparty_name: 'Whole Foods' },
        f,
        ctx,
      ),
    ).toBe(true)
    expect(
      applyBankingAccountingLedgerFilters(
        { id: '1', amount: 1, posted_at: null, kind: 't', counterparty_name: null },
        f,
        ctx,
      ),
    ).toBe(true)
  })

  it('parses excludeCounterpartyContains from JSON', () => {
    const parsed = parseBankingAccountingLedgerFiltersJson(
      '{"v":1,"excludeCounterpartyContains":["  foo ","bar","foo"]}',
    )
    expect(parsed.excludeCounterpartyContains).toEqual(['bar', 'foo'])
  })

  it('normalizeExcludeCounterpartyContainsFromLines dedupes and caps', () => {
    const many = Array.from({ length: 55 }, (_, i) => `p${i}`).join('\n')
    const out = normalizeExcludeCounterpartyContainsFromLines(`a\nb\na\n${many}`)
    expect(out.length).toBe(50)
  })
})
