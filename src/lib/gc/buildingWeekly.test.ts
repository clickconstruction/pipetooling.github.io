/**
 * The tests of `gcBuildingWeekly.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the Building lane's U2). The data is `schedule/testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { weeklyReportReady } from './buildingWeekly'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

const fairOaks = (s: GcState) => {
  const p = s.projects.find((x) => x.id === 'fairoaksd')
  if (!p) throw new Error('no Fair Oaks D')
  return p
}

describe('the weekly report', () => {
  it('only for a job being built, and only from Friday', () => {
    const s = initialGcState()
    const helotes = s.projects.find((p) => p.id === 'helotes')
    if (!helotes) throw new Error('no Helotes')
    expect(weeklyReportReady(s, helotes)).toBe(false)
    expect(weeklyReportReady({ ...s, today: '2026-10-01' }, fairOaks(s))).toBe(false)
  })
})
