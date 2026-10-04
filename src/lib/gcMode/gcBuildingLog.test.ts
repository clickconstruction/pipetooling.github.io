/**
 * GC mode — design spike: the superintendent's daily log (gcBuildingLog.ts, saveDailyLog). Fair
 * Oaks D has logs Sep 21 to Oct 1; Sep 30 was missed; today is Fri Oct 2.
 */
import { describe, expect, it } from 'vitest'
import { gcReducer, initialGcState, missingLogs, missingLogsWords, newDailyLog, onSite, onSiteWords, stageProgress, workdaysBetween, type GcState } from './gcModel'

const fairOaks = (s: GcState) => {
  const p = s.projects.find((x) => x.id === 'fairoaksd')
  if (!p) throw new Error('no Fair Oaks D')
  return p
}

describe('the daily log', () => {
  it('counts working days only', () => {
    expect(workdaysBetween('2026-09-25', '2026-09-29')).toEqual(['2026-09-25', '2026-09-28', '2026-09-29'])
  })

  it('says which working day this week has no log, on the ring card last', () => {
    const s = initialGcState()
    expect(missingLogs(fairOaks(s), s.today)).toEqual(['2026-09-30'])
    expect(missingLogsWords(['2026-09-30'])).toBe('No daily log for Wed Sep 30.')
    const also = stageProgress(s, fairOaks(s)).also
    expect(also[also.length - 1]).toBe('No daily log for Wed Sep 30.')
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

  it('saves today, catches up a missed day, and changes a day already written', () => {
    const s = initialGcState()
    const base = newDailyLog(fairOaks(s), s.today)
    const today = gcReducer(s, {
      type: 'saveDailyLog',
      projectId: 'fairoaksd',
      log: { ...base, crews: [...base.crews, { packageId: 'nope', workers: 2 }, { packageId: 'fconc', workers: 0 }], done: '  Panels set. ' },
    })
    const saved = fairOaks(today).dailyLogs?.find((l) => l.date === '2026-10-02')
    expect(saved?.crews.map((c) => c.packageId)).toEqual(['fsteel', 'froof', 'felec', 'fplumb', 'fhvac'])
    expect(saved?.done).toBe('Panels set.')
    expect(today.log[0]?.text).toBe('Wrote the daily log for Fri Oct 2 on Fair Oaks Shops, Building D: 15 workers from 5 trades on site.')
    const caught = gcReducer(today, { type: 'saveDailyLog', projectId: 'fairoaksd', log: { ...newDailyLog(fairOaks(today), '2026-09-30'), weatherStop: true } })
    expect(caught.log[0]?.text).toBe(
      'Wrote the daily log for Wed Sep 30 on Fair Oaks Shops, Building D: 17 workers from 5 trades on site, work stopped for the weather. Caught up after the day.',
    )
    expect(missingLogs(fairOaks(caught), caught.today)).toEqual([])
    expect(fairOaks(caught).dailyLogs?.find((l) => l.date === '2026-09-30')?.writtenOn).toBe('2026-10-02')
    const changed = gcReducer(caught, { type: 'saveDailyLog', projectId: 'fairoaksd', log: { ...base, crews: [] } })
    expect(changed.log[0]?.text).toBe('Changed the daily log for Fri Oct 2 on Fair Oaks Shops, Building D: 0 workers from 0 trades on site.')
    expect(fairOaks(changed).dailyLogs?.filter((l) => l.date === '2026-10-02')).toHaveLength(1)
  })

  it('takes no day after today, none before work started, and none on a job not being built', () => {
    const s = initialGcState()
    const log = newDailyLog(fairOaks(s), s.today)
    expect(gcReducer(s, { type: 'saveDailyLog', projectId: 'fairoaksd', log: { ...log, date: '2026-10-05' } })).toBe(s)
    expect(gcReducer(s, { type: 'saveDailyLog', projectId: 'fairoaksd', log: { ...log, date: '2026-06-01' } })).toBe(s)
    expect(gcReducer(s, { type: 'saveDailyLog', projectId: 'helotes', log })).toBe(s)
  })
})
