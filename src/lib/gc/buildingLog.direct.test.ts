/**
 * Main's own tests for the daily log's day words and who was on site (the schedule's PR 1b), run on
 * the test data: the spike's own cases, on Fair Oaks D's daily logs from Sep 21 to Oct 1.
 */
import { describe, expect, it } from 'vitest'
import { isWorkday, onSite, onSiteWords } from './buildingLog'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

const fairOaks = (s: GcState) => s.projects.find((p) => p.id === 'fairoaksd')!

describe('the daily log’s days', () => {
  it('counts Monday to Friday as workdays', () => {
    expect(['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'].map(isWorkday)).toEqual([true, false, false, true])
  })

  it('reads a trade’s days on site and its worker-days', () => {
    const s = initialGcState()
    expect(onSite(fairOaks(s), 'froof', '2026-09-21', '2026-09-25')).toEqual({ days: ['2026-09-21', '2026-09-22', '2026-09-23'], workerDays: 14 })
  })

  it('says a trade’s week on site in a few words, or nothing with no log that week', () => {
    const s = initialGcState()
    expect(onSiteWords(fairOaks(s), 'fsteel', '2026-09-28')).toBe('The daily log has them on site Mon, Tue and Thu, 11 worker-days.')
    expect(onSiteWords(fairOaks(s), 'fconc', '2026-09-28')).toBe('Not on site in the 3 days logged that week.')
    expect(onSiteWords(fairOaks(s), 'fsteel', '2026-10-05')).toBeNull()
  })
})
