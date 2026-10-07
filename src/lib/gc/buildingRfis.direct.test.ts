/**
 * Main's own tests for questions during construction (RFIs, the Building lane's U2), run on the test
 * data: the spike's own cases, Fair Oaks D's four on today Fri Oct 2, one in each state. RFI-001 was
 * answered with a cost, RFI-002 with no change, RFI-003 is with the architect, and RFI-004 waits on
 * us.
 */
import { describe, expect, it } from 'vitest'
import { portalCanAskRfi, rfiAnsweredWords, rfiChangeOrderDescription, rfiDefaultHolds, rfiHolds, rfiImpactWords, rfiState } from './buildingRfis'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

const fairOaks = (s: GcState) => s.projects.find((p) => p.id === 'fairoaksd')!
const rfi = (s: GcState, n: number) => fairOaks(s).rfis!.find((r) => r.number === n)!

describe('where an RFI stands, and the work it holds', () => {
  it('reads whose move it is', () => {
    const s = initialGcState()
    expect([1, 2, 3, 4].map((n) => rfiState(rfi(s, n)))).toEqual(['answered', 'answered', 'architect', 'us'])
  })

  it('names the held work from the schedule, soonest first', () => {
    const s = initialGcState()
    expect(rfiHolds(s, fairOaks(s), rfi(s, 3))).toEqual([{ lineId: 'fhvac-1', name: 'HVAC · Rooftop units', start: '2026-10-12' }])
    expect(rfiHolds(s, fairOaks(s), { ...rfi(s, 4), holds: ['froof-4', 'fhvac-1', 'not-on-the-chart'] }).map((h) => h.lineId)).toEqual(['froof-4', 'fhvac-1'])
  })

  it('holds a trade’s next work not started when the trade asks from its portal', () => {
    const s = initialGcState()
    expect(rfiDefaultHolds(s, fairOaks(s), 'froof')).toEqual(['froof-4'])
  })
})

describe('an answer, in words', () => {
  it('says what an answer changes', () => {
    expect([rfiImpactWords('none', 0, 0), rfiImpactWords('plans', 0, 0)]).toEqual(['no change', 'changes the plans'])
    expect([rfiImpactWords('cost', 3800, 2), rfiImpactWords('cost', 0, 1), rfiImpactWords('cost', 0, 0)]).toEqual(['adds $3,800 and 2 days', 'adds 1 day', 'adds cost or days'])
  })

  it('writes the log’s line and the change order a cost answer starts', () => {
    const s = initialGcState()
    expect(rfiAnsweredWords(fairOaks(s), rfi(s, 1))).toBe('RFI-001 answered by Marsh & Vale Architects Sep 8: adds $3,800 and 2 days.')
    expect(rfiAnsweredWords(fairOaks(s), rfi(s, 2))).toBe('RFI-002 answered by Marsh & Vale Architects Sep 25: no change.')
    expect(rfiAnsweredWords(fairOaks(s), rfi(s, 3))).toBe('')
    expect(rfiChangeOrderDescription(rfi(s, 1))).toBe('RFI-001: Cap it at the property line and take out the rest (C-101)')
  })
})

describe('a trade asking from its portal', () => {
  it('asks only on a trade it was awarded, on a job being built and not closed', () => {
    const s = initialGcState()
    expect(portalCanAskRfi(fairOaks(s), 'froof', 'summit')).toBe(true)
    expect(portalCanAskRfi(fairOaks(s), 'froof', 'bluebonnet')).toBe(false)
    expect(portalCanAskRfi({ ...fairOaks(s), closedOn: '2026-10-02' }, 'froof', 'summit')).toBe(false)
    expect(portalCanAskRfi({ ...fairOaks(s), stage: 'buyout' }, 'froof', 'summit')).toBe(false)
  })
})
