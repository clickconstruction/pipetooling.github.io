import { describe, expect, it } from 'vitest'
import {
  bundleComponentShares,
  computeMaterialsByStage,
  defaultSplitForFixture,
  describeRulePlan,
  describeSplitLong,
  describeWeights,
  effectiveSplit,
  indexStageSplits,
  normalizeWeights,
  parseSharesText,
  parseSovMaterialFactor,
  planRuleFill,
  scaleToContract,
  stageNumbersText,
  stageWeights,
  toggleStage,
  weightsFromStages,
  type StageSplitRecord,
} from './materialsByStage'

const r2 = (n: number) => Math.round(n * 100) / 100

describe('weights', () => {
  it('normalizes relative weights to shares and treats all-zero as unassigned', () => {
    expect(normalizeWeights(stageWeights(1, 1, 0))).toEqual({ rough_in: 0.5, top_out: 0.5, trim_set: 0 })
    expect(normalizeWeights(stageWeights(70, 30, 0))).toEqual({ rough_in: 0.7, top_out: 0.3, trim_set: 0 })
    expect(normalizeWeights(stageWeights(0, 0, 0))).toBeNull()
    expect(normalizeWeights(null)).toBeNull()
  })
  it('describes a split the way the margin reads', () => {
    expect(describeWeights(stageWeights(0, 1, 0))).toBe('')
    expect(describeWeights(stageWeights(1, 1, 0))).toBe('½ · ½')
    expect(describeWeights(stageWeights(1, 1, 1))).toBe('⅓ · ⅓ · ⅓')
    expect(describeWeights(stageWeights(70, 30, 0))).toBe('70 · 30')
    expect(stageNumbersText(stageWeights(1, 1, 0))).toBe('1 + 2')
    expect(describeSplitLong(stageWeights(1, 1, 0))).toBe('Rough In + Top Out (½ · ½)')
    expect(describeSplitLong(null)).toBe('no stage')
  })
  it('toggles a chip: add, remove, re-even, exclusive, and back to unassigned', () => {
    expect(toggleStage(null, 'top_out')).toEqual(stageWeights(0, 1, 0))
    expect(toggleStage(stageWeights(0, 1, 0), 'rough_in')).toEqual(stageWeights(1, 1, 0))
    // a typed tilt re-evens the moment the lit set changes
    expect(toggleStage(stageWeights(70, 30, 0), 'trim_set')).toEqual(stageWeights(1, 1, 1))
    expect(toggleStage(stageWeights(1, 1, 0), 'rough_in')).toEqual(stageWeights(0, 1, 0))
    expect(toggleStage(stageWeights(0, 1, 0), 'top_out')).toBeNull()
    expect(toggleStage(stageWeights(1, 1, 0), 'trim_set', true)).toEqual(stageWeights(0, 0, 1))
  })
  it('parses typed shares over the lit stages in stage order', () => {
    expect(parseSharesText('70/30', ['rough_in', 'top_out'])).toEqual(stageWeights(70, 30, 0))
    expect(parseSharesText('70 · 30', ['rough_in', 'top_out'])).toEqual(stageWeights(70, 30, 0))
    expect(parseSharesText('2:1', ['top_out', 'trim_set'])).toEqual(stageWeights(0, 2, 1))
    expect(parseSharesText('70', ['rough_in', 'top_out'])).toBeNull()
    expect(parseSharesText('0/0', ['rough_in', 'top_out'])).toBeNull()
    expect(parseSharesText('a/b', ['rough_in', 'top_out'])).toBeNull()
  })
  it('walks the scopes part → line → fixture', () => {
    const lookup = indexStageSplits([
      { countRowId: 'f', lineId: null, partId: null, weights: stageWeights(0, 0, 1), source: 'rule' },
      { countRowId: 'f', lineId: 'l1', partId: null, weights: stageWeights(1, 0, 0), source: 'hand' },
      { countRowId: 'f', lineId: 'l2', partId: 'p', weights: stageWeights(0, 1, 0), source: 'hand' },
    ])
    expect(effectiveSplit(lookup, 'f').scope).toBe('fixture')
    expect(effectiveSplit(lookup, 'f', 'l1').scope).toBe('line')
    expect(effectiveSplit(lookup, 'f', 'l1', 'x').scope).toBe('line')
    expect(effectiveSplit(lookup, 'f', 'l2', 'p').scope).toBe('part')
    expect(effectiveSplit(lookup, 'f', 'l2', 'q').scope).toBe('fixture')
    expect(effectiveSplit(lookup, 'g').weights).toBeNull()
  })
})

