import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import { addDays } from './gcBuilding'
import { daysBetween, scheduleMeasures } from './gcBuildingSchedule'
import { ownerFinishRisk } from './gcOwnerBillingFinish'
import { customerStanding } from './gcCustomerSchedule'
import { changeOrderMove } from './gcChangeOrderDays'
import { weeklyReport } from './gcBuildingWeekly'
import { customerScheduleLetter } from './gcCustomerScheduleSend'
import type { GcState, ScheduleMoveReason } from './gcTypes'
import { lateFinish } from './gcLateFinish'

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
/** The newest change order on the job. `Array.at` is not in the build's target. */
const lastOrder = (s: GcState) => {
  const all = job(s).changeOrders ?? []
  return all[all.length - 1]!
}

function moveBy(s: GcState, label: string, days: number, reason: ScheduleMoveReason, note: string): GcState {
  const a = scheduleMeasures(s, job(s)).items.find((i) => i.label === label)!.activity
  return gcReducer(s, { type: 'setScheduleActivity', projectId: ID, lineId: a.lineId, start: addDays(a.start, days), finish: addDays(a.finish, days), after: a.after, why: { reason, note, by: 'Robert' } })
}

/** A change order with days: drafted, sent, and signed unless `sign` is false. On our own work unless a trade is named. */
function changeOrder(s: GcState, description: string, days: number, sign = true, packageId: string | null = null): GcState {
  let state = gcReducer(s, { type: 'draftChangeOrder', projectId: ID, description, reason: 'plans', schedule: '', packageId, cost: 4_200, price: 0, days })
  const co = lastOrder(state)
  state = gcReducer(state, { type: 'sendChangeOrder', projectId: ID, changeOrderId: co.id })
  return sign ? gcReducer(state, { type: 'ownerSignChangeOrder', projectId: ID, changeOrderId: co.id }) : state
}

/**
 * The mock-up's job: Trim waits a week on the customer's tile decision, rain holds Test and
 * balance nine days, change order 1 adds a day and is signed, change order 2 adds two and is sent,
 * and the contract's fee is $500 a day.
 */
function lateJob(fee = true): GcState {
  let s = initialGcState()
  s = moveBy(s, 'Trim', 7, 'customer', 'Waiting on the restroom tile decision.')
  s = moveBy(s, 'Test and balance', 9, 'weather', 'Rain kept the roof open a week.')
  s = changeOrder(s, 'A larger roof curb for RTU-2', 1)
  s = changeOrder(s, 'Extra exterior lighting', 2, false)
  return fee ? gcReducer(s, { type: 'setOwnerLateFinish', projectId: ID, perDay: 500 }) : s
}

/** Four days late, two of them the customer's: Trim waits four days on them, the rain does the rest. */
function partlyTheirs(): GcState {
  let s = initialGcState()
  s = moveBy(s, 'Trim', 4, 'customer', 'Waiting on the restroom tile decision.')
  return moveBy(s, 'Test and balance', 9, 'weather', 'Rain kept the roof open a week.')
}

