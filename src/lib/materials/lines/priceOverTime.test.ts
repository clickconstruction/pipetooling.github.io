import { describe, expect, it } from 'vitest'
import type { CodeTeach, PurchaseLine } from './whatWeBuy'
import { bookIsStale, bookLine, changeWords, dayAt, dayWords, houseSeries, lastPaidByHouse, priceAt, pricePoints, priceScale } from './priceOverTime'

// Made-up purchases: invented houses, codes and prices.
const line = (over: Partial<PurchaseLine> & { id: string }): PurchaseLine => ({ invoiceId: 'b1', billNumber: 'S-1', houseId: 'h1', datedOn: '2026-10-22', lineKind: 'part', houseCode: 'RS-11204', description: 'COP TUBE', unit: 'ft', pricingUnit: 'each', unitPrice: 3.84, partId: null, quantity: 80, extendedCents: 30720, ...over })
const houseNames = new Map([['h1', 'Ridgeway Supply'], ['h2', 'Pecan Supply Co']])
const teaches: CodeTeach[] = [
  { houseId: 'h1', codeKey: 'RS11204', partId: 'p-tube', notAPart: false, unitFactor: 1 },
  // Pecan sells the tube by the ten-foot stick; the book prices a foot.
  { houseId: 'h2', codeKey: 'PS7712', partId: 'p-tube', notAPart: false, unitFactor: 10 },
]
const LINES: PurchaseLine[] = [
  line({ id: '1', invoiceId: 'b1', billNumber: 'S-118342', datedOn: '2026-10-22', quantity: 80, unitPrice: 3.84 }),
  line({ id: '2', invoiceId: 'b2', billNumber: 'PS-77120', houseId: 'h2', houseCode: 'PS-7712', datedOn: '2026-10-30', unit: 'EA', quantity: 12, unitPrice: 37.1, extendedCents: 44520 }),
  line({ id: '3', invoiceId: 'b3', billNumber: 'S-117902', datedOn: '2026-09-18', quantity: 200, unitPrice: 3.78 }),
  line({ id: '4', invoiceId: 'b4', billNumber: 'S-117001', datedOn: '2026-06-03', quantity: 100, unitPrice: 3.62 }),
  // Not this row, a return, a line with nothing to price from, and a charge.
  line({ id: '5', houseCode: 'RS-99999', quantity: 5, unitPrice: 9 }),
  line({ id: '6', invoiceId: 'c1', quantity: -20, unitPrice: 3.84, extendedCents: -7680, datedOn: '2026-10-25' }),
  line({ id: '7', invoiceId: 'b5', quantity: 4, unitPrice: null, extendedCents: null, datedOn: '2026-10-26' }),
  line({ id: '8', lineKind: 'charge', description: 'FREIGHT', quantity: 1, unitPrice: 45 }),
]

describe('pricePoints', () => {
  const jobsOfBill = new Map([['b1', ['JP1042 Oak Hollow C']]])
  const points = pricePoints({ lines: LINES, teaches, rowKey: 'part:p-tube', houseNames, jobsOfBill })

  it('answers every purchase of the row, newest first, with its bill and its job', () => {
    expect(points.map((p) => [p.datedOn, p.houseName, p.billNumber, p.quantity])).toEqual([
      ['2026-10-30', 'Pecan Supply Co', 'PS-77120', 12],
      ['2026-10-22', 'Ridgeway Supply', 'S-118342', 80],
      ['2026-09-18', 'Ridgeway Supply', 'S-117902', 200],
      ['2026-06-03', 'Ridgeway Supply', 'S-117001', 100],
    ])
    expect(points[1]!.jobs).toEqual(['JP1042 Oak Hollow C'])
    expect(points[0]!.jobs).toEqual([])
  })

  it('puts a stick and a foot on one scale through the house’s unit', () => {
    // 37.10 a ten-foot stick is 3.71 a foot.
    expect(points[0]!.priceEach).toBeCloseTo(3.71)
    expect(points[1]!.priceEach).toBeCloseTo(3.84)
  })

  it('reads a row with no part by its house and code', () => {
    const other = pricePoints({ lines: LINES, teaches, rowKey: 'code:h1|RS99999', houseNames })
    expect(other.map((p) => p.lineId)).toEqual(['5'])
  })
})

