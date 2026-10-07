/**
 * Main's own tests for the submittal register (the Building lane's U2), run on the test data: the
 * spike's own cases, Fair Oaks D's six on today Fri Oct 2. The panelboards came back to revise and
 * were approved as noted 15 days past the day they were needed. The fire alarm is with the
 * architect. The controls have not been sent. The roof flashing came in yesterday and is with us.
 */
import { describe, expect, it } from 'vitest'
import { nextSubmittalId, nextSubmittalNumber, submittalApprovedOn, submittalNeededBy, submittalRowsOn, submittalState } from './buildingSubmittals'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

const fairOaks = (s: GcState) => s.projects.find((p) => p.id === 'fairoaksd')!
const sub = (s: GcState, n: number) => fairOaks(s).submittals!.find((x) => x.id === `fairoaksd-sub-${n}`)!

describe('where a submittal stands', () => {
  it('reads whose move it is from its newest round', () => {
    const s = initialGcState()
    expect([1, 2, 3, 4, 5, 6].map((n) => submittalState(sub(s, n)))).toEqual(['approved', 'architect', 'approved', 'trade', 'approved', 'us'])
    const revise = { ...sub(s, 2), rounds: sub(s, 2).rounds.map((r) => ({ ...r, answeredOn: '2026-10-02', answer: 'revise' as const, answerNote: 'Show the device spacing.' })) }
    expect(submittalState(revise)).toBe('trade')
  })

  it('takes the day approved from the round that approved it', () => {
    const s = initialGcState()
    expect([submittalApprovedOn(sub(s, 1)), submittalApprovedOn(sub(s, 2)), submittalApprovedOn(sub(s, 4))]).toEqual(['2026-09-08', null, null])
  })

  it('is needed by the first start it holds less its lead days, or the day set when none is on the schedule', () => {
    const s = initialGcState()
    expect(submittalNeededBy(fairOaks(s), sub(s, 2))).toBe('2026-10-19')
    const offChart = { ...sub(s, 2), lineIds: ['not-on-the-chart'], neededBy: '2026-10-20' }
    expect(submittalNeededBy(fairOaks(s), offChart)).toBe('2026-10-20')
    expect(submittalNeededBy(fairOaks(s), { ...offChart, neededBy: undefined })).toBeNull()
  })
})

describe('the register’s rows and its next number', () => {
  it('lists each with whose move, the day it is needed and how late', () => {
    const s = initialGcState()
    expect(submittalRowsOn(fairOaks(s), s.today).map((r) => [r.submittal.id, r.state, r.neededBy, r.daysLate])).toEqual([
      ['fairoaksd-sub-1', 'approved', '2026-08-24', 15],
      ['fairoaksd-sub-2', 'architect', '2026-10-19', 0],
      ['fairoaksd-sub-3', 'approved', '2026-09-12', 0],
      ['fairoaksd-sub-4', 'trade', '2026-10-23', 0],
      ['fairoaksd-sub-5', 'approved', '2026-09-14', 0],
      ['fairoaksd-sub-6', 'us', '2026-10-02', 0],
    ])
    expect(submittalRowsOn(fairOaks(s), '2026-10-05').find((r) => r.submittal.id === 'fairoaksd-sub-6')?.daysLate).toBe(3)
  })

  it('numbers the next by its spec section, or by a plain count', () => {
    const s = initialGcState()
    expect(nextSubmittalNumber(fairOaks(s), '26 24 16')).toBe('26 24 16-02')
    expect(nextSubmittalNumber(fairOaks(s), '09 91 23')).toBe('09 91 23-01')
    expect(nextSubmittalNumber(fairOaks(s))).toBe('007')
    expect(nextSubmittalId(fairOaks(s))).toBe('fairoaksd-sub-7')
  })
})
