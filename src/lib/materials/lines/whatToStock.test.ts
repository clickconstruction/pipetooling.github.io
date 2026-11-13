import { describe, expect, it } from 'vitest'
import type { PurchaseLine } from './whatWeBuy'
import { atATimeWords, SMALL_BILL_CENTS, whatToStock, whereWords, windowStart } from './whatToStock'

// Made-up purchases: invented houses, codes and prices.
const line = (over: Partial<PurchaseLine> & { id: string }): PurchaseLine => ({ invoiceId: `b-${over.id}`, houseId: 'h1', datedOn: '2026-10-22', lineKind: 'part', houseCode: '', description: '', unit: 'EA', pricingUnit: 'each', unitPrice: null, partId: null, quantity: null, extendedCents: null, ...over })
const houseNames = new Map([['h1', 'Ridgeway Supply'], ['h2', 'Pecan Supply Co']])
const wax = (id: string, day: string, qty: number, over: Partial<PurchaseLine> = {}) => line({ id, houseCode: 'RS-90021', description: 'WAX RING W/HORN', quantity: qty, unitPrice: 3.1, extendedCents: Math.round(qty * 310), datedOn: day, ...over })
const elbow = (id: string, day: string, qty: number) => line({ id, houseCode: 'RS-40712', description: '3/4 COP 90 ELL CXC', quantity: qty, unitPrice: 4.7, extendedCents: Math.round(qty * 470), datedOn: day })
const cement = (id: string, day: string) => line({ id, houseId: 'h2', houseCode: 'PS-2210', description: 'PVC CEMENT PINT', quantity: 1, unitPrice: 11.3, extendedCents: 1130, datedOn: day })

const LINES: PurchaseLine[] = [
  // Wax rings: five trips, two houses, two to four at a time, each on a small bill.
  wax('w1', '2026-11-03', 2),
  wax('w2', '2026-10-27', 4),
  wax('w3', '2026-10-14', 2, { houseId: 'h2', houseCode: 'PS-0077' }),
  wax('w4', '2026-09-30', 3),
  wax('w5', '2026-09-12', 2),
  // Two bills on one day are one trip.
  wax('w6', '2026-09-12', 1),
  // Elbows: three trips, by the hundred on big bills.
  elbow('e1', '2026-10-20', 100),
  elbow('e2', '2026-09-22', 150),
  elbow('e3', '2026-08-25', 100),
  // Cement: one at a time, three times.
  cement('c1', '2026-10-30'),
  cement('c2', '2026-10-09'),
  cement('c3', '2026-09-18'),
  // Twice only: not listed. A return: not a trip. Outside the window: not counted.
  line({ id: 't1', houseCode: 'RS-1', description: 'TEE', quantity: 2, extendedCents: 400, datedOn: '2026-10-01' }),
  line({ id: 't2', houseCode: 'RS-1', description: 'TEE', quantity: 2, extendedCents: 400, datedOn: '2026-10-02' }),
  wax('w7', '2026-10-28', -2, { invoiceId: 'credit-1', extendedCents: -620 }),
  wax('w8', '2026-06-01', 2),
  line({ id: 'f1', invoiceId: 'b-e1', lineKind: 'charge', description: 'FREIGHT', extendedCents: 4500, datedOn: '2026-10-20' }),
]
// The two houses' wax ring codes are one part in the book.
const teaches = [
  { houseId: 'h1', codeKey: 'RS90021', partId: 'p-wax', notAPart: false },
  { houseId: 'h2', codeKey: 'PS0077', partId: 'p-wax', notAPart: false },
]
const partNames = new Map([['p-wax', 'Wax ring with horn']])
const jobsOfBill = new Map([['b-w1', ['j1']], ['b-w2', ['j2']], ['b-w3', ['j1']], ['b-e1', ['j3']]])

describe('whatToStock', () => {
  const rows = whatToStock({ lines: LINES, teaches, partNames, houseNames, jobsOfBill, counterBills: new Set(), todayYmd: '2026-11-12', windowDays: 90 })

  it('lists what was bought on three or more separate days, the most trips first', () => {
    expect(rows.map((r) => [r.name, r.trips])).toEqual([
      ['Wax ring with horn', 5],
      ['3/4 COP 90 ELL CXC', 3],
      ['PVC CEMENT PINT', 3],
    ])
  })

  it('counts two bills on one day as one trip, a return as none, and joins a part across houses', () => {
    const waxRow = rows[0]!
    expect(waxRow).toMatchObject({ partId: 'p-wax', byCode: '', trips: 5, atATime: { min: 1, max: 4 }, unit: 'EA', jobs: 2, counter: true, houses: ['Pecan Supply Co', 'Ridgeway Supply'] })
    expect(waxRow.spendCents).toBe((2 + 4 + 2 + 3 + 2 + 1) * 310)
    expect(whereWords(waxRow)).toBe('the counter, both houses')
    expect(waxRow.readAs).toBe('a trip every 18 days for a $3.10 part')
  })

  it('says a part that came on big bills was delivered, not a trip to the counter', () => {
    const elbows = rows[1]!
    expect(elbows).toMatchObject({ counter: false, atATime: { min: 100, max: 150 }, byCode: 'Ridgeway Supply RS-40712' })
    expect(elbows.readAs).toBe('on big orders, not a trip to the counter')
    expect(whereWords(elbows)).toBe('delivered, Ridgeway Supply')
    // The bill's whole size decides, the freight with it: 100 elbows and freight is over the line.
    expect(100 * 470 + 4500).toBeGreaterThan(SMALL_BILL_CENTS)
  })

  it('reads one at a time as that', () => {
    expect(rows[2]!.readAs).toBe('one at a time, 3 times')
    expect(atATimeWords(rows[2]!.atATime)).toBe('1')
    expect(atATimeWords(rows[0]!.atATime)).toBe('1 to 4')
  })

  it('takes a big bill with a PO Generator code as a trip to the counter', () => {
    const withCodes = whatToStock({ lines: LINES, teaches, partNames, houseNames, jobsOfBill, counterBills: new Set(['b-e1', 'b-e2']), todayYmd: '2026-11-12', windowDays: 90 })
    expect(withCodes.find((r) => r.name === '3/4 COP 90 ELL CXC')!.counter).toBe(true)
  })

  it('holds to its window', () => {
    expect(windowStart('2026-11-12', 90)).toBe('2026-08-15')
    // The last 30 days begin on October 14: three wax ring trips are in them, and nothing else three times.
    const month = whatToStock({ lines: LINES, teaches, partNames, houseNames, jobsOfBill, counterBills: new Set(), todayYmd: '2026-11-12', windowDays: 30 })
    expect(month.map((r) => [r.name, r.trips])).toEqual([['Wax ring with horn', 3]])
    expect(month[0]!.readAs).toBe('a trip every 10 days for a $3.10 part')
    const half = whatToStock({ lines: LINES, teaches, partNames, houseNames, jobsOfBill, counterBills: new Set(), todayYmd: '2026-11-12', windowDays: 180 })
    expect(half.find((r) => r.partId === 'p-wax')!.trips).toBe(6)
  })

  it('says three houses by their count', () => {
    expect(whereWords({ counter: true, houses: ['A', 'B', 'C'] })).toBe('the counter, 3 houses')
  })
})
