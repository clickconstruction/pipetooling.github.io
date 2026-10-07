/**
 * The tests of `gcBuildingLog.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the Building lane's U2). The data is `schedule/testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { newDailyLog, onSite, onSiteWords, workdaysBetween } from './buildingLog'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

const fairOaks = (s: GcState) => {
  const p = s.projects.find((x) => x.id === 'fairoaksd')
  if (!p) throw new Error('no Fair Oaks D')
  return p
}

describe('the daily log', () => {
  it('counts working days only', () => {
    expect(workdaysBetween('2026-09-25', '2026-09-29')).toEqual(['2026-09-25', '2026-09-28', '2026-09-29'])
  })

  it('reads who was on site, for the look-ahead marks', () => {
    const s = initialGcState()
    expect(onSite(fairOaks(s), 'froof', '2026-09-21', '2026-09-25')).toEqual({ days: ['2026-09-21', '2026-09-22', '2026-09-23'], workerDays: 14 })
    expect(onSiteWords(fairOaks(s), 'fsteel', '2026-09-28')).toBe('The daily log has them on site Mon, Tue and Thu, 11 worker-days.')
    expect(onSiteWords(fairOaks(s), 'fconc', '2026-09-28')).toBe('Not on site in the 3 days logged that week.')
    expect(onSiteWords(fairOaks(s), 'fsteel', '2026-10-05')).toBeNull()
  })

  it('starts a new log from the day before', () => {
    const s = initialGcState()
    const d = newDailyLog(fairOaks(s), s.today)
    expect(d).toMatchObject({ date: '2026-10-02', sky: 'cloudy', high: 85, low: 70, weatherStop: false, done: '', delays: [], visitors: '' })
    expect(d.crews).toEqual([
      { packageId: 'fsteel', workers: 3 },
      { packageId: 'froof', workers: 4 },
      { packageId: 'felec', workers: 2 },
      { packageId: 'fplumb', workers: 3 },
      { packageId: 'fhvac', workers: 3 },
    ])
  })
})
