import { describe, expect, it } from 'vitest'
import {
  allocateCentsLargestRemainder,
  derivedDiscountDollars,
  discountBasisIdsFromPositions,
  discountBasisPositions,
  discountBasisRows,
  discountBillDescription,
  discountBillLinesForWorkRows,
  discountExceedsBasis,
  discountReadout,
  discountRowIsLocked,
  discountSharesByWorkRow,
  discountTwinLabel,
  formatPct,
  netWorkLineCents,
  parseDiscountEntry,
  syncDiscountRows,
  totalDiscountDollars,
  totalWorkDollars,
  type DiscountLineRow,
} from './discountLine'

type Row = DiscountLineRow & { stage_kind?: 'order' | 'any' | null; shared_with_gc?: boolean }

const work = (id: string, name: string, price: number, o: Partial<Row> = {}): Row => ({
  id,
  name,
  count: 1,
  line_unit_price: price,
  invoice_id: null,
  stage_kind: 'order',
  shared_with_gc: false,
  ...o,
})
const pct = (id: string, p: number, o: Partial<Row> = {}): Row => ({
  id,
  name: 'Negotiated discount',
  count: 1,
  line_unit_price: null,
  line_kind: 'discount',
  discount_pct: p,
  discount_basis_ids: null,
  invoice_id: null,
  stage_kind: null,
  shared_with_gc: false,
  ...o,
})
const usd = (id: string, dollars: number, o: Partial<Row> = {}): Row => ({
  id,
  name: 'Referral thank-you',
  count: 1,
  line_unit_price: -dollars,
  line_kind: 'discount',
  discount_pct: null,
  discount_basis_ids: null,
  invoice_id: null,
  stage_kind: null,
  shared_with_gc: false,
  ...o,
})

/** Job 892: three Order stages, $37,745 of work. */
const job892 = () => [work('a', 'Rough In', 15098), work('b', 'Top Out', 15098), work('c', 'Trim Set', 7549)]

describe('parseDiscountEntry', () => {
  it('reads a percent from a trailing or leading %', () => {
    expect(parseDiscountEntry('10%')).toEqual({ mode: 'pct', pct: 10 })
    expect(parseDiscountEntry(' 7.5 % ')).toEqual({ mode: 'pct', pct: 7.5 })
    expect(parseDiscountEntry('%12')).toEqual({ mode: 'pct', pct: 12 })
    expect(parseDiscountEntry('150%')).toEqual({ mode: 'pct', pct: 100 })
  })
  it('reads dollars from a bare number, $, commas and a stray minus', () => {
    expect(parseDiscountEntry('500')).toEqual({ mode: 'usd', dollars: 500 })
    expect(parseDiscountEntry('$1,250.50')).toEqual({ mode: 'usd', dollars: 1250.5 })
    expect(parseDiscountEntry('-500')).toEqual({ mode: 'usd', dollars: 500 })
  })
  it('returns null for nothing, a bare %, or junk', () => {
    expect(parseDiscountEntry('')).toBeNull()
    expect(parseDiscountEntry('%')).toBeNull()
    expect(parseDiscountEntry('abc')).toBeNull()
  })
})