describe("Wendi's SpaceX page (9/18/26)", () => {
  // The printed Rough Takeoff with her pen marks: 2, 2, 3, 2, 2, 2, 2, ½, ½.
  const rows = [
    { id: 'wha300', fixture: 'WHA-300', count: 1 },
    { id: 'wha500', fixture: 'WHA-500', count: 1 },
    { id: 'hb3', fixture: 'HB-3', count: 2 },
    { id: 'wha200', fixture: 'WHA-200', count: 2 },
    { id: 'w34', fixture: 'ft of 3/4IN WATER', count: 140.23 },
    { id: 'w1', fixture: 'ft of 1IN WATER', count: 66.13 },
    { id: 'w12', fixture: 'ft of 1/2IN WATER', count: 719.46 },
    { id: 'ws4', fixture: 'ft of 4IN WASTE', count: 148.62 },
    { id: 'ws2', fixture: 'ft of 2IN WASTE', count: 729.53 },
  ]
  const lines = [
    { id: 'a', countRowId: 'wha300', partId: 'p1', sourceTemplateId: null, quantity: 1, unitPrice: 608.95 },
    { id: 'b', countRowId: 'wha500', partId: 'p2', sourceTemplateId: null, quantity: 1, unitPrice: 1717.33 },
    { id: 'c', countRowId: 'hb3', partId: 'p3', sourceTemplateId: null, quantity: 1, unitPrice: 505.97 },
    { id: 'd', countRowId: 'wha200', partId: 'p4', sourceTemplateId: null, quantity: 1, unitPrice: 396.33 },
    { id: 'e', countRowId: 'w34', partId: 'p5', sourceTemplateId: null, quantity: 1, unitPrice: 6.55 },
    { id: 'f', countRowId: 'w1', partId: 'p6', sourceTemplateId: null, quantity: 1, unitPrice: 9.63 },
    { id: 'g', countRowId: 'w12', partId: 'p7', sourceTemplateId: null, quantity: 1, unitPrice: 4.04 },
    { id: 'h', countRowId: 'ws4', partId: 'p8', sourceTemplateId: null, quantity: 1, unitPrice: 4.24 },
    { id: 'i', countRowId: 'ws2', partId: 'p9', sourceTemplateId: null, quantity: 1, unitPrice: 5.48 },
  ]

  it('the rules reproduce her marks', () => {
    const marks = rows.map((r) => stageNumbersText(defaultSplitForFixture(r.fixture)?.weights ?? null))
    expect(marks).toEqual(['2', '2', '3', '2', '2', '2', '2', '1 + 2', '1 + 2'])
    expect(defaultSplitForFixture('ft of 4IN WASTE')?.reason).toMatch(/waste pipe/)
  })

  it('and the halves she wrote by hand come out of the kernel', () => {
    const plan = planRuleFill(rows, [])
    const splits: StageSplitRecord[] = plan.toWrite.map((w) => ({ countRowId: w.countRowId, lineId: null, partId: null, weights: w.weights, source: 'rule' }))
    const s = computeMaterialsByStage({ countRows: rows, lines, splits, factor: 1.5 })
    const ws4 = s.fixtures.find((f) => f.countRowId === 'ws4')!
    expect(r2(ws4.raw)).toBe(630.15)
    // 315.075 on her page — she halved the rounded 630.15; the kernel halves 630.1488
    expect(ws4.byStage.rough_in).toBeCloseTo(315.0744, 3)
    expect(ws4.byStage.top_out).toBeCloseTo(315.0744, 3)
    const ws2 = s.fixtures.find((f) => f.countRowId === 'ws2')!
    expect(r2(ws2.byStage.rough_in)).toBe(1998.91)
    // Her page's totals halve rounded line totals; the kernel halves the exact ones (a cent apart).
    expect(s.byStage.rough_in).toBeCloseTo(2313.98, 1)
    expect(s.byStage.top_out).toBeCloseTo(9894.88, 1)
    expect(r2(s.byStage.trim_set)).toBe(1011.94)
    expect(s.scaled.rough_in).toBeCloseTo(3470.98, 1)
    expect(s.scaled.top_out).toBeCloseTo(14842.33, 1)
    expect(r2(s.scaled.trim_set)).toBe(1517.91)
    expect(r2(s.totalRaw)).toBe(r2(s.assignedRaw))
    expect(s.unassignedRaw).toBe(0)
    expect(s.stagedFixtureCount).toBe(9)
    expect(s.incompleteFixtureIds).toEqual([])
    expect(r2(s.sharesPct.rough_in + s.sharesPct.top_out + s.sharesPct.trim_set)).toBe(100)
  })
})

