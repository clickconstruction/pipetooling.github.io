import { describe, expect, it } from 'vitest'
import {
  ariaSortFor,
  DEFAULT_SUPPLY_HOUSE_SUMMARY_SORT,
  nextSupplyHouseSummarySort,
  parseSupplyHouseSummarySort,
  serializeSupplyHouseSummarySort,
  sortSupplyHouseSummary,
} from './supplyHouseSummarySort'

const rows = [
  { name: 'Ferguson', outstanding: 4200, monthlyPaymentDay: 10, lastInvoiceUpdatedAt: '2026-09-10T00:00:00Z', lastInvoicePaidAt: '2026-08-01T00:00:00Z' },
  { name: 'Coburn', outstanding: 0, monthlyPaymentDay: null, lastInvoiceUpdatedAt: '2026-09-17T00:00:00Z', lastInvoicePaidAt: null },
  { name: 'National Wholesale', outstanding: 4200, monthlyPaymentDay: 25, lastInvoiceUpdatedAt: null, lastInvoicePaidAt: '2026-09-15T00:00:00Z' },
]
const names = (xs: typeof rows) => xs.map((r) => r.name)

describe('sortSupplyHouseSummary', () => {
  it('Last Paid newest first, houses that never paid last; ascending flips the dated ones and keeps the never-paid last', () => {
    expect(names(sortSupplyHouseSummary(rows, { key: 'lastPaid', dir: 'desc' }))).toEqual(['National Wholesale', 'Ferguson', 'Coburn'])
    expect(names(sortSupplyHouseSummary(rows, { key: 'lastPaid', dir: 'asc' }))).toEqual(['Ferguson', 'National Wholesale', 'Coburn'])
  })
  it('the default — outstanding, biggest first — breaks ties by name, and does not touch the input', () => {
    const input = [...rows]
    expect(names(sortSupplyHouseSummary(input, DEFAULT_SUPPLY_HOUSE_SUMMARY_SORT))).toEqual(['Ferguson', 'National Wholesale', 'Coburn'])
    expect(input).toEqual(rows)
  })
  it('names read A→Z regardless of case; Due puts houses without a payment day last; Updated newest first', () => {
    expect(names(sortSupplyHouseSummary(rows, { key: 'name', dir: 'asc' }))).toEqual(['Coburn', 'Ferguson', 'National Wholesale'])
    expect(names(sortSupplyHouseSummary(rows, { key: 'due', dir: 'asc' }))).toEqual(['Ferguson', 'National Wholesale', 'Coburn'])
    expect(names(sortSupplyHouseSummary(rows, { key: 'updated', dir: 'desc' }))).toEqual(['Coburn', 'Ferguson', 'National Wholesale'])
  })
})

describe('the header click and the remembered pick', () => {
  it('the same column flips; another column starts in its natural direction', () => {
    expect(nextSupplyHouseSummarySort({ key: 'outstanding', dir: 'desc' }, 'outstanding')).toEqual({ key: 'outstanding', dir: 'asc' })
    expect(nextSupplyHouseSummarySort({ key: 'outstanding', dir: 'desc' }, 'lastPaid')).toEqual({ key: 'lastPaid', dir: 'desc' })
    expect(nextSupplyHouseSummarySort({ key: 'lastPaid', dir: 'desc' }, 'name')).toEqual({ key: 'name', dir: 'asc' })
  })
  it('round-trips through the remembered string and falls back to the default on junk', () => {
    const s = { key: 'lastPaid', dir: 'asc' } as const
    expect(parseSupplyHouseSummarySort(serializeSupplyHouseSummarySort(s))).toEqual(s)
    expect(parseSupplyHouseSummarySort('lastPaid:sideways')).toEqual(DEFAULT_SUPPLY_HOUSE_SUMMARY_SORT)
    expect(parseSupplyHouseSummarySort('colour:asc')).toEqual(DEFAULT_SUPPLY_HOUSE_SUMMARY_SORT)
    expect(parseSupplyHouseSummarySort(null)).toEqual(DEFAULT_SUPPLY_HOUSE_SUMMARY_SORT)
  })
  it('names the header state for assistive tech', () => {
    expect(ariaSortFor({ key: 'lastPaid', dir: 'desc' }, 'lastPaid')).toBe('descending')
    expect(ariaSortFor({ key: 'lastPaid', dir: 'asc' }, 'lastPaid')).toBe('ascending')
    expect(ariaSortFor({ key: 'lastPaid', dir: 'asc' }, 'name')).toBe('none')
  })
})
