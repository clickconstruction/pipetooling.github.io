import { describe, expect, it } from 'vitest'
import {
  compareMercuryLedgerRows,
  DEFAULT_MERCURY_LEDGER_SORT,
  nextMercuryLedgerSortState,
  parseMercuryLedgerSortJson,
  type MercuryLedgerSortRow,
} from './bankingMercuryLedgerTableSort'

const row = (partial: Partial<MercuryLedgerSortRow> & { id: string }): MercuryLedgerSortRow => ({
  posted_at: null,
  created_at: '',
  counterparty_name: null,
  amount: 0,
  ...partial,
})

describe('bankingMercuryLedgerTableSort', () => {
  it('nextMercuryLedgerSortState uses column defaults then toggles', () => {
    expect(nextMercuryLedgerSortState(DEFAULT_MERCURY_LEDGER_SORT, 'amount')).toEqual({
      key: 'amount',
      dir: 'desc',
    })
    expect(
      nextMercuryLedgerSortState({ key: 'amount', dir: 'desc' }, 'counterparty_name'),
    ).toEqual({ key: 'counterparty_name', dir: 'asc' })
    expect(
      nextMercuryLedgerSortState({ key: 'posted_at', dir: 'desc' }, 'posted_at'),
    ).toEqual({ key: 'posted_at', dir: 'asc' })
  })

  it('compareMercuryLedgerRows sorts posted_at desc', () => {
    const a = row({ id: 'a', posted_at: '2026-01-02T00:00:00Z' })
    const b = row({ id: 'b', posted_at: '2026-01-01T00:00:00Z' })
    const sorted = [a, b].sort((x, y) => compareMercuryLedgerRows(x, y, 'posted_at', 'desc'))
    expect(sorted.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('compareMercuryLedgerRows sorts amount asc', () => {
    const a = row({ id: 'a', amount: 10 })
    const b = row({ id: 'b', amount: 50 })
    const sorted = [b, a].sort((x, y) => compareMercuryLedgerRows(x, y, 'amount', 'asc'))
    expect(sorted.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('compareMercuryLedgerRows puts empty counterparty last in asc', () => {
    const named = row({ id: 'a', counterparty_name: 'Amazon' })
    const blank = row({ id: 'b', counterparty_name: '  ' })
    const sorted = [blank, named].sort((x, y) =>
      compareMercuryLedgerRows(x, y, 'counterparty_name', 'asc'),
    )
    expect(sorted.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('parseMercuryLedgerSortJson validates keys', () => {
    expect(parseMercuryLedgerSortJson(null)).toEqual(DEFAULT_MERCURY_LEDGER_SORT)
    expect(parseMercuryLedgerSortJson('{"key":"amount","dir":"asc"}')).toEqual({
      key: 'amount',
      dir: 'asc',
    })
    expect(parseMercuryLedgerSortJson('{"key":"invalid","dir":"asc"}')).toEqual(
      DEFAULT_MERCURY_LEDGER_SORT,
    )
  })
})
