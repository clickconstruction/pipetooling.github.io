/**
 * The test of `gcBuildingPunch.test.ts` on branch spike/gc-mode that reads the ring's card, moved word for word (the Board's B2b-vi).
 * The data is `schedule/testState.ts`.
 */
import { describe, expect, it } from 'vitest'
import { tradeCloseout } from './building'
import { punchCounts, punchWords } from './buildingPunch'
import { stageProgress } from './progress'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

const fairOaks = (s: GcState) => {
  const p = s.projects.find((x) => x.id === 'fairoaksd')
  if (!p) throw new Error('no Fair Oaks D')
  return p
}

const concrete = (s: GcState) => {
  const pkg = fairOaks(s).packages.find((k) => k.id === 'fconc')
  if (!pkg?.sow) throw new Error('no concrete')
  return { pkg, sow: pkg.sow }
}

describe('the punch list', () => {
  it('reads how a trade stands, on Closeout and on the ring card', () => {
    const s = initialGcState()
    const c = punchCounts(fairOaks(s), 'fconc')
    expect(c).toEqual({ open: 1, fixed: 1, done: 1, total: 3 })
    expect(punchWords(c)).toBe('1 to fix, 1 fixed and waiting on our check, 1 checked')
    const { sow } = concrete(s)
    expect(tradeCloseout(sow, fairOaks(s), s.today).next?.detail).toBe(
      'Punch list: 1 to fix, 1 fixed and waiting on our check, 1 checked. Accept the work once every item is checked fixed.',
    )
    expect(stageProgress(s, fairOaks(s)).also).toEqual(
      expect.arrayContaining(['Guadalupe Flatwork has 1 punch item to fix on Concrete.', '1 punch item on Concrete is fixed. Check it on Closeout.']),
    )
  })
})
