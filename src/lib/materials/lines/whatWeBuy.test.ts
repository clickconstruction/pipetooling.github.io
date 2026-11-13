import { describe, expect, it } from 'vitest'
import { defaultSpan, dollarsWords, lineIdentity, indexTeaches, monthsOfSpan, monthWords, priceEach, priceWords, quantityWords, timesWords, whatWeBuy, type BuyFilters, type CodeTeach, type PurchaseLine } from './whatWeBuy'

// Made-up purchases: invented houses, codes, parts and prices.
const line = (over: Partial<PurchaseLine> & { id: string }): PurchaseLine => ({ invoiceId: 'b1', houseId: 'h1', datedOn: '2026-10-22', lineKind: 'part', houseCode: '', description: '', unit: 'EA', pricingUnit: 'each', unitPrice: null, partId: null, quantity: null, extendedCents: null, ...over })
const houseNames = new Map([['h1', 'Ridgeway Supply'], ['h2', 'Pecan Supply Co']])
const partNames = new Map([['p-tube', 'Copper tube, type L, 3/4 in.']])
const teaches: CodeTeach[] = [
  { houseId: 'h1', codeKey: 'RS11204', partId: 'p-tube', notAPart: false },
  { houseId: 'h2', codeKey: 'PS7712', partId: 'p-tube', notAPart: false },
  { houseId: 'h1', codeKey: 'MISC', partId: null, notAPart: true },
]
const filters = (over: Partial<BuyFilters> = {}): BuyFilters => ({ houseId: '', jobId: '', fromMonth: '2026-05', toMonth: '2026-10', sort: 'spend', ...over })

const LINES: PurchaseLine[] = [
  // The tube at two houses, each under its own code: one part once the crosswalk knows both.
  line({ id: '1', invoiceId: 'b1', houseCode: 'RS-11204', description: '3/4 X 10 TYPE L COP TUBE', unit: 'ft', quantity: 80, unitPrice: 3.84, extendedCents: 30720, datedOn: '2026-10-22' }),
  line({ id: '2', invoiceId: 'b2', houseId: 'h2', houseCode: 'PS-7712', description: 'COP TUBE L 3/4', unit: 'FT', quantity: 120, unitPrice: 3.71, extendedCents: 44520, datedOn: '2026-10-30' }),
  line({ id: '3', invoiceId: 'b3', houseCode: 'RS 11204', description: '3/4 X 10 TYPE L COP TUBE', unit: 'FT', quantity: 200, unitPrice: 3.78, extendedCents: 75600, datedOn: '2026-09-18' }),
  // A code no one has matched: grouped by its house and its code, named by its newest words.
  line({ id: '4', invoiceId: 'b1', houseCode: '0417-2210', description: 'PVC SCH40 PIPE 2X20', unit: 'EA', quantity: 4, unitPrice: 50.36, extendedCents: 20144, datedOn: '2026-10-22' }),
  line({ id: '5', invoiceId: 'b4', houseCode: '04172210', description: 'PVC SCH40 PIPE 2X20 PE', unit: 'EA', quantity: 2, unitPrice: 50.36, extendedCents: 10072, datedOn: '2026-10-28' }),
  // No code at all: grouped by its words at the house.
  line({ id: '6', invoiceId: 'b4', description: 'Wax ring with horn', quantity: 3, unitPrice: 3.1, extendedCents: 930, datedOn: '2026-10-28' }),
  // Charges: a freight line, and a code the crosswalk marks not a part.
  line({ id: '7', invoiceId: 'b1', lineKind: 'charge', description: 'FUEL SURCHARGE', extendedCents: 650 }),
  line({ id: '8', invoiceId: 'b3', houseCode: 'MISC', description: 'SPECIAL ORDER FEE', quantity: 1, extendedCents: 1500, datedOn: '2026-09-18' }),
  // Outside the span, and a paper with no date: neither is counted.
  line({ id: '9', invoiceId: 'b5', houseCode: 'RS-11204', quantity: 10, extendedCents: 3800, datedOn: '2026-04-30' }),
  line({ id: '10', invoiceId: 'b6', houseCode: 'RS-11204', quantity: 10, extendedCents: 3800, datedOn: null }),
]

