import { describe, expect, it } from 'vitest'
import { allPeople, backChargesWaiting, gcBackChargesNeedsYou, gcReducer, initialGcState, type GcState } from './gcModel'

const ids = { projectId: 'fairoaksd', packageId: 'fsteel', chargeId: 'fsteel-bc-1' }

const on = (state: GcState, today: string): GcState => ({ ...state, today })

describe('back-charges waiting on the office (the owner, 2026-10-05)', () => {
  it('an open charge before its answer day is theirs to answer, not on the list', () => {
    const state = initialGcState()
    expect(backChargesWaiting(state)).toEqual([])
    expect(gcBackChargesNeedsYou(state)).toBeNull()
  })

  it('a dispute is a Needs you line of its own, keep it or drop it, and never a person to call', () => {
    const before = initialGcState()
    const state = gcReducer(before, { type: 'tradeAnswerBackCharge', ...ids, agree: false, note: 'The line was not marked.' })
    expect(backChargesWaiting(state).map((w) => [w.company, w.why, w.charge.amount])).toEqual([['Iron Horse Fabrication', 'disputed', 1_250]])
    expect(gcBackChargesNeedsYou(state)).toEqual({
      count: 1,
      late: false,
      title: '1 back-charge to settle in GC mode',
      detail: 'Iron Horse Fabrication disputed $1,250 on Fair Oaks Shops, Building D. Keep it or drop it with a reason.',
      projectId: 'fairoaksd',
      chargeId: 'fsteel-bc-1',
    })
    // Our move: the people count does not change.
    expect(allPeople(state).count).toBe(allPeople(before).count)
    // A week and a day later it reads late.
    expect(gcBackChargesNeedsYou(on(state, '2026-10-10'))?.late).toBe(true)
    // Settled: off the list.
    const dropped = gcReducer(state, { type: 'settleBackCharge', ...ids, keep: false, note: 'Fair point, no markings.' })
    expect(gcBackChargesNeedsYou(dropped)).toBeNull()
  })

  it('their answer day passing with no answer puts it on the list', () => {
    const state = on(initialGcState(), '2026-10-06')
    expect(backChargesWaiting(state).map((w) => w.why)).toEqual(['noAnswer'])
    expect(gcBackChargesNeedsYou(state)?.detail).toBe('Iron Horse Fabrication never answered $1,250 on Fair Oaks Shops, Building D. Keep it or drop it with a reason.')
  })

  it('agreed waits for an approved draw, then reads take it off before the draw is paid, and taking it clears it', () => {
    let state = gcReducer(initialGcState(), { type: 'tradeAnswerBackCharge', ...ids, agree: true, note: '' })
    // Draw 2 is only requested: nothing to do yet.
    expect(gcBackChargesNeedsYou(state)).toBeNull()
    state = gcReducer(state, { type: 'approveDraw', projectId: 'fairoaksd', packageId: 'fsteel', drawId: 'fsteel-draw-2' })
    expect(backChargesWaiting(state).map((w) => [w.why, w.drawNumber])).toEqual([['take', 2]])
    expect(gcBackChargesNeedsYou(state)?.detail).toBe('$1,250 from Iron Horse Fabrication can come off draw 2 on Fair Oaks Shops, Building D. Take it off the draw before the draw is paid.')
    state = gcReducer(state, { type: 'takeBackCharge', ...ids, drawId: 'fsteel-draw-2' })
    expect(gcBackChargesNeedsYou(state)).toBeNull()
  })
})
