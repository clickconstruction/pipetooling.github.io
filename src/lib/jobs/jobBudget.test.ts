import { describe, expect, it } from 'vitest'
import { budgetCompletenessUsable, budgetForBurn, budgetWhyWords, componentBurn, parseJobBudgetCompleteness, resolveJobBudget } from './jobBudget'

const bidRow = {
  kind: 'bid',
  bid_id: 'b66',
  bid_version_id: null,
  labor_hours: '1180',
  labor_rate: '38',
  labor_usd: '44840',
  materials_usd: '31200',
  subs_usd: '6500',
  other_usd: '2900',
  total_direct_usd: '85440',
  completeness: { rows_total: 26, rows_with_hours: 23, rate_set: true, materials_source: 'takeoff', usable: false },
  taken_at: '2026-09-11T15:00:00Z',
  taken_by: 'u-wendi',
  note: null,
}

describe('resolveJobBudget', () => {
  it('a bid snapshot: ◆, the components as numbers, the completeness, no target', () => {
    const r = resolveJobBudget({ row: bidRow, priceUsd: 123_600, targetMarginPct: 35 })
    expect(r.source).toBe('bid')
    expect(r.glyph).toBe('◆')
    expect(r.directUsd).toBe(85_440)
    expect(r.components).toEqual({ laborHours: 1180, laborRate: 38, laborUsd: 44_840, materialsUsd: 31_200, subsUsd: 6_500, otherUsd: 2_900 })
    expect(r.completeness).toEqual({ rows_total: 26, rows_with_hours: 23, rate_set: true, materials_source: 'takeoff', usable: false })
    expect(r.targetMarginPct).toBeNull()
    expect(r.bidId).toBe('b66')
    expect(r.partial).toEqual({ labor: true, materials: true, subs: true })
    expect(budgetForBurn(r)).toBe(85_440)
  })
  it('a typed budget: ✎ and the sum when total is missing', () => {
    const r = resolveJobBudget({ row: { kind: 'typed', labor_hours: 2400, labor_rate: 31.23, labor_usd: 74_952, materials_usd: 68_000, subs_usd: 12_500, other_usd: 0, total_direct_usd: null }, priceUsd: 249_716, targetMarginPct: 35 })
    expect(r.source).toBe('typed')
    expect(r.glyph).toBe('✎')
    expect(r.directUsd).toBe(155_452)
  })
  it('no row: ≈ price × (1 − target), the kernel default when the chip is off; null without a price', () => {
    expect(resolveJobBudget({ row: null, priceUsd: 249_716, targetMarginPct: 35 })).toMatchObject({ source: 'assumed', glyph: '≈', directUsd: 249_716 * 0.65, targetMarginPct: 35, components: null })
    expect(resolveJobBudget({ row: null, priceUsd: 100_000, targetMarginPct: 0 })).toMatchObject({ directUsd: 65_000, targetMarginPct: 35 })
    expect(resolveJobBudget({ row: null, priceUsd: null, targetMarginPct: 35 }).directUsd).toBeNull()
    expect(budgetForBurn(resolveJobBudget({ row: null, priceUsd: 100_000, targetMarginPct: 35 }))).toBeNull()
  })
  it('an hours-only bid snapshot is partial: labor stands on the bid, materials and subs do not', () => {
    const r = resolveJobBudget({ row: { ...bidRow, labor_rate: null, labor_usd: 0, materials_usd: 0, subs_usd: 0, other_usd: 0, total_direct_usd: 0 }, priceUsd: 50_000, targetMarginPct: 35 })
    expect(r.partial).toEqual({ labor: true, materials: false, subs: false })
    expect(r.directUsd).toBeNull()
    expect(budgetForBurn(r)).toBeNull()
  })
})

describe('completeness', () => {
  it('parses the RPC shape defensively', () => {
    expect(parseJobBudgetCompleteness({ rows_total: '3', rows_with_hours: 3, rate_set: true, materials_source: 'po', usable: true })).toEqual({ rows_total: 3, rows_with_hours: 3, rate_set: true, materials_source: 'po', usable: true })
    expect(parseJobBudgetCompleteness({ materials_source: 'weird' })).toEqual({ rows_total: 0, rows_with_hours: 0, rate_set: false, materials_source: 'none', usable: false })
    expect(parseJobBudgetCompleteness(null)).toBeNull()
  })
  it('usable = hours on 90 % of the rows and a rate (the Labor tab\'s rule)', () => {
    expect(budgetCompletenessUsable({ rows_total: 10, rows_with_hours: 9, rate_set: true })).toBe(true)
    expect(budgetCompletenessUsable({ rows_total: 10, rows_with_hours: 8, rate_set: true })).toBe(false)
    expect(budgetCompletenessUsable({ rows_total: 10, rows_with_hours: 10, rate_set: false })).toBe(false)
    expect(budgetCompletenessUsable({ rows_total: 0, rows_with_hours: 0, rate_set: true })).toBe(false)
  })
})

describe('componentBurn + budgetWhyWords', () => {
  const fmt = (x: number) => x.toLocaleString('en-US', { maximumFractionDigits: 0 })
  it('measures used against the budget and the work done, and projects at today\'s pace', () => {
    const b = componentBurn({ usedUsd: 37_900, budgetUsd: 31_200, pctDone: 77 })
    expect(b.pct).toBeCloseTo(121.5, 1)
    expect(b.aheadPts).toBeCloseTo(44.5, 1)
    expect(b.atCompletionUsd).toBeCloseTo(49_221, 0)
    expect(b.overUsd).toBe(6_700)
    expect(componentBurn({ usedUsd: 500, budgetUsd: null, pctDone: 50 })).toMatchObject({ pct: null, aheadPts: null, atCompletionUsd: 1_000, overUsd: null })
    expect(componentBurn({ usedUsd: 0, budgetUsd: null, pctDone: null }).atCompletionUsd).toBeNull()
  })
  it('says materials blew the estimate while labor is only slightly ahead', () => {
    const words = budgetWhyWords({
      labor: componentBurn({ usedUsd: 38_760, budgetUsd: 44_840, pctDone: 77 }),
      materials: componentBurn({ usedUsd: 37_900, budgetUsd: 31_200, pctDone: 77 }),
      subs: componentBurn({ usedUsd: 3_700, budgetUsd: 6_500, pctDone: 77 }),
      pctDone: 77,
      fmt,
    })
    expect(words).toBe('Materials is $6,700 over the estimate with 23 % of the work left, and labor is 9 points ahead of progress, and subs are 20 points under.')
  })
  it('has words for nothing to read and for everything on pace', () => {
    const none = componentBurn({ usedUsd: 0, budgetUsd: null, pctDone: null })
    expect(budgetWhyWords({ labor: none, materials: none, subs: none, pctDone: null, fmt })).toBe('No component budget to read against yet.')
    const on = componentBurn({ usedUsd: 50, budgetUsd: 100, pctDone: 50 })
    expect(budgetWhyWords({ labor: on, materials: on, subs: on, pctDone: 50, fmt })).toBe('Every component is on pace with the work.')
  })
})