describe('whatWeBuy', () => {
  const { rows, summary, months } = whatWeBuy({ lines: LINES, teaches, partNames, houseNames, filters: filters() })

  it('spans its months, oldest first', () => {
    expect(months).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'])
  })

  it('joins one part bought at two houses under their own codes, through the crosswalk', () => {
    const tube = rows.find((r) => r.partId === 'p-tube')!
    expect(tube).toMatchObject({ name: 'Copper tube, type L, 3/4 in.', byCode: '', bills: 3, quantity: 400, unit: 'FT', mixedUnits: false, spendCents: 150840 })
    expect(tube.byMonth).toEqual([0, 0, 0, 0, 75600, 75240])
    // The most spent first; the last price is the newest bill's.
    expect(tube.houses).toEqual(['Ridgeway Supply', 'Pecan Supply Co'])
    expect(tube.lastPaid).toEqual({ priceEach: 3.71, datedOn: '2026-10-30' })
  })

  it('groups a code with no part by its house and its code, however it is dashed, under its newest words', () => {
    const pipe = rows.find((r) => r.key === 'code:h1|04172210')!
    expect(pipe).toMatchObject({ name: 'PVC SCH40 PIPE 2X20 PE', partId: null, byCode: 'Ridgeway Supply 0417-2210', bills: 2, quantity: 6, spendCents: 30216 })
  })

  it('groups a line with no code by its words at the house', () => {
    const wax = rows.find((r) => r.name === 'Wax ring with horn')!
    expect(wax.key.startsWith('words:h1|')).toBe(true)
    expect(wax).toMatchObject({ bills: 1, quantity: 3, spendCents: 930, byCode: 'Ridgeway Supply' })
  })

  it('counts freight and a code that is not a part as charges, never as a row', () => {
    expect(summary.chargesCents).toBe(2150)
    expect(rows.some((r) => /FUEL|SPECIAL ORDER/.test(r.name))).toBe(false)
  })

  it('sums what is in the span and says how many rows have no part yet', () => {
    expect(summary).toEqual({ partsCents: 181986, bills: 4, chargesCents: 2150, rows: 3, byCodeOnly: 2 })
  })

  it('sorts by spend, by quantity or by how often', () => {
    expect(rows.map((r) => r.spendCents)).toEqual([150840, 30216, 930])
    const often = whatWeBuy({ lines: LINES, teaches, partNames, houseNames, filters: filters({ sort: 'often' }) }).rows
    expect(often.map((r) => r.bills)).toEqual([3, 2, 1])
    const qty = whatWeBuy({ lines: LINES, teaches, partNames, houseNames, filters: filters({ sort: 'quantity' }) }).rows
    expect(qty.map((r) => r.quantity)).toEqual([400, 6, 3])
  })

  it('holds the page to one house', () => {
    const pecan = whatWeBuy({ lines: LINES, teaches, partNames, houseNames, filters: filters({ houseId: 'h2' }) })
    expect(pecan.rows).toHaveLength(1)
    expect(pecan.rows[0]).toMatchObject({ partId: 'p-tube', bills: 1, quantity: 120, spendCents: 44520, houses: ['Pecan Supply Co'] })
    expect(pecan.summary.chargesCents).toBe(0)
  })

  it('gives a job its share of a bill split by percent, and leaves out a bill with no share on it', () => {
    // b1 is split 25 percent to the job; b2 is all the job's; b3 and b4 are another job's.
    const shares = new Map([['b1', 0.25], ['b2', 1]])
    const job = whatWeBuy({ lines: LINES, teaches, partNames, houseNames, shares, filters: filters({ jobId: 'j1' }) })
    const tube = job.rows.find((r) => r.partId === 'p-tube')!
    expect(tube).toMatchObject({ bills: 2, quantity: 140, spendCents: 7680 + 44520 })
    expect(job.rows.find((r) => r.key === 'code:h1|04172210')).toMatchObject({ bills: 1, quantity: 1, spendCents: 5036 })
    expect(job.summary.chargesCents).toBe(163)
    expect(job.summary.bills).toBe(2)
  })

  it('takes a credit off: the view signs its quantity and its extension negative', () => {
    const withCredit = [...LINES, line({ id: '11', invoiceId: 'c1', houseCode: 'RS-11204', unit: 'FT', quantity: -20, unitPrice: 3.84, extendedCents: -7680, datedOn: '2026-10-25' })]
    const tube = whatWeBuy({ lines: withCredit, teaches, partNames, houseNames, filters: filters() }).rows.find((r) => r.partId === 'p-tube')!
    expect(tube).toMatchObject({ quantity: 380, spendCents: 143160, bills: 4 })
    // A return is not a price paid.
    expect(tube.lastPaid).toEqual({ priceEach: 3.71, datedOn: '2026-10-30' })
  })

  it('says when a row adds unlike units', () => {
    const mixed = whatWeBuy({ lines: [line({ id: 'a', houseCode: 'X1', unit: 'EA', quantity: 2, extendedCents: 200 }), line({ id: 'b', invoiceId: 'b2', houseCode: 'X1', unit: 'BX', quantity: 1, extendedCents: 900 }), line({ id: 'c', invoiceId: 'b3', houseCode: 'X1', unit: 'ea', quantity: 1, extendedCents: 100 })], teaches: [], partNames, houseNames, filters: filters() }).rows[0]!
    expect(mixed).toMatchObject({ unit: 'EA', mixedUnits: true, quantity: 4 })
    expect(quantityWords(mixed)).toBe('about 4 EA')
  })

  it('answers no row and no spend for a span with nothing in it', () => {
    const none = whatWeBuy({ lines: LINES, teaches, partNames, houseNames, filters: filters({ fromMonth: '2025-01', toMonth: '2025-03' }) })
    expect(none.rows).toEqual([])
    expect(none.summary).toEqual({ partsCents: 0, bills: 0, chargesCents: 0, rows: 0, byCodeOnly: 0 })
  })
})