describe('lastPaidByHouse', () => {
  const points = pricePoints({ lines: LINES, teaches, rowKey: 'part:p-tube', houseNames })

  it('says the last price at each house, its change since the purchase before, and the cheapest of the last 90 days', () => {
    const lasts = lastPaidByHouse(points, '2026-11-12')
    expect(lasts.map((h) => [h.houseName, h.datedOn, h.sinceYmd, h.cheapest])).toEqual([
      ['Pecan Supply Co', '2026-10-30', null, true],
      ['Ridgeway Supply', '2026-10-22', '2026-09-18', false],
    ])
    expect(lasts[0]!.change).toBeNull()
    expect(lasts[1]!.change).toBeCloseTo(3.84 / 3.78 - 1)
    expect(changeWords(lasts[1]!.change)).toBe('up 2%')
  })

  it('names no cheapest house when only one was bought from in the window, or when two tie', () => {
    expect(lastPaidByHouse(points, '2027-06-01').some((h) => h.cheapest)).toBe(false)
    const tie = pricePoints({ lines: [line({ id: 'a' }), line({ id: 'b', houseId: 'h2', houseCode: 'X', partId: 'p-tube', invoiceId: 'b9' }), line({ id: 'c', partId: 'p-tube', invoiceId: 'b8' })].map((l) => ({ ...l, partId: 'p-tube' })), teaches: [], rowKey: 'part:p-tube', houseNames })
    expect(lastPaidByHouse(tie, '2026-11-12').some((h) => h.cheapest)).toBe(false)
  })

  it('writes a change in words', () => {
    expect(changeWords(0.064)).toBe('up 6%')
    expect(changeWords(-0.031)).toBe('down 3%')
    expect(changeWords(0.002)).toBe('the same')
    expect(changeWords(null)).toBe('')
  })
})

describe('the chart’s scale', () => {
  const points = pricePoints({ lines: LINES, teaches, rowKey: 'part:p-tube', houseNames })

  it('spans the days and pads the prices, the book’s among them', () => {
    const s = priceScale(points, 3.5)!
    expect(s.fromYmd).toBe('2026-06-03')
    expect(s.toYmd).toBe('2026-10-30')
    expect(s.min).toBeLessThan(3.5)
    expect(s.max).toBeGreaterThan(3.84)
    expect(s.ticks).toHaveLength(3)
    expect(s.monthMarks).toEqual(['2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01'])
    expect(dayAt(s, '2026-06-03')).toBe(0)
    expect(dayAt(s, '2026-10-30')).toBe(1)
    expect(priceAt(s, s.min)).toBe(0)
    expect(priceAt(s, s.max)).toBe(1)
    expect(priceAt(s, 3.71)).toBeGreaterThan(priceAt(s, 3.62))
  })

  it('gives one purchase a band and a month to sit in', () => {
    const s = priceScale([points[0]!], null)!
    expect(s.fromYmd).toBe('2026-10-16')
    expect(s.toYmd).toBe('2026-11-13')
    expect(s.max).toBeGreaterThan(s.min)
    expect(dayAt(s, '2026-10-30')).toBeCloseTo(0.5)
  })

  it('has no scale with no point', () => {
    expect(priceScale([], 3.5)).toBeNull()
  })
})

describe('the houses’ colours and the book', () => {
  it('gives the three houses with the most lines a series each, the same from part to part', () => {
    const lines = [...Array(5).fill({ houseId: 'a' }), ...Array(9).fill({ houseId: 'b' }), ...Array(2).fill({ houseId: 'c' }), { houseId: 'd' }, { houseId: null }]
    const s = houseSeries(lines)
    expect([...s.entries()]).toEqual([['b', 0], ['a', 1], ['c', 2]])
    expect(s.has('d')).toBe(false)
  })

  it('picks the book’s price checked most recently, the lower of two on one day', () => {
    expect(bookLine([{ houseId: 'h1', price: 3.62, checkedOn: '2026-07-14' }, { houseId: 'h2', price: 3.9, checkedOn: '2026-03-01' }, { houseId: 'h3', price: 3.5, checkedOn: null }])).toEqual({ houseId: 'h1', price: 3.62, checkedOn: '2026-07-14' })
    expect(bookLine([{ houseId: 'h1', price: 3.62, checkedOn: '2026-07-14' }, { houseId: 'h2', price: 3.4, checkedOn: '2026-07-14' }])!.houseId).toBe('h2')
    expect(bookLine([])).toBeNull()
  })

  it('reads the book as stale past ninety days, or never checked', () => {
    expect(bookIsStale('2026-07-14', '2026-11-12')).toBe(true)
    expect(bookIsStale('2026-10-01', '2026-11-12')).toBe(false)
    expect(bookIsStale(null, '2026-11-12')).toBe(true)
  })

  it('prints a day with its year only when it is not this one', () => {
    expect(dayWords('2026-10-22', '2026-11-12')).toBe('Oct 22')
    expect(dayWords('2025-12-03', '2026-11-12')).toBe('Dec 3, 2025')
  })
})
