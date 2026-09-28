import { describe, expect, it } from 'vitest'
import {
  buildUnifiedFinancialRows,
  panelMoneyTotals,
  type UnifiedLineItemInput,
  type UnifiedProjectionInput,
} from './unifiedFinancialRows'

type Proj = UnifiedProjectionInput & { id: string }
type Item = UnifiedLineItemInput & { id: string }

function proj(id: string, stage_name: string, amount: number | null, extra: Partial<Proj> = {}): Proj {
  return { id, stage_name, amount, memo: '', sequence_order: 0, ...extra }
}

function item(id: string, amount: number | null, memo: string | null = ''): Item {
  return { id, amount, memo }
}

describe('buildUnifiedFinancialRows', () => {
  it('is empty with no projections and no line items', () => {
    expect(buildUnifiedFinancialRows([], [{ id: 's1', name: 'Rough' }], {})).toEqual([])
  })

  it('pairs a stage’s projection with its line item on one row', () => {
    const p = proj('p1', 'Rough', 42000, { memo: 'draw 1' })
    const li = item('i1', 38120, 'pipe')
    const rows = buildUnifiedFinancialRows([p], [{ id: 's1', name: 'Rough' }], { s1: [li] })
    expect(rows).toEqual([
      {
        stageName: 'Rough',
        memo: 'draw 1 / pipe',
        projectionAmount: 42000,
        projection: p,
        ledgerAmount: 38120,
        ledgerItem: li,
        ledgerStepName: 'Rough',
      },
    ])
  })

  it('sorts the stages by name and names each stage on its first row only', () => {
    const rows = buildUnifiedFinancialRows(
      [proj('p1', 'Top Out', 100), proj('p2', 'Rough', 200), proj('p3', 'Rough', 300, { sequence_order: 1 })],
      [],
      {},
    )
    expect(rows.map((r) => [r.stageName, r.projectionAmount])).toEqual([
      ['Rough', 200],
      ['', 300],
      ['Top Out', 100],
    ])
  })

  it('orders a stage’s projections by sequence_order, a missing one as 0', () => {
    const rows = buildUnifiedFinancialRows(
      [
        proj('late', 'Rough', 3, { sequence_order: 5 }),
        proj('none', 'Rough', 1, { sequence_order: null }),
        proj('mid', 'Rough', 2, { sequence_order: 2 }),
      ],
      [],
      {},
    )
    expect(rows.map((r) => r.projection?.id)).toEqual(['none', 'mid', 'late'])
  })

  it('pads the shorter side with nulls — more line items than projections', () => {
    const rows = buildUnifiedFinancialRows([proj('p1', 'Rough', 1000)], [{ id: 's1', name: 'Rough' }], {
      s1: [item('i1', 10, 'a'), item('i2', 20, 'b'), item('i3', 30, 'c')],
    })
    expect(rows.map((r) => [r.projectionAmount, r.ledgerAmount, r.memo])).toEqual([
      [1000, 10, 'a'],
      [null, 20, 'b'],
      [null, 30, 'c'],
    ])
    expect(rows[1]?.projection).toBeNull()
  })

  it('pads the shorter side with nulls — more projections than line items', () => {
    const rows = buildUnifiedFinancialRows(
      [proj('p1', 'Rough', 1000, { memo: 'one' }), proj('p2', 'Rough', 500, { memo: 'two', sequence_order: 1 })],
      [{ id: 's1', name: 'Rough' }],
      { s1: [item('i1', 10, 'pipe')] },
    )
    expect(rows.map((r) => [r.projectionAmount, r.ledgerAmount, r.ledgerStepName, r.memo])).toEqual([
      [1000, 10, 'Rough', 'one / pipe'],
      [500, null, null, 'two'],
    ])
  })

  it('a row with no memo on either side shows a dash', () => {
    const rows = buildUnifiedFinancialRows([proj('p1', 'Rough', 1, { memo: null })], [{ id: 's1', name: 'Rough' }], {
      s1: [item('i1', 2, '')],
    })
    expect(rows[0]?.memo).toBe('—')
  })

  it('a stage with line items and no projection gets its own block', () => {
    const rows = buildUnifiedFinancialRows([], [{ id: 's1', name: 'Trim' }], { s1: [item('i1', 75)] })
    expect(rows.map((r) => [r.stageName, r.projectionAmount, r.ledgerAmount])).toEqual([['Trim', null, 75]])
  })

  it('a step with no line items adds no block of its own', () => {
    const rows = buildUnifiedFinancialRows(
      [proj('p1', 'Rough', 1)],
      [
        { id: 's1', name: 'Rough' },
        { id: 's2', name: 'Trim' },
      ],
      { s2: [] },
    )
    expect(rows.map((r) => r.stageName)).toEqual(['Rough'])
  })

  it('trims a projection’s stage name to match the step', () => {
    const rows = buildUnifiedFinancialRows([proj('p1', '  Rough ', 1000)], [{ id: 's1', name: 'Rough' }], {
      s1: [item('i1', 10)],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ stageName: 'Rough', projectionAmount: 1000, ledgerAmount: 10 })
  })

  it('does not trim a step’s name — "Rough " sits apart from the projections for "Rough"', () => {
    const rows = buildUnifiedFinancialRows([proj('p1', 'Rough', 1000)], [{ id: 's1', name: 'Rough ' }], {
      s1: [item('i1', 10)],
    })
    expect(rows.map((r) => [r.stageName, r.projectionAmount, r.ledgerAmount])).toEqual([
      ['Rough', 1000, null],
      ['Rough ', null, 10],
    ])
  })

  it('two steps with one name share a block, their items in step order', () => {
    const rows = buildUnifiedFinancialRows(
      [],
      [
        { id: 's1', name: 'Rough' },
        { id: 's2', name: 'Rough' },
      ],
      { s2: [item('b', 2)], s1: [item('a', 1)] },
    )
    expect(rows.map((r) => r.ledgerItem?.id)).toEqual(['a', 'b'])
    expect(rows.map((r) => r.stageName)).toEqual(['Rough', ''])
  })

  it('keeps a 0 amount as 0 and a null amount as null', () => {
    const rows = buildUnifiedFinancialRows(
      [proj('p1', 'Rough', 0), proj('p2', 'Rough', null, { sequence_order: 1 })],
      [{ id: 's1', name: 'Rough' }],
      { s1: [item('i1', 0), item('i2', null)] },
    )
    expect(rows.map((r) => [r.projectionAmount, r.ledgerAmount])).toEqual([
      [0, 0],
      [null, null],
    ])
  })

  it('leaves out line items filed under a step that is not in the list', () => {
    const rows = buildUnifiedFinancialRows([], [{ id: 's1', name: 'Rough' }], {
      s1: [item('i1', 10)],
      gone: [item('i2', 999)],
    })
    expect(rows.map((r) => r.ledgerAmount)).toEqual([10])
  })

  it('does not reorder the projections it was given', () => {
    const given = [proj('b', 'Rough', 2, { sequence_order: 2 }), proj('a', 'Rough', 1, { sequence_order: 1 })]
    buildUnifiedFinancialRows(given, [], {})
    expect(given.map((p) => p.id)).toEqual(['b', 'a'])
  })
})

