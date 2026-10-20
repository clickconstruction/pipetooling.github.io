/**
 * The test of `gcBuildingSubmittals.test.ts` on branch spike/gc-mode that reads the ring's card, moved word for word (the Board's
 * B2b-vi). The data is `schedule/testState.ts`.
 */
import { describe, expect, it } from 'vitest'
import { submittalHolding } from './buildingSubmittals'
import { stageProgress } from './progress'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

const fairOaks = (s: GcState) => {
  const p = s.projects.find((x) => x.id === 'fairoaksd')
  if (!p) throw new Error('no Fair Oaks D')
  return p
}

describe('submittals', () => {
  it('holds the schedule lines it covers until approved, and the ring card says what waits on us', () => {
    const s = initialGcState()
    expect(submittalHolding(fairOaks(s), 'froof-3')?.number).toBe('07 62 00-01')
    expect(submittalHolding(fairOaks(s), 'felec-2')).toBeNull()
    expect(stageProgress(s, fairOaks(s)).also).toContain('Submittal 07 62 00-01, Sheet metal and flashing, from Summit Roofing waits on us. It is needed today.')
  })
})
