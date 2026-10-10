import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { crewCountPages, crewOnSiteOn, crewsToSave, dailyLogFromRow, dailyLogPayload, logWithClockIns, withCrewClockIns, withDailyLogs, type CrewOnSiteRow, type DailyLogRow } from './dailyLogRows'
import { missingLogs, newDailyLog } from './buildingLog'
import { initialGcState } from './schedule/testState'

/** A log's row as `loadGcDailyLogs` reads it, for Fair Oaks D unless a test says otherwise. */
function row(over: Partial<DailyLogRow> = {}): DailyLogRow {
  return {
    id: 'log-1',
    project_id: 'fairoaksd',
    log_date: '2026-09-30',
    sky: 'rain',
    high: 79,
    low: 68,
    weather_stop: true,
    done: 'Ductwork in bay 4.',
    visitors: 'The city inspector',
    photos_url: null,
    written_on: '2026-10-02',
    written_by: 'u1',
    created_at: '2026-10-02T14:00:00Z',
    updated_at: '2026-10-02T14:00:00Z',
    gc_daily_log_crews: [
      { log_id: 'log-1', package_id: 'fhvac', workers: 2 },
      { log_id: 'log-1', package_id: 'fsteel', workers: 4 },
    ],
    gc_daily_log_delays: [
      { id: 'd2', log_id: 'log-1', position: 1, package_id: 'fsteel', reason: 'materials', note: 'Joists not delivered' },
      { id: 'd1', log_id: 'log-1', position: 0, package_id: null, reason: 'weather', note: 'Rain until noon' },
    ],
    ...over,
  }
}

const fairOaks = () => initialGcState().projects.find((p) => p.id === 'fairoaksd')!

describe('dailyLogFromRow', () => {
  it('reads a caught-up day back as the prototype wrote it: its delays in order, its crews in the job’s order of trades', () => {
    expect(dailyLogFromRow(row(), fairOaks())).toEqual({
      date: '2026-09-30',
      sky: 'rain',
      high: 79,
      low: 68,
      weatherStop: true,
      // Fair Oaks D lists Structural steel before HVAC.
      crews: [
        { packageId: 'fsteel', workers: 4 },
        { packageId: 'fhvac', workers: 2 },
      ],
      done: 'Ductwork in bay 4.',
      delays: [
        { packageId: null, reason: 'weather', note: 'Rain until noon' },
        { packageId: 'fsteel', reason: 'materials', note: 'Joists not delivered' },
      ],
      visitors: 'The city inspector',
      writtenOn: '2026-10-02',
    })
  })

  it('says in words when a sky or a reason is one the app does not know', () => {
    expect(() => dailyLogFromRow(row({ sky: 'hail' }))).toThrow('A daily log\'s sky reads "hail", which the app does not know.')
    expect(() => dailyLogFromRow(row({ gc_daily_log_delays: [{ id: 'd', log_id: 'log-1', position: 0, package_id: null, reason: 'lunch', note: '' }] }))).toThrow(
      'A daily log\'s reason reads "lunch", which the app does not know.',
    )
  })
})

describe('withDailyLogs', () => {
  it('lays each job’s logs over it, oldest day first, and leaves every other job with none', () => {
    const state = withDailyLogs(initialGcState(), [row({ id: 'b', log_date: '2026-10-01', written_on: '2026-10-01' }), row({ id: 'a' })])
    const fair = state.projects.find((p) => p.id === 'fairoaksd')!
    expect(fair.dailyLogs?.map((l) => l.date)).toEqual(['2026-09-30', '2026-10-01'])
    expect(state.projects.filter((p) => p.id !== 'fairoaksd').every((p) => p.dailyLogs?.length === 0)).toBe(true)
  })

  it('feeds the kernels unchanged: a working day in the last five with no row is a missed day', () => {
    const state = withDailyLogs(initialGcState(), [row({ log_date: '2026-10-01', written_on: '2026-10-01' })])
    expect(missingLogs(state.projects.find((p) => p.id === 'fairoaksd')!, '2026-10-02')).toEqual(['2026-09-25', '2026-09-28', '2026-09-29', '2026-09-30'])
  })
})

