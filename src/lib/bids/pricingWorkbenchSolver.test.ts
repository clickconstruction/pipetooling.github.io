import { describe, expect, it } from 'vitest'
import { profitConcentration, solveWorkbenchPrices, type WorkbenchSolverRow } from './pricingWorkbenchSolver'

const rows: WorkbenchSolverRow[] = [
  { id: 'a', count: 10, rowCost: 1000, unitPrice: null, locked: false },
  { id: 'b', count: 2, rowCost: 2000, unitPrice: null, locked: false },
  { id: 'c', count: 4, rowCost: 1000, unitPrice: null, locked: false },
]

describe('solveWorkbenchPrices', () => {
  it('hits the target blended margin including overhead (within rounding)', () => {
    const s = solveWorkbenchPrices(rows, 1000, { targetMarginPct: 50 })!
    expect(s).not.toBeNull()
    // totalCost = 5000, target revenue = 10000
    expect(s.resultingRevenue).toBeGreaterThan(9900)
    expect(s.resultingRevenue).toBeLessThan(10150)
    expect(s.resultingMargin!).toBeGreaterThan(0.49)
    expect(s.resultingMargin!).toBeLessThan(0.52)
    // spreads proportionally to cost: b (2000 cost) earns twice a/c's revenue
    const rev = (id: string, count: number) => s.prices.get(id)! * count
    expect(rev('b', 2)).toBeGreaterThan(rev('a', 10) * 1.9)
  })

  it('solves for a target total instead when given', () => {
    const s = solveWorkbenchPrices(rows, 1000, { targetTotal: 12000 })!
    expect(s.resultingRevenue).toBeGreaterThan(11900)
    expect(s.resultingRevenue).toBeLessThan(12150)
  })

  it('holds locked rows and prices around them', () => {
    const withLock: WorkbenchSolverRow[] = [
      { ...rows[0]!, unitPrice: 500, locked: true }, // held revenue 5000
      rows[1]!,
      rows[2]!,
    ]
    const s = solveWorkbenchPrices(withLock, 1000, { targetMarginPct: 50 })!
    expect(s.prices.has('a')).toBe(false)
    // remaining rows cover 10000 - 5000 = 5000
    const solvedRev = s.prices.get('b')! * 2 + s.prices.get('c')! * 4
    expect(solvedRev).toBeGreaterThan(4900)
    expect(solvedRev).toBeLessThan(5200)
  })

  it('onlyUnpriced fills blanks and treats priced rows as held', () => {
    const partial: WorkbenchSolverRow[] = [
      { ...rows[0]!, unitPrice: 300 },
      rows[1]!,
      rows[2]!,
    ]
    const s = solveWorkbenchPrices(partial, 1000, { targetMarginPct: 50, onlyUnpriced: true })!
    expect(s.prices.has('a')).toBe(false)
    expect(s.prices.has('b')).toBe(true)
    expect(s.prices.has('c')).toBe(true)
  })

  it('skips uncosted rows entirely', () => {
    const withUncosted: WorkbenchSolverRow[] = [...rows, { id: 'u', count: 3, rowCost: 0, unitPrice: null, locked: false }]
    const s = solveWorkbenchPrices(withUncosted, 0, { targetMarginPct: 40 })!
    expect(s.prices.has('u')).toBe(false)
    expect(s.uncostedIds).toEqual(['u'])
  })

  it('rounds up to $5 when asked', () => {
    const s = solveWorkbenchPrices(rows, 1000, { targetMarginPct: 50, roundTo5: true })!
    for (const p of s.prices.values()) expect(p % 5).toBe(0)
  })

  it('returns null for invalid targets or nothing to solve', () => {
    expect(solveWorkbenchPrices(rows, 0, { targetMarginPct: 0 })).toBeNull()
    expect(solveWorkbenchPrices(rows, 0, { targetTotal: -5 })).toBeNull()
    expect(solveWorkbenchPrices(rows.map((r) => ({ ...r, locked: true })), 0, { targetMarginPct: 50 })).toBeNull()
    expect(solveWorkbenchPrices([], 0, { targetMarginPct: 50 })).toBeNull()
  })

  it('counts priced uncosted rows toward a target total (the typed number is the whole-bid total)', () => {
    // BP298 regression: a target of 150k landed at ~240k because ~90k of
    // no-cost-row revenue rode on top of the solve.
    const withPricedUncosted: WorkbenchSolverRow[] = [
      ...rows,
      { id: 'u1', count: 1, rowCost: 0, unitPrice: 3000, locked: false },
      { id: 'u2', count: 2, rowCost: 0, unitPrice: 500, locked: false }, // 1000
    ]
    const s = solveWorkbenchPrices(withPricedUncosted, 1000, { targetTotal: 12000 })!
    expect(s.prices.has('u1')).toBe(false)
    expect(s.prices.has('u2')).toBe(false)
    // whole-bid total (solved rows + 4000 of uncosted revenue) lands on target
    expect(s.resultingRevenue).toBeGreaterThan(11900)
    expect(s.resultingRevenue).toBeLessThan(12150)
  })

  it('mixes locked, priced-uncosted, and free rows without double-counting', () => {
    const mixed: WorkbenchSolverRow[] = [
      { ...rows[0]!, unitPrice: 500, locked: true }, // held revenue 5000
      rows[1]!,
      rows[2]!,
      { id: 'u', count: 1, rowCost: 0, unitPrice: 2000, locked: false },
    ]
    const s = solveWorkbenchPrices(mixed, 1000, { targetTotal: 15000 })!
    // free rows cover 15000 - 5000 held - 2000 uncosted = 8000
    const solvedRev = s.prices.get('b')! * 2 + s.prices.get('c')! * 4
    expect(solvedRev).toBeGreaterThan(7900)
    expect(solvedRev).toBeLessThan(8200)
    expect(s.resultingRevenue).toBeGreaterThan(14900)
    expect(s.resultingRevenue).toBeLessThan(15200)
  })

  it('lands the target blended margin when priced uncosted rows exist', () => {
    const withPricedUncosted: WorkbenchSolverRow[] = [
      ...rows,
      { id: 'u', count: 1, rowCost: 0, unitPrice: 2000, locked: false },
    ]
    const s = solveWorkbenchPrices(withPricedUncosted, 1000, { targetMarginPct: 50 })!
    // totalCost = 5000 → target revenue 10000 INCLUDING the 2000 uncosted revenue
    expect(s.resultingRevenue).toBeGreaterThan(9900)
    expect(s.resultingRevenue).toBeLessThan(10150)
    expect(s.resultingMargin!).toBeGreaterThan(0.49)
    expect(s.resultingMargin!).toBeLessThan(0.52)
  })

  it('floors at 20% of basis when a target total is absurdly low', () => {
    const s = solveWorkbenchPrices(rows, 0, { targetTotal: 1 })!
    expect(s.resultingRevenue).toBeGreaterThan(700) // 20% of 4000 basis, rounding up
  })
})

describe('profitConcentration', () => {
  it('sorts by profit and reports top-2 share', () => {
    const c = profitConcentration([
      { id: 'a', label: 'A', count: 1, rowCost: 100, unitPrice: 600 }, // 500
      { id: 'b', label: 'B', count: 1, rowCost: 100, unitPrice: 400 }, // 300
      { id: 'c', label: 'C', count: 1, rowCost: 100, unitPrice: 300 }, // 200
    ])
    expect(c.totalProfit).toBe(1000)
    expect(c.segments[0]!.id).toBe('a')
    expect(c.top2Share).toBeCloseTo(0.8, 5)
  })

  it('ignores unpriced and losing rows', () => {
    const c = profitConcentration([
      { id: 'a', label: 'A', count: 1, rowCost: 100, unitPrice: null },
      { id: 'b', label: 'B', count: 1, rowCost: 100, unitPrice: 50 },
    ])
    expect(c.totalProfit).toBe(0)
    expect(c.top2Share).toBeNull()
  })
})