describe('derived dollars and the basis', () => {
  it('a percent derives from every work row when the basis is null', () => {
    const rows = [...job892(), pct('d', 10)]
    expect(derivedDiscountDollars(rows, rows[3]!)).toBe(3774.5)
    expect(discountBasisRows(rows, rows[3]!).map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })
  it('a chosen basis limits both the rows and the dollars', () => {
    const rows = [...job892(), pct('d', 10, { discount_basis_ids: ['a', 'c'] })]
    expect(discountBasisRows(rows, rows[3]!).map((r) => r.id)).toEqual(['a', 'c'])
    expect(derivedDiscountDollars(rows, rows[3]!)).toBe(2264.7)
  })
  it('unnamed, unpriced and discount rows never form a basis', () => {
    const rows = [work('a', '', 100), work('b', 'Permit', 0), usd('x', 50), work('c', 'Trim', 200), pct('d', 50)]
    expect(discountBasisRows(rows, rows[4]!).map((r) => r.id)).toEqual(['c'])
    expect(derivedDiscountDollars(rows, rows[4]!)).toBe(100)
  })
  it('a dollar amount is capped at its basis and flagged', () => {
    const rows = [...job892(), usd('d', 40000)]
    expect(derivedDiscountDollars(rows, rows[3]!)).toBe(37745)
    expect(discountExceedsBasis(rows, rows[3]!)).toBe(true)
    const fine = [...job892(), usd('d', 500)]
    expect(discountExceedsBasis(fine, fine[3]!)).toBe(false)
  })
  it('totals: work before discounts, discounts after the cap', () => {
    const rows = [...job892(), pct('d', 10), usd('e', 500)]
    expect(totalWorkDollars(rows)).toBe(37745)
    expect(totalDiscountDollars(rows)).toBe(4274.5)
  })
})

describe('syncDiscountRows', () => {
  it('writes the derived negative price for a percent row and pins count / kind / eye', () => {
    const rows = [...job892(), pct('d', 10, { count: 3, stage_kind: 'order', shared_with_gc: true })]
    const out = syncDiscountRows(rows)
    expect(out).not.toBe(rows)
    expect(out[3]).toMatchObject({ line_unit_price: -3774.5, count: 1, stage_kind: null, shared_with_gc: false })
    expect(out[0]).toBe(rows[0])
  })
  it('re-derives when a basis price changes, and returns the same array when nothing moved', () => {
    const synced = syncDiscountRows([...job892(), pct('d', 10)])
    expect(syncDiscountRows(synced)).toBe(synced)
    const bumped = synced.map((r) => (r.id === 'a' ? { ...r, line_unit_price: 20000 } : r))
    expect(syncDiscountRows(bumped)[3]!.line_unit_price).toBe(-4264.7)
  })
  it('keeps a typed dollar amount above the basis as typed (the row shows the cap), prunes dead basis ids', () => {
    const rows = [...job892(), usd('d', 40000, { discount_basis_ids: ['a', 'zzz'] })]
    const out = syncDiscountRows(rows)
    expect(out[3]!.line_unit_price).toBe(-40000)
    expect(out[3]!.discount_basis_ids).toEqual(['a'])
  })
  it('a percent row with no basis carries no price', () => {
    const out = syncDiscountRows([work('a', '', 100), pct('d', 10, { line_unit_price: -5 })])
    expect(out[1]!.line_unit_price).toBeNull()
  })
})

describe('shares follow the work, cents-exact', () => {
  it('splits 10% of job 892 across the three stages and sums to the cent', () => {
    const rows = [...job892(), pct('d', 10)]
    const shares = discountSharesByWorkRow(rows)
    expect(shares.get('a')![0]!.cents).toBe(150980)
    expect(shares.get('b')![0]!.cents).toBe(150980)
    expect(shares.get('c')![0]!.cents).toBe(75490)
    const sum = ['a', 'b', 'c'].reduce((s, id) => s + shares.get(id)![0]!.cents, 0)
    expect(sum).toBe(377450)
  })
  it('largest remainder never loses or invents a cent', () => {
    expect(allocateCentsLargestRemainder([100, 100, 100], 100)).toEqual([34, 33, 33])
    expect(allocateCentsLargestRemainder([1, 1, 1], 2)).toEqual([1, 1, 0])
    expect(allocateCentsLargestRemainder([], 5)).toEqual([])
    expect(allocateCentsLargestRemainder([5, 5], 0)).toEqual([0, 0])
  })
  it('a $500 discount over three unequal stages splits by dollar share', () => {
    const rows = [...job892(), usd('d', 500)]
    const shares = discountSharesByWorkRow(rows)
    const cents = ['a', 'b', 'c'].map((id) => shares.get(id)![0]!.cents)
    expect(cents.reduce((a, b) => a + b, 0)).toBe(50000)
    expect(cents[0]).toBe(cents[1])
    expect(cents[2]).toBeLessThan(cents[0]!)
  })
  it('net cents per work row and the bill lines for a draw', () => {
    const rows = [...job892(), pct('d', 10), usd('e', 500)]
    expect(netWorkLineCents(rows, rows[0]!)).toBe(1509800 - 150980 - 20000)
    const lines = discountBillLinesForWorkRows(rows, new Set(['a']))
    expect(lines).toEqual([
      { discountId: 'd', description: 'Negotiated discount (10%)', cents: 150980 },
      { discountId: 'e', description: 'Referral thank-you', cents: 20000 },
    ])
    expect(discountBillLinesForWorkRows(rows, new Set(['zzz']))).toEqual([])
  })
  it('two draws that split the basis print the whole discount exactly once', () => {
    const rows = [...job892(), pct('d', 10)]
    const draw1 = discountBillLinesForWorkRows(rows, new Set(['a', 'b']))[0]!.cents
    const draw2 = discountBillLinesForWorkRows(rows, new Set(['c']))[0]!.cents
    expect(draw1 + draw2).toBe(377450)
  })
})

describe('words on the row', () => {
  it('readout for all work lines, one work line, a chosen subset, and nothing priced', () => {
    const all = [...job892(), pct('d', 10)]
    expect(discountReadout(all, all[3]!)).toEqual({ head: '10% off', basis: 'all 3 work lines', tail: 'follows each draw · not on riders' })
    const one = [work('a', 'Water heater', 1200), usd('d', 100)]
    expect(discountReadout(one, one[1]!).basis).toBe('Water heater')
    expect(discountReadout(one, one[1]!).head).toBe('$100.00 off')
    const some = [...job892(), pct('d', 5, { discount_basis_ids: ['a', 'b'] })]
    expect(discountReadout(some, some[3]!).basis).toBe('Rough In, Top Out')
    const none = [work('a', '', 0), pct('d', 10)]
    expect(discountReadout(none, none[1]!).basis).toBe('nothing yet — add a priced work line')
  })
  it('twin label shows the other form', () => {
    const rows = [...job892(), pct('d', 10), usd('e', 500)]
    expect(discountTwinLabel(rows, rows[3]!)).toBe('−$3,774.50')
    expect(discountTwinLabel(rows, rows[4]!)).toBe('1.32%')
    expect(discountTwinLabel([pct('d', 10)], pct('d', 10))).toBe('−$0.00')
    expect(discountTwinLabel([usd('e', 5)], usd('e', 5))).toBe('—')
  })
  it('formats percents without trailing zeros', () => {
    expect(formatPct(10)).toBe('10%')
    expect(formatPct(7.5)).toBe('7.5%')
    expect(formatPct(12.345)).toBe('12.35%')
    expect(discountBillDescription('  ', null)).toBe('Discount')
    expect(discountBillDescription('Goodwill discount', 2.5)).toBe('Goodwill discount (2.5%)')
  })
})

describe('locking and persistence', () => {
  it('locks once any basis row is on a bill', () => {
    const rows = [...job892(), pct('d', 10, { discount_basis_ids: ['c'] })]
    expect(discountRowIsLocked(rows, rows[3]!)).toBe(false)
    const billed = rows.map((r) => (r.id === 'a' ? { ...r, invoice_id: 'inv1' } : r))
    expect(discountRowIsLocked(billed, billed[3]!)).toBe(false)
    const billedC = rows.map((r) => (r.id === 'c' ? { ...r, invoice_id: 'inv1' } : r))
    expect(discountRowIsLocked(billedC, billedC[3]!)).toBe(true)
  })
  it('basis positions count named rows only, and round-trip through DB order', () => {
    const rows = [work('a', '', 0), ...job892(), pct('d', 10, { discount_basis_ids: ['b', 'c'] })]
    expect(discountBasisPositions(rows, rows[4]!)).toEqual([1, 2])
    expect(discountBasisPositions(rows, pct('x', 1))).toBeNull()
    const db = [
      { id: 'B', sequence_order: 1 },
      { id: 'A', sequence_order: 0 },
      { id: 'C', sequence_order: 2 },
    ]
    expect(discountBasisIdsFromPositions(db, [1, 2])).toEqual(['B', 'C'])
    expect(discountBasisIdsFromPositions(db, null)).toBeNull()
    expect(discountBasisIdsFromPositions(db, [9])).toBeNull()
  })
})
