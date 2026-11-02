import { describe, expect, it } from 'vitest'

import { stageSharesOf, type StageShareLine } from './stageShares'

const line = (p: Partial<StageShareLine> & { id: string }): StageShareLine => ({
  name: p.id,
  stage_kind: null,
  progress_pct: null,
  sequence_order: 0,
  laborHours: 0,
  laborUsd: 0,
  ...p,
})

describe('stageSharesOf', () => {
  it('cuts the budget by the in-order stages in their sequence, then the any-time lines', () => {
    const shares = stageSharesOf([
      line({ id: 'trim', name: 'Trim Set', stage_kind: 'order', sequence_order: 3, laborHours: 20, laborUsd: 900 }),
      line({ id: 'rough', name: 'Rough In', stage_kind: 'order', sequence_order: 1, laborHours: 56, laborUsd: 2538, progress_pct: 40 }),
      line({ id: 'water', name: 'Water heater any time', stage_kind: 'any', sequence_order: 2, laborHours: 4, laborUsd: 180 }),
      line({ id: 'top', name: 'Top Out', stage_kind: 'order', sequence_order: '2', laborHours: 20, laborUsd: 900 }),
    ])
    expect(shares.map((s) => s.name)).toEqual(['Rough In', 'Top Out', 'Trim Set', 'Water heater any time'])
    expect(shares.map((s) => s.kind)).toEqual(['order', 'order', 'order', 'any'])
    expect(shares[0]).toMatchObject({ id: 'rough', laborHours: 56, laborUsd: 2538, pctDone: 40, sharePct: 56 })
    expect(shares[1]?.pctDone).toBeNull()
    expect(shares.reduce((s, p) => s + p.sharePct, 0)).toBeCloseTo(100)
  })

  it('folds the lines with hours and no stage into one trailing piece, its percent weighted by hours', () => {
    const shares = stageSharesOf([
      line({ id: 'rough', name: 'Rough In', stage_kind: 'order', sequence_order: 1, laborHours: 50 }),
      line({ id: 'a', name: 'Cleanout', laborHours: 30, laborUsd: 100, progress_pct: 100 }),
      line({ id: 'b', name: 'Hose bib', laborHours: 10, laborUsd: 50, progress_pct: 0 }),
      line({ id: 'c', name: 'Permit', laborHours: 10, laborUsd: 20 }),
    ])
    expect(shares.map((s) => s.name)).toEqual(['Rough In', 'Other lines'])
    expect(shares[1]).toMatchObject({ id: 'other', kind: 'other', laborHours: 50, laborUsd: 170, sharePct: 50 })
    // 100% on 30 h and 0% on 10 h: 75%; the unreported line does not vote.
    expect(shares[1]?.pctDone).toBe(75)
  })

  it('keeps a single other line\'s own name and reads no percent when none reported', () => {
    const shares = stageSharesOf([
      line({ id: 'rough', name: 'Rough In', stage_kind: 'order', sequence_order: 1, laborHours: 50 }),
      line({ id: 'a', name: 'Cleanout', laborHours: 30 }),
    ])
    expect(shares[1]).toMatchObject({ name: 'Cleanout', pctDone: null })
  })

  it('draws nothing with fewer than two pieces', () => {
    expect(stageSharesOf([line({ id: 'rough', stage_kind: 'order', laborHours: 50 })])).toEqual([])
    // Other lines alone never make a piece: they fold only behind a stage.
    expect(stageSharesOf([line({ id: 'a', laborHours: 30 }), line({ id: 'b', laborHours: 10 })])).toEqual([])
    expect(stageSharesOf([])).toEqual([])
  })

  it('skips a stage with no labor, a discount line and a blank name reads Stage', () => {
    const shares = stageSharesOf([
      line({ id: 'rough', name: '  ', stage_kind: 'order', sequence_order: 1, laborHours: 50 }),
      line({ id: 'empty', name: 'Allowance', stage_kind: 'order', sequence_order: 2, laborHours: 0 }),
      line({ id: 'disc', name: 'Discount', line_kind: 'discount', laborHours: 100 }),
      line({ id: 'trim', name: 'Trim Set', stage_kind: 'order', sequence_order: 3, laborHours: 50 }),
    ])
    expect(shares.map((s) => s.name)).toEqual(['Stage', 'Trim Set'])
    expect(shares.map((s) => s.sharePct)).toEqual([50, 50])
  })
})