describe('dailyLogPayload', () => {
  const log = { ...newDailyLog(fairOaks(), '2026-10-02') }

  it('trims every space and line break off the words, as the prototype’s trim did', () => {
    const p = dailyLogPayload('fairoaksd', { ...log, done: '\n  Membrane down.\t\n', visitors: ' The owner’s walk\n', delays: [{ packageId: null, reason: 'crew', note: '\tShort two\n' }] }, '2026-10-02')
    expect(p.done).toBe('Membrane down.')
    expect(p.visitors).toBe('The owner’s walk')
    expect(p.delays).toEqual([{ packageId: null, reason: 'crew', note: 'Short two' }])
  })

  it('rounds the degrees and the counts, and leaves off a trade with nobody on site', () => {
    const p = dailyLogPayload('fairoaksd', { ...log, high: 84.6, low: 69.4, crews: [{ packageId: 'fsteel', workers: 2.6 }, { packageId: 'froof', workers: 0.4 }, { packageId: 'felec', workers: 0 }] }, '2026-10-02')
    expect([p.high, p.low]).toEqual([85, 69])
    expect(p.crews).toEqual([{ packageId: 'fsteel', workers: 3 }])
  })

  it('refuses in words a day that is not written YYYY-MM-DD, and a high or low that is not a number', () => {
    expect(() => dailyLogPayload('fairoaksd', { ...log, date: 'Oct 2 2026' }, '2026-10-02')).toThrow('The log\'s day reads "Oct 2 2026". Pick the day again.')
    expect(() => dailyLogPayload('fairoaksd', log, '10/02/2026')).toThrow('Reload the page')
    expect(() => dailyLogPayload('fairoaksd', { ...log, high: Number.NaN }, '2026-10-02')).toThrow('Type the day’s high and low in degrees.')
  })

  it('reads back as it was saved: the payload, written as rows, is the same log, its crews in the job’s order of trades', () => {
    const p = dailyLogPayload('fairoaksd', { ...log, delays: [{ packageId: 'froof', reason: 'weather', note: 'Wind' }] }, '2026-10-03')
    const saved = row({
      log_date: p.date,
      sky: p.sky,
      high: p.high,
      low: p.low,
      weather_stop: p.weatherStop,
      done: p.done,
      visitors: p.visitors,
      written_on: p.today,
      gc_daily_log_crews: p.crews.map((c) => ({ log_id: 'log-1', package_id: c.packageId, workers: c.workers })),
      gc_daily_log_delays: p.delays.map((d, i) => ({ id: `d${i}`, log_id: 'log-1', position: i, package_id: d.packageId, reason: d.reason, note: d.note })),
    })
    const { projectId: _projectId, today: _today, ...asLog } = p
    const order = fairOaks().packages.map((k) => k.id)
    const crews = [...asLog.crews].sort((a, b) => order.indexOf(a.packageId) - order.indexOf(b.packageId))
    expect(dailyLogFromRow(saved, fairOaks())).toEqual({ ...asLog, crews, writtenOn: '2026-10-03' })
  })

  it('sends the keys the press reads, so the two cannot drift (the photos link waits for the owner’s call)', () => {
    const dir = join(process.cwd(), 'supabase', 'migrations')
    const head = 'FUNCTION public.gc_save_daily_log('
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .reverse()
      .map((f) => readFileSync(join(dir, f), 'utf8'))
      .find((s) => s.includes(head))
    if (!sql) throw new Error('no migration defines gc_save_daily_log')
    const body = sql.slice(sql.indexOf(head), sql.indexOf('$$;', sql.indexOf(head)))
    const read = new Set([...body.matchAll(/\blog->>?'(\w+)'/g)].map((m) => m[1]))
    read.delete('photosUrl')
    expect([...read].sort()).toEqual(Object.keys(dailyLogPayload('fairoaksd', log, '2026-10-02')).sort())
    expect([...new Set([...body.matchAll(/\bx->>'(\w+)'/g)].map((m) => m[1]))].sort()).toEqual(['note', 'packageId', 'reason', 'workers'])
  })
})