describe('the pieces', () => {
  it('says what a line is', () => {
    const t = indexTeaches(teaches)
    expect(lineIdentity(line({ id: 'x', partId: 'p9', houseCode: 'RS-11204' }), t)).toEqual({ kind: 'part', key: 'part:p9', partId: 'p9' })
    expect(lineIdentity(line({ id: 'x', houseCode: 'rs-11204' }), t)).toEqual({ kind: 'part', key: 'part:p-tube', partId: 'p-tube' })
    // The same code at another house is that house's own.
    expect(lineIdentity(line({ id: 'x', houseId: 'h2', houseCode: 'RS-11204' }), t)).toEqual({ kind: 'code', key: 'code:h2|RS11204' })
    expect(lineIdentity(line({ id: 'x', houseCode: 'MISC' }), t)).toEqual({ kind: 'charge' })
    expect(lineIdentity(line({ id: 'x', lineKind: 'charge', houseCode: 'RS-11204' }), t)).toEqual({ kind: 'charge' })
  })

  it('prices one through the pricing unit, or from the extension', () => {
    expect(priceEach(line({ id: 'x', unitPrice: 79.31, pricingUnit: 'per_hundred', quantity: 10, extendedCents: 793 }))).toBeCloseTo(0.7931)
    expect(priceEach(line({ id: 'x', unitPrice: null, quantity: 4, extendedCents: 24400 }))).toBe(61)
    expect(priceEach(line({ id: 'x', unitPrice: null, quantity: null, extendedCents: 24400 }))).toBeNull()
  })

  it('spans months across a year end, and opens on the six that end with this one', () => {
    expect(monthsOfSpan('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
    expect(monthsOfSpan('2026-10', '2026-05')).toEqual([])
    expect(monthsOfSpan('', '2026-05')).toEqual([])
    expect(defaultSpan('2026-11-12')).toEqual({ fromMonth: '2026-06', toMonth: '2026-11' })
    expect(defaultSpan('2026-03-01')).toEqual({ fromMonth: '2025-10', toMonth: '2026-03' })
    expect(monthWords('2026-05')).toBe('May 2026')
  })

  it('writes its figures', () => {
    expect(timesWords(43)).toBe('43 times')
    expect(timesWords(1)).toBe('1 time')
    expect(quantityWords({ quantity: 5320, unit: 'FT', mixedUnits: false })).toBe('5,320 FT')
    expect(quantityWords({ quantity: 12, unit: '', mixedUnits: false })).toBe('12')
    expect(priceWords(3.84)).toBe('$3.84')
    expect(priceWords(0.507)).toBe('$0.507')
    expect(priceWords(869)).toBe('$869.00')
    expect(dollarsWords(1970240)).toBe('$19,702')
    expect(dollarsWords(-7680)).toBe('−$77')
  })
})
