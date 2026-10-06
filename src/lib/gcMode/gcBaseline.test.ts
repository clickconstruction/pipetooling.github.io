import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import type { GcState } from './gcTypes'
import { scheduleItems, scheduleMeasures } from './gcBuildingSchedule'
import { changeOrderMove } from './gcChangeOrderDays'
import { baselineDue, baselineHistory, baselineWords, nextBaselineName, withNewBaseline } from './gcBaseline'

const ID = 'fairoaksd'
const job = (state: GcState) => state.projects.find((p) => p.id === ID)!

/** A change order signed today with 3 days on the roof, and its days put on the schedule. */
function landed(): GcState {
  let state = gcReducer(initialGcState(), { type: 'draftChangeOrder', projectId: ID, description: 'A larger roof curb for RTU-2', reason: 'plans', schedule: '', packageId: 'froof', cost: 4_200, price: 0, days: 3 })
  state = gcReducer(state, { type: 'sendChangeOrder', projectId: ID, changeOrderId: 'co-1' })
  state = gcReducer(state, { type: 'ownerSignChangeOrder', projectId: ID, changeOrderId: 'co-1' })
  const move = changeOrderMove(job(state), job(state).changeOrders![0]!, state.today)!
  return gcReducer(state, { type: 'setScheduleActivity', projectId: ID, ...move, why: { ...move.why, by: 'Robert' } })
}

describe('a new baseline after a signed change order (G-41)', () => {
  it('knows when one is due, and what to call it', () => {
    const fresh = initialGcState()
    expect(baselineDue(job(fresh), fresh.today)).toBeNull()
    expect(nextBaselineName(job(fresh), fresh.today)).toBe('Baseline 2')
    const state = landed()
    expect(baselineDue(job(state), state.today)).toBe('Change order 1 put 3 days on the schedule since the baseline of Wed Jul 1. A new baseline after a signed change order is usual.')
    expect(nextBaselineName(job(state), state.today)).toBe('After change order 1')
  })

  it('takes the plan as it stands, keeps the old one named, and the measures read against the new one', () => {
    let state = landed()
    const before = scheduleMeasures(state, job(state))
    expect(scheduleItems(state, job(state)).find((i) => i.activity.lineId === 'froof-1')?.slipDays).toBe(10)
    state = gcReducer(state, { type: 'setScheduleBaseline', projectId: ID, name: 'After change order 1', why: 'The curb was signed.', by: 'Robert' })
    const schedule = job(state).schedule!
    expect(schedule.baseline).toMatchObject({ lockedOn: '2026-10-02', name: 'After change order 1', by: 'Robert', why: 'The curb was signed.' })
    expect(schedule.baseline?.activities['froof-1']).toEqual({ start: '2026-09-21', finish: '2026-10-12' })
    expect(baselineHistory(schedule).map(baselineWords)).toEqual(['At Start, locked Jul 1.', 'After change order 1, set Oct 2 by Robert: The curb was signed.'])
    expect(scheduleItems(state, job(state)).find((i) => i.activity.lineId === 'froof-1')?.slipDays).toBe(0)
    expect(scheduleMeasures(state, job(state)).work.plannedPct).not.toBe(before.work.plannedPct)
    expect(baselineDue(job(state), state.today)).toBeNull()
    expect(state.log[0]?.text).toBe('Robert set a new baseline on Fair Oaks Shops, Building D, After change order 1: The curb was signed. The plan at Start is kept.')
  })

  it('needs a name and a locked plan', () => {
    const state = landed()
    expect(withNewBaseline(job(state).schedule!, '  ', '', 'Robert', state.today)).toBeNull()
    expect(gcReducer(state, { type: 'setScheduleBaseline', projectId: ID, name: '', why: '', by: 'Robert' })).toBe(state)
    const fresh = initialGcState()
    expect(fresh.projects.find((p) => p.id === 'helotes')?.schedule).toBeUndefined()
    expect(gcReducer(fresh, { type: 'setScheduleBaseline', projectId: 'helotes', name: 'x', why: '', by: 'Robert' })).toBe(fresh)
  })
})