describe('panelMoneyTotals', () => {
  it('totals both sides and what is left', () => {
    expect(
      panelMoneyTotals([{ amount: 42000 }, { amount: 18500 }], {
        s1: [{ amount: 38120 }, { amount: 880 }],
        s2: [{ amount: 5000 }],
      }),
    ).toEqual({ projectionsTotal: 60500, ledgerTotal: 44000, left: 16500 })
  })

  it('overspent: Left is negative', () => {
    expect(panelMoneyTotals([{ amount: 100 }], { s1: [{ amount: 250 }] }).left).toBe(-150)
  })

  it('counts null amounts as 0 and credits as negatives', () => {
    expect(
      panelMoneyTotals([{ amount: null }, { amount: -500 }], { s1: [{ amount: null }, { amount: -25 }] }),
    ).toEqual({ projectionsTotal: -500, ledgerTotal: -25, left: -475 })
  })

  it('is all zeros with nothing loaded', () => {
    expect(panelMoneyTotals([], {})).toEqual({ projectionsTotal: 0, ledgerTotal: 0, left: 0 })
  })

  it('counts every loaded line item, whatever step it is filed under', () => {
    expect(panelMoneyTotals([], { s1: [{ amount: 10 }], gone: [{ amount: 999 }] }).ledgerTotal).toBe(1009)
  })

  it('adds item by item in one running total, as the page always has', () => {
    const byStep = { s1: [{ amount: 0.1 }, { amount: 0.2 }], s2: [{ amount: 0.3 }, { amount: 0.4 }] }
    let running = 0
    for (const a of [0.1, 0.2, 0.3, 0.4]) running += a
    expect(panelMoneyTotals([], byStep).ledgerTotal).toBe(running)
  })
})