describe('the contract’s late days (G-98)', () => {
  it('says nothing new on the fixture: on the contract’s day, no change orders, no fee', () => {
    const f = lateFinish(initialGcState(), job(initialGcState()))
    expect([f.late, f.spare, f.customers, f.perDay, f.atRisk]).toEqual([0, 0, 0, null, null])
    expect([f.words, f.customerWords, f.orders]).toEqual([[], [], []])
  })

  it('a late job: the money at the contract’s fee, whose days they are, and the change orders', () => {
    const s = lateJob()
    const f = lateFinish(s, job(s))
    expect([f.late, f.customers, f.atRisk, f.risk.contract?.on, f.risk.schedule?.on]).toEqual([3, 3, 1_500, '2026-12-12', '2026-12-15'])
    expect(f.words).toEqual([
      'At $500 a day, the 3 days cost $1,500.',
      "All 3 are the customer's: a change order for them would save $1,500.",
      'Change order 1 moved the contract 1 day, signed Fri Oct 2.',
      'Change order 2 would move the contract 2 days once they sign it.',
    ])
    expect(f.customerWords).toEqual(['Those 3 days came from a decision we were waiting on from you.'])
  })

  it('with no fee typed, the days and where the fee goes', () => {
    const s = lateJob(false)
    const f = lateFinish(s, job(s))
    expect([f.perDay, f.atRisk]).toEqual([null, null])
    expect(f.words.slice(0, 2)).toEqual(['No late fee is entered from the contract. It goes on Bill the customer.', "All 3 are the customer's: a change order for them would move the contract."])
  })

  it('part of them the customer’s: theirs to ask for, the rest ours to make up', () => {
    const s = partlyTheirs()
    const f = lateFinish(s, job(s))
    expect([f.late, f.customers]).toEqual([4, 2])
    expect(f.words).toEqual(['No late fee is entered from the contract. It goes on Bill the customer.', "2 of those days are the customer's: a change order for them would move the contract."])
    expect(f.customerWords).toEqual(['2 of those days came from a decision we were waiting on from you.', 'We are working to make up the other 2.'])
  })

  it('none of them the customer’s: the customer hears we are making them up', () => {
    const s = moveBy(initialGcState(), 'Test and balance', 9, 'weather', 'Rain kept the roof open a week.')
    const f = lateFinish(s, job(s))
    expect(f.late).toBeGreaterThan(0)
    expect([f.customers, f.split]).toEqual([0, null])
    expect(f.customerWords).toEqual([f.late === 1 ? 'We are working to make up the day.' : 'We are working to make up the days.'])
  })

  it('on time with a fee: what each day past the contract’s day would cost', () => {
    const s = gcReducer(initialGcState(), { type: 'setOwnerLateFinish', projectId: ID, perDay: 500 })
    expect(lateFinish(s, job(s)).words).toEqual(['Each day past Fri Dec 11 costs $500.'])
  })

  it('a move that put a signed change order’s days on the chart is not the customer’s: the contract moved for it', () => {
    let s = changeOrder(initialGcState(), 'A larger roof curb for RTU-2', 6, true, 'froof')
    const co = lastOrder(s)
    const put = changeOrderMove(job(s), co, s.today)!
    s = gcReducer(s, { type: 'setScheduleActivity', projectId: ID, lineId: put.lineId, start: put.start, finish: put.finish, after: put.after, why: { reason: 'change order', note: 'The larger curb needs six days.', by: 'Robert' }, changeOrderId: co.id })
    const f = lateFinish(s, job(s))
    expect(f.customers).toBe(0)
    expect(f.orders).toEqual([{ number: co.number, days: 6, state: 'signed', on: '2026-10-02' }])
  })

  it('names only change orders with days that are signed or sent', () => {
    let s = initialGcState()
    s = gcReducer(s, { type: 'draftChangeOrder', projectId: ID, description: 'A draft', reason: 'plans', schedule: '', packageId: null, cost: 100, price: 0, days: 4 })
    s = changeOrder(s, 'No days', 0)
    s = changeOrder(s, 'Declined', 3, false)
    const declined = lastOrder(s)
    s = gcReducer(s, { type: 'ownerDeclineChangeOrder', projectId: ID, changeOrderId: declined.id })
    expect(lateFinish(s, job(s)).orders).toEqual([])
  })

  it('says every line in plain words', () => {
    for (const s of [lateJob(), lateJob(false), partlyTheirs()]) {
      const f = lateFinish(s, job(s))
      for (const line of [...f.words, ...f.customerWords]) expect(plainWordsFailures(line)).toEqual([])
    }
  })
})

describe('one call: the Schedule tab, Bill the customer and the customer’s words count the same days', () => {
  /** The days each surface reads, as each reads them. */
  function counts(s: GcState) {
    const p = job(s)
    const m = scheduleMeasures(s, p)
    return {
      kernel: lateFinish(s, p).late,
      scheduleTab: m.finish && m.contract ? Math.max(0, daysBetween(m.contract.on, m.finish.on)) : null,
      billTheCustomer: Math.max(0, ownerFinishRisk(s, p).past ?? 0),
      customer: customerStanding(s, p).late,
    }
  }

  it('agree on the fixture, on a late job, and after a move that changes the finish, moving together', () => {
    const late = lateJob()
    const later = moveBy(late, 'Test and balance', 5, 'crew', 'The balancer comes a week later.')
    expect(counts(initialGcState())).toEqual({ kernel: 0, scheduleTab: 0, billTheCustomer: 0, customer: 0 })
    expect(counts(late)).toEqual({ kernel: 3, scheduleTab: 3, billTheCustomer: 3, customer: 3 })
    const after = counts(later)
    expect(after.kernel).toBeGreaterThan(3)
    expect(after).toEqual({ kernel: after.kernel, scheduleTab: after.kernel, billTheCustomer: after.kernel, customer: after.kernel })
    // The customer's sentence follows: Trim's move put 5 days on the finish, all late now, and the rest are ours to make up.
    expect(lateFinish(later, job(later)).customerWords).toEqual(['5 of those days came from a decision we were waiting on from you.', `We are working to make up the other ${(after.kernel ?? 0) - 5}.`])
  })

  it('the Friday report and the schedule letter carry the customer’s words after the finish', () => {
    const s = lateJob()
    const glance = weeklyReport(s, job(s)).sections.find((x) => x.key === 'glance')!.lines
    expect(glance.slice(0, 2)).toEqual(['Finish: about Tue Dec 15. That is 3 days past the Dec 12 in your contract.', 'Those 3 days came from a decision we were waiting on from you.'])
    const letter = customerScheduleLetter(s, job(s), 'Robert Douglas').lines
    const at = letter.indexOf('We expect to finish Tue Dec 15, 3 days past the Dec 12 in your contract.')
    expect(letter.slice(at, at + 4)).toEqual([
      'We expect to finish Tue Dec 15, 3 days past the Dec 12 in your contract.',
      'Change order 1 added 1 day to your contract.',
      'Substantial completion is now Sat Dec 12, 1 day past the Dec 11 you signed.',
      'Those 3 days came from a decision we were waiting on from you.',
    ])
    // Never the fee, never a company.
    for (const line of [...glance, ...letter]) expect(line).not.toMatch(/\$500|\$1,500|Summit|Cool Breeze|Pecan/)
  })
})
