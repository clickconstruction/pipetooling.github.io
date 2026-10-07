/**
 * Main's own tests for the daily log's day words and who was on site (the schedule's PR 1b), and for
 * the days with no log, the week at a glance and what held work up (the Building lane's U2), run on
 * the test data: the spike's own cases, on Fair Oaks D's daily logs from Sep 21 to Oct 1, with Sep 30
 * missed and today Fri Oct 2.
 */
import { describe, expect, it } from 'vitest'
import { daysSinceLastLog, isWorkday, logDelays, missingLogs, missingLogsWords, onSite, onSiteWords, weekOfLogs } from './buildingLog'
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

describe('the days with no log, and what held work up', () => {
  it('flags a working day in the last week with no log, never today, and none before work started', () => {
    const s = initialGcState()
    expect(missingLogs(fairOaks(s), s.today)).toEqual(['2026-09-30'])
    expect(missingLogsWords(missingLogs(fairOaks(s), s.today))).toBe('No daily log for Wed Sep 30.')
    expect(missingLogsWords(['2026-09-29', '2026-09-30'])).toBe('No daily log for Sep 29 and Sep 30.')
    expect(missingLogsWords([])).toBeNull()
    const boerne = s.projects.find((p) => p.id === 'boerne')!
    expect(missingLogs(boerne, s.today)).toEqual([])
  })

  it('lays out the week Monday to Friday with each day’s log, and counts the days since the last', () => {
    const s = initialGcState()
    expect(weekOfLogs(fairOaks(s), s.today).map((d) => [d.date, d.log !== null])).toEqual([
      ['2026-09-28', true],
      ['2026-09-29', true],
      ['2026-09-30', false],
      ['2026-10-01', true],
      ['2026-10-02', false],
    ])
    expect(daysSinceLastLog(fairOaks(s), s.today)).toBe(1)
    expect(daysSinceLastLog({ ...fairOaks(s), dailyLogs: [] }, s.today)).toBeNull()
  })

  it('lists what held work up between two days, newest first, the job’s own with no trade', () => {
    const s = initialGcState()
    expect(logDelays(fairOaks(s), '2026-09-24', '2026-09-29').map((d) => [d.date, d.packageId, d.reason])).toEqual([
      ['2026-09-29', 'felec', 'materials'],
      ['2026-09-25', null, 'weather'],
      ['2026-09-24', 'froof', 'weather'],
    ])
  })
})
