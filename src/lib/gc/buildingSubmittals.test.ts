/**
 * The tests of `gcBuildingSubmittals.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the Building lane's U2). The data is `schedule/testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { submittalCounts, submittalRows } from './buildingSubmittals'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

const fairOaks = (s: GcState) => {
  const p = s.projects.find((x) => x.id === 'fairoaksd')
  if (!p) throw new Error('no Fair Oaks D')
  return p
}

const row = (s: GcState, id: string) => submittalRows(s, fairOaks(s)).find((r) => r.submittal.id === id)

describe('submittals', () => {
  it('reads whose move each is, when it is needed and how late', () => {
    const s = initialGcState()
    expect(submittalRows(s, fairOaks(s)).map((r) => [r.submittal.number, r.state, r.neededBy, r.daysLate])).toEqual([
      ['26 24 16-01', 'approved', '2026-08-24', 15],
      ['28 31 11-01', 'architect', '2026-10-19', 0],
      ['23 81 19-01', 'approved', '2026-09-12', 0],
      ['23 09 23-01', 'trade', '2026-10-23', 0],
      ['07 54 23-01', 'approved', '2026-09-14', 0],
      ['07 62 00-01', 'us', '2026-10-02', 0],
    ])
    expect(submittalCounts(s, fairOaks(s))).toEqual({ trade: 1, us: 1, architect: 1, approved: 3, late: 0 })
    expect(row(s, 'fairoaksd-sub-1')?.company).toBe('Pecan Valley Electric')
  })
})