describe('computeMaterialsByStage', () => {
  const rows = [{ id: 'sk', fixture: 'SK-1', count: 2 }]

  it('leaves an unstaged fixture unassigned and says so', () => {
    const s = computeMaterialsByStage({
      countRows: rows,
      lines: [{ id: 'a', countRowId: 'sk', partId: 'p', sourceTemplateId: null, quantity: 1, unitPrice: 100 }],
      splits: [],
      factor: 1.5,
    })
    expect(s.unassignedRaw).toBe(200)
    expect(s.assignedRaw).toBe(0)
    expect(s.totalScaled).toBe(0)
    expect(s.incompleteFixtureIds).toEqual(['sk'])
    expect(s.fixtures[0]?.incomplete).toBe(true)
  })

  it('a line with its own split leaves the fixture split and is counted', () => {
    const s = computeMaterialsByStage({
      countRows: rows,
      lines: [
        { id: 'a', countRowId: 'sk', partId: 'p', sourceTemplateId: null, quantity: 1, unitPrice: 100 },
        { id: 'b', countRowId: 'sk', partId: 'q', sourceTemplateId: null, quantity: 2, unitPrice: 10 },
      ],
      splits: [
        { countRowId: 'sk', lineId: null, partId: null, weights: stageWeights(0, 0, 1), source: 'rule' },
        { countRowId: 'sk', lineId: 'b', partId: null, weights: stageWeights(1, 0, 0), source: 'hand' },
      ],
      factor: 2,
    })
    expect(s.byStage).toEqual({ rough_in: 40, top_out: 0, trim_set: 200 })
    expect(s.scaled).toEqual({ rough_in: 80, top_out: 0, trim_set: 400 })
    expect(s.ownSplitCount).toBe(1)
    expect(s.fixtures[0]?.ownSplitCount).toBe(1)
  })

  it('a bundle whose parts disagree splits its price by catalog value; unpriced parts count as an average part', () => {
    const parts = [
      { partId: 'A', quantity: 1, unitPrice: 73.75, hasPrice: true },
      { partId: 'B', quantity: 1, unitPrice: 41.83, hasPrice: true },
      { partId: 'C', quantity: 1, unitPrice: 0, hasPrice: false },
      { partId: 'D', quantity: 1, unitPrice: 0, hasPrice: false },
    ]
    const shares = bundleComponentShares(parts)
    expect(r2(shares.get('C')!)).toBe(0.25)
    expect(r2([...shares.values()].reduce((a, b) => a + b, 0))).toBe(1)
    const s = computeMaterialsByStage({
      countRows: [{ id: 'sk', fixture: 'SK-1', count: 1 }],
      lines: [{ id: 'bundle', countRowId: 'sk', partId: null, sourceTemplateId: 'tpl', quantity: 1, unitPrice: 392.07 }],
      splits: [
        { countRowId: 'sk', lineId: null, partId: null, weights: stageWeights(1, 0, 0), source: 'hand' },
        { countRowId: 'sk', lineId: 'bundle', partId: 'C', weights: stageWeights(0, 0, 1), source: 'hand' },
      ],
      bundleParts: new Map([['tpl', parts]]),
      factor: 1,
    })
    expect(r2(s.byStage.trim_set)).toBe(98.02)
    expect(r2(s.byStage.rough_in)).toBe(294.05)
    expect(s.ownSplitCount).toBe(1)
  })

  it('a bundle with no part-level split follows its line / fixture whole, even when its parts are loaded', () => {
    const s = computeMaterialsByStage({
      countRows: [{ id: 'sk', fixture: 'SK-1', count: 3 }],
      lines: [{ id: 'bundle', countRowId: 'sk', partId: null, sourceTemplateId: 'tpl', quantity: 1, unitPrice: 100 }],
      splits: [{ countRowId: 'sk', lineId: null, partId: null, weights: stageWeights(0, 1, 0), source: 'hand' }],
      bundleParts: new Map([['tpl', [{ partId: 'A', quantity: 1, unitPrice: 5, hasPrice: true }]]]),
      factor: 1,
    })
    expect(s.byStage).toEqual({ rough_in: 0, top_out: 300, trim_set: 0 })
  })

  it('the order rounding follows the fixture’s staged dollars, and stays unassigned when nothing is staged', () => {
    const base = {
      countRows: [{ id: 'w', fixture: 'ft of 1/2IN WATER', count: 100 }, { id: 'x', fixture: 'ft of 2IN WASTE', count: 10 }],
      lines: [
        { id: 'a', countRowId: 'w', partId: 'p', sourceTemplateId: null, quantity: 1, unitPrice: 1 },
        { id: 'b', countRowId: 'x', partId: 'q', sourceTemplateId: null, quantity: 1, unitPrice: 1 },
      ],
      roundingExtraByCountRow: new Map([['w', 20], ['x', 4]]),
      factor: 1,
    }
    const s = computeMaterialsByStage({ ...base, splits: [{ countRowId: 'w', lineId: null, partId: null, weights: stageWeights(1, 1, 0), source: 'hand' }] })
    expect(s.byStage).toEqual({ rough_in: 60, top_out: 60, trim_set: 0 })
    expect(s.unassignedRaw).toBe(14)
    expect(s.totalRaw).toBe(134)
  })

  it('scales to the contract by the raw shares', () => {
    const s = computeMaterialsByStage({
      countRows: [{ id: 'a', fixture: 'A', count: 1 }, { id: 'b', fixture: 'B', count: 1 }],
      lines: [
        { id: 'l1', countRowId: 'a', partId: 'p', sourceTemplateId: null, quantity: 1, unitPrice: 30 },
        { id: 'l2', countRowId: 'b', partId: 'q', sourceTemplateId: null, quantity: 1, unitPrice: 70 },
      ],
      splits: [
        { countRowId: 'a', lineId: null, partId: null, weights: stageWeights(1, 0, 0), source: 'hand' },
        { countRowId: 'b', lineId: null, partId: null, weights: stageWeights(0, 0, 1), source: 'hand' },
      ],
      factor: 1.5,
    })
    expect(scaleToContract(s, 1000)).toEqual({ rough_in: 300, top_out: 0, trim_set: 700 })
    expect(scaleToContract({ byStage: { rough_in: 0, top_out: 0, trim_set: 0 }, assignedRaw: 0 }, 1000)).toBeNull()
  })
})

