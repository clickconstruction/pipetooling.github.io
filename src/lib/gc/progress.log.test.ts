/**
 * The test of `gcBuildingLog.test.ts` on branch spike/gc-mode that reads the ring's card, moved word for word (the Board's B2b-vi).
 * The data is `schedule/testState.ts`.
 */
import { describe, expect, it } from 'vitest'
import { missingLogs, missingLogsWords } from './buildingLog'
import { stageProgress } from './progress'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

const fairOaks = (s: GcState) => {
  const p = s.projects.find((x) => x.id === 'fairoaksd')
  if (!p) throw new Error('no Fair Oaks D')
  return p
}

describe('the daily log', () => {
  it('says which working day this week has no log, on the ring card', () => {
    const s = initialGcState()
    expect(missingLogs(fairOaks(s), s.today)).toEqual(['2026-09-30'])
    expect(missingLogsWords(['2026-09-30'])).toBe('No daily log for Wed Sep 30.')
    expect(stageProgress(s, fairOaks(s)).also).toContain('No daily log for Wed Sep 30.')
  })
})