describe('our crew’s clock-ins on the log (Building’s U8)', () => {
  const count = (package_id: string, work_date: string, people: number): CrewOnSiteRow => ({ package_id, work_date, people })
  const logOn = (s: ReturnType<typeof initialGcState>, date: string) => s.projects.find((p) => p.id === 'fairoaksd')!.dailyLogs!.find((l) => l.date === date)!

  it('on a day with a log and clock-ins, our crew’s workers are the count, in the job’s order of trades', () => {
    const s = withCrewClockIns(initialGcState(), [count('fplumb', '2026-09-29', 5)])
    expect(logOn(s, '2026-09-29').crews).toEqual([
      { packageId: 'fsteel', workers: 4 },
      { packageId: 'felec', workers: 2 },
      { packageId: 'froof', workers: 5 },
      { packageId: 'fplumb', workers: 5 },
      { packageId: 'fhvac', workers: 3 },
    ])
  })

  it('adds our crew to a log that had none, in its place among the trades', () => {
    const s = withCrewClockIns(initialGcState(), [count('fplumb', '2026-09-25', 2)])
    expect(logOn(s, '2026-09-25').crews).toEqual([
      { packageId: 'felec', workers: 2 },
      { packageId: 'fplumb', workers: 2 },
    ])
  })

  it('keeps the typed count on a day with no clock-ins, and makes no log for clock-ins on a day with none', () => {
    const before = initialGcState()
    const s = withCrewClockIns(before, [count('fplumb', '2026-09-29', 5), count('fplumb', '2026-09-30', 4)])
    expect(logOn(s, '2026-09-28')).toBe(logOn(before, '2026-09-28'))
    expect(s.projects.find((p) => p.id === 'fairoaksd')!.dailyLogs!.some((l) => l.date === '2026-09-30')).toBe(false)
    expect(missingLogs(s.projects.find((p) => p.id === 'fairoaksd')!, '2026-10-02')).toContain('2026-09-30')
  })

  it('reads only a trade our own crew does, and leaves every other job as it was', () => {
    const before = initialGcState()
    const s = withCrewClockIns(before, [count('felec', '2026-09-29', 9), count('splumb', '2026-09-29', 7)])
    expect(logOn(s, '2026-09-29')).toBe(logOn(before, '2026-09-29'))
    expect(s.projects.find((p) => p.id === 'stoneoak')).toBe(before.projects.find((p) => p.id === 'stoneoak'))
    expect(withCrewClockIns(before, [])).toBe(before)
  })

  it('starts a new day’s log with the day’s count in place of the day before’s', () => {
    const project = fairOaks()
    const log = logWithClockIns(newDailyLog(project, '2026-10-02'), project, [count('fplumb', '2026-10-02', 4)])
    expect(log.crews.find((c) => c.packageId === 'fplumb')).toEqual({ packageId: 'fplumb', workers: 4 })
    expect(crewOnSiteOn([count('fplumb', '2026-10-02', 4)], 'fplumb', '2026-10-01')).toBeNull()
  })

  it('leaves the counted crew off what a save sends, so the count is never stored', () => {
    const crews = [{ packageId: 'felec', workers: 2 }, { packageId: 'fplumb', workers: 4 }]
    expect(crewsToSave(crews, [count('fplumb', '2026-10-02', 4)], '2026-10-02')).toEqual([{ packageId: 'felec', workers: 2 }])
    expect(crewsToSave(crews, [count('fplumb', '2026-10-01', 4)], '2026-10-02')).toEqual(crews)
  })

  it('reads a long job in pages of 92 days, oldest first', () => {
    expect(crewCountPages('2026-07-01', '2026-07-01')).toEqual([{ from: '2026-07-01', to: '2026-07-01' }])
    expect(crewCountPages('2026-07-01', '2026-09-30')).toEqual([{ from: '2026-07-01', to: '2026-09-30' }])
    expect(crewCountPages('2026-07-01', '2026-10-01')).toEqual([
      { from: '2026-07-01', to: '2026-09-30' },
      { from: '2026-10-01', to: '2026-10-01' },
    ])
    expect(crewCountPages('2026-10-02', '2026-10-01')).toEqual([])
  })
})