describe('rules and the fill plan', () => {
  it('places the Palmer Winery names', () => {
    const mark = (n: string) => stageNumbersText(defaultSplitForFixture(n)?.weights ?? null)
    expect(mark('FCO')).toBe('1')
    expect(mark('WCO')).toBe('1')
    expect(mark('2way co')).toBe('1')
    expect(mark('GREASE INTERCEPTOR')).toBe('1')
    expect(mark('SAMPLE WELL')).toBe('1')
    expect(mark('hd-1')).toBe('1')
    expect(mark('TMV')).toBe('2')
    expect(mark('ft of 3/4in Gas')).toBe('2')
    expect(mark('ft of 1 1/2IN WATER')).toBe('2')
    expect(mark('ft of 3IN WASTE')).toBe('1 + 2')
    expect(mark('WC-1')).toBe('3')
    expect(mark('WH2')).toBe('3')
    expect(mark('L-2')).toBe('3')
    expect(defaultSplitForFixture('travel/rentals - blanco')).toBeNull()
    expect(defaultSplitForFixture('')).toBeNull()
  })

  it('keeps hand-set splits, refreshes rule splits, and lists what it cannot place', () => {
    const rows = [
      { id: 'wc', fixture: 'WC-1', count: 4 },
      { id: 'w', fixture: 'ft of 1IN WATER', count: 50 },
      { id: 't', fixture: 'travel', count: 1 },
      { id: 'ok', fixture: 'L-1', count: 2 },
    ]
    const existing: StageSplitRecord[] = [
      { countRowId: 'wc', lineId: null, partId: null, weights: stageWeights(0, 1, 0), source: 'hand' },
      { countRowId: 'w', lineId: null, partId: null, weights: stageWeights(1, 0, 0), source: 'rule' },
      { countRowId: 'ok', lineId: null, partId: null, weights: stageWeights(0, 0, 1), source: 'rule' },
    ]
    const plan = planRuleFill(rows, existing)
    expect(plan.keptByHand).toBe(1)
    expect(plan.toWrite.map((w) => [w.countRowId, stageNumbersText(w.weights)])).toEqual([['w', '2']])
    expect(plan.unplaced).toEqual([{ countRowId: 't', fixture: 'travel' }])
    expect(describeRulePlan(plan, 1)).toBe('1 fixture staged by rule · 1 set by hand kept · 1 has no stage (allowance)')
  })
})

describe('the factor', () => {
  it('reads 1.5 unless a sane number is stored', () => {
    expect(parseSovMaterialFactor(null)).toBe(1.5)
    expect(parseSovMaterialFactor('')).toBe(1.5)
    expect(parseSovMaterialFactor('1.35')).toBe(1.35)
    expect(parseSovMaterialFactor(2)).toBe(2)
    expect(parseSovMaterialFactor(0.5)).toBe(1.5)
    expect(parseSovMaterialFactor(9)).toBe(1.5)
    expect(parseSovMaterialFactor('x')).toBe(1.5)
    expect(parseSovMaterialFactor(null, 1.4)).toBe(1.4)
    expect(weightsFromStages([])).toBeNull()
  })
})
