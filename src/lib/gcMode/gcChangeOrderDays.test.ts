import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import type { GcState } from './gcTypes'
import { substantialCompletionOn } from './gcBuildingSchedule'
import { customerChanges } from './gcCustomerSchedule'
import { moveRows, undoableMove } from './gcScheduleMoves'
import { changeOrderMove, changeOrderMoveNote, changeOrderTails, changeOrdersOnChart, customerContractDays, whereWorkIs } from './gcChangeOrderDays'

/** Fair Oaks Shops, Building D, today Fri Oct 2 2026: the roof (TPO membrane) runs Sep 21 to Oct 9. */
const ID = 'fairoaksd'
const job = (state: GcState) => state.projects.find((p) => p.id === ID)!

/** A change order drafted, sent and signed today, on a trade or on our own work. */
function signed(days: number, packageId: string | null, from = initialGcState()): GcState {
  let state = gcReducer(from, { type: 'draftChangeOrder', projectId: ID, description: 'A larger roof curb for RTU-2', reason: 'plans', schedule: '', packageId, cost: 4_200, price: 0, days })
  const co = job(state).changeOrders?.[job(state).changeOrders!.length - 1]
  if (!co) throw new Error('no change order drafted')
  state = gcReducer(state, { type: 'sendChangeOrder', projectId: ID, changeOrderId: co.id })
  return gcReducer(state, { type: 'ownerSignChangeOrder', projectId: ID, changeOrderId: co.id })
}

describe("where a change order's days land (G-76)", () => {
  it('finds the bar the trade is on the day it was signed', () => {
    const state = signed(3, 'froof')
    const co = job(state).changeOrders![0]!
    expect(co.status).toBe('signed')
    expect(whereWorkIs(job(state), co, state.today)?.lineId).toBe('froof-1')
    const [row] = changeOrdersOnChart(job(state), state.today)
    expect(row?.lineId).toBe('froof-1')
    expect(row?.landed).toBeNull()
    expect(row?.words).toBe('Change order 1 adds 3 days to Roofing · TPO membrane. Not on the dates yet.')
  })

  it('takes the next bar to start when none is running, and the last one after the work is over', () => {
    const state = signed(2, 'fhvac')
    const co = job(state).changeOrders![0]!
    // HVAC's ductwork runs today, so that is the bar. A trade whose every bar is done lands on its last one.
    expect(whereWorkIs(job(state), co, state.today)?.lineId).toBe('fhvac-2')
    const sitework = { ...co, packageId: 'fsite' }
    expect(whereWorkIs(job(state), sitework, state.today)?.lineId).toBe('fsite-4')
    const later = { ...co, packageId: 'fplumb', answeredOn: '2026-11-15' }
    expect(whereWorkIs(job(state), later, state.today)?.lineId).toBe('fplumb-4')
  })

  it('our own work under general conditions has no bar: only the contract moves', () => {
    const state = signed(2, null)
    const [row] = changeOrdersOnChart(job(state), state.today)
    expect(row?.lineId).toBeNull()
    expect(row?.words).toMatch(/no bar on the chart/)
    expect(changeOrderTails(job(state), state.today).size).toBe(0)
    expect(substantialCompletionOn(job(state))?.days).toBe(2)
  })

  it('a signed order that adds no days is not on the chart', () => {
    const state = signed(0, 'froof')
    expect(changeOrdersOnChart(job(state), state.today)).toEqual([])
  })
})

describe('putting the days on the schedule', () => {
  it('draws a tail on the bar until the days are on its dates, and two orders on one bar add up', () => {
    const state = signed(2, 'froof', signed(3, 'froof'))
    const tails = changeOrderTails(job(state), state.today)
    expect(tails.get('froof-1')?.days).toBe(5)
    expect(tails.get('froof-1')?.words).toMatch(/Change order 1 adds 3 days.*Change order 2 adds 2 days/)
  })

  it('offers the move: the finish out by the days, the change order as the reason, in its words', () => {
    const state = signed(3, 'froof')
    const co = job(state).changeOrders![0]!
    const move = changeOrderMove(job(state), co, state.today)!
    expect(move).toMatchObject({ lineId: 'froof-1', start: '2026-09-21', finish: '2026-10-12', changeOrderId: 'co-1', why: { reason: 'change order' } })
    expect(move.why.note).toBe(changeOrderMoveNote(co, state.today))
    expect(move.why.note).toBe('Change order 1, signed Oct 2: A larger roof curb for RTU-2. It adds 3 days to this work.')
  })

  it('saved, the move carries the order; the tail goes; the customer reads why; Undo brings the tail back', () => {
    let state = signed(3, 'froof')
    const co = job(state).changeOrders![0]!
    const move = changeOrderMove(job(state), co, state.today)!
    state = gcReducer(state, { type: 'setScheduleActivity', projectId: ID, ...move, why: { ...move.why, by: 'Robert' } })
    const [row] = changeOrdersOnChart(job(state), state.today)
    expect(row?.landed?.changeOrderId).toBe('co-1')
    expect(row?.words).toBe('Change order 1 put 3 days on Roofing · TPO membrane, Oct 2 by Robert.')
    expect(changeOrderTails(job(state), state.today).size).toBe(0)
    expect(changeOrderMove(job(state), co, state.today)).toBeNull()
    expect(moveRows(job(state))[0]?.reason).toBe('A change order')
    expect(customerChanges(job(state), state.today)[0]).toMatch(/because of the change order you signed/)
    expect(customerContractDays(job(state))).toEqual(['Change order 1 added 3 days to your contract.', `Substantial completion is now ${weekdayOf(substantialCompletionOn(job(state))!.on)}, 3 days past the ${short(substantialCompletionOn(job(state))!.planned)} you signed.`])
    // Undone, the days are back off the dates and the tail is drawn again.
    const undo = undoableMove(job(state))!
    state = gcReducer(state, { type: 'undoScheduleMove', projectId: ID, moveId: undo.id, by: 'Robert' })
    expect(changeOrdersOnChart(job(state), state.today)[0]?.landed).toBeNull()
    expect(changeOrderTails(job(state), state.today).get('froof-1')?.days).toBe(3)
  })
})

// The dates in the customer's sentence, read the way the words kernel writes them, so the test does not pin a milestone day.
import { shortDate as short, weekdayDate as weekdayOf } from './gcWords'
