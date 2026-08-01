import { describe, expect, it } from 'vitest'
import { buildWorkflowMoneyFlow, type MoneyFlowProjectionInput } from './workflowMoneyFlow'

function proj(overrides: Partial<MoneyFlowProjectionInput> & { id: string }): MoneyFlowProjectionInput {
  return { step_id: null, placement: null, amount: 0, sequence_order: null, ...overrides }
}

describe('buildWorkflowMoneyFlow', () => {
  const steps = ['s1', 's2', 's3']

  it('splits markers by placement and accumulates running projected totals in flow order', () => {
    const flow = buildWorkflowMoneyFlow(
      steps,
      [
        proj({ id: 'a', step_id: 's1', placement: 'before', amount: 42000 }),
        proj({ id: 'b', step_id: 's1', placement: 'after', amount: 18500 }),
        proj({ id: 'c', step_id: 's2', placement: 'before', amount: 24000 }),
      ],
      {},
    )
    expect(flow.beforeByStep.s1?.map((m) => m.runningProjected)).toEqual([42000])
    expect(flow.afterByStep.s1?.map((m) => m.runningProjected)).toEqual([60500])
    expect(flow.beforeByStep.s2?.map((m) => m.runningProjected)).toEqual([84500])
    expect(flow.stepProjectedTotal).toEqual({ s1: 60500, s2: 24000 })
  })

  it('before markers exclude the step itself from runningSpent; after markers include it', () => {
    const flow = buildWorkflowMoneyFlow(
      steps,
      [
        proj({ id: 'a', step_id: 's2', placement: 'before', amount: 100 }),
        proj({ id: 'b', step_id: 's2', placement: 'after', amount: 100 }),
      ],
      { s1: 38120, s2: 5000, s3: 999 },
    )
    expect(flow.beforeByStep.s2?.[0]?.runningSpent).toBe(38120)
    expect(flow.afterByStep.s2?.[0]?.runningSpent).toBe(43120)
  })

  it('ignores unanchored projections and unknown step ids', () => {
    const flow = buildWorkflowMoneyFlow(
      steps,
      [
        proj({ id: 'a', step_id: null, amount: 500 }),
        proj({ id: 'b', step_id: 'gone', placement: 'before', amount: 500 }),
      ],
      {},
    )
    expect(flow.beforeByStep).toEqual({})
    expect(flow.afterByStep).toEqual({})
    expect(flow.stepProjectedTotal).toEqual({})
  })

  it('orders markers within a group by sequence_order (nulls last) then id, and defaults null placement to after', () => {
    const flow = buildWorkflowMoneyFlow(
      steps,
      [
        proj({ id: 'z', step_id: 's1', placement: 'after', amount: 1, sequence_order: null }),
        proj({ id: 'a', step_id: 's1', placement: null, amount: 2, sequence_order: 2 }),
        proj({ id: 'm', step_id: 's1', placement: 'after', amount: 3, sequence_order: 1 }),
      ],
      {},
    )
    expect(flow.afterByStep.s1?.map((m) => m.projection.id)).toEqual(['m', 'a', 'z'])
    expect(flow.afterByStep.s1?.map((m) => m.runningProjected)).toEqual([3, 5, 6])
  })
})
