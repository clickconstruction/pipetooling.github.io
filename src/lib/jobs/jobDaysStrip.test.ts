import { describe, expect, it } from 'vitest'
import { buildJobDaysStrip, sessionDayYmd, JOB_STRIP_MAX_DAYS } from './jobDaysStrip'

const s = (work_date: string, p: { approved?: boolean; out?: boolean; rejected?: boolean; inAt?: string } = {}) => ({
  work_date,
  clocked_in_at: p.inAt ?? `${work_date}T13:00:00Z`,
  clocked_out_at: p.out === false ? null : `${work_date}T21:00:00Z`,
  approved_at: p.approved === false ? null : `${work_date}T22:00:00Z`,
  rejected_at: p.rejected ? `${work_date}T22:30:00Z` : null,
})

describe('buildJobDaysStrip (v2.6139, punch list #217 jobs-pipeline-6)', () => {
  it('runs from the first day to today: the start, approved dots, a pending ring, bill ticks and one last work', () => {
    const today = '2026-10-30'
    const strip = buildJobDaysStrip({
      todayYmd: today,
      sessions: [s('2026-09-16'), s('2026-09-16'), s('2026-09-17'), s('2026-10-12'), s('2026-10-30', { approved: false, out: false })],
      bills: [{ billed_at: '2026-10-09T18:00:00Z' }, { billed_at: null }],
    })
    expect(strip.startYmd).toBe('2026-09-16')
    expect(strip.endYmd).toBe(today)
    expect(strip.firstYmd).toBe('2026-09-16')
    expect(strip.days).toHaveLength(45)
    const d = (ymd: string) => strip.days.find((x) => x.ymd === ymd)!
    expect(d('2026-09-16')).toMatchObject({ start: true, field: 'approved', people: 2, bills: 0, today: false, dow: 3, weekend: false })
    expect(d('2026-09-16').words).toBe('Sep 16 · the job’s first day · 2 on the job, approved')
    expect(d('2026-09-19')).toMatchObject({ weekend: true, field: null, people: 0 })
    expect(d('2026-10-09')).toMatchObject({ field: null, bills: 1 })
    expect(d('2026-10-09').words).toBe('Oct 9 · a bill went out')
    expect(d('2026-10-30')).toMatchObject({ today: true, field: 'pending', open: true, people: 1 })
    expect(d('2026-10-30').words).toBe('Oct 30 · today · 1 on the job now, not approved yet')
    // Mondays carry the month; Oct 1 is a Thursday and no Monday sits within two days.
    expect(strip.days.filter((x) => x.label).map((x) => x.label)).toEqual(['Sep 21', 'Sep 28', 'Oct 1', 'Oct 5', 'Oct 12', 'Oct 19', 'Oct 26'])
    // The pending day today is later than the last approved day, so last work says so.
    expect(strip.lastWork).toEqual({ ymd: today, words: 'clocked in today, still on the job', source: 'open' })
    expect(strip.trimmedDays).toBe(0)
    expect(strip.words).toBe('45 days since the job’s first day, Sep 16, one column a day. 4 field days. 1 bill. Last work clocked in today, still on the job. Press a day to open it in the feed.')
  })

  it('last work is the approved day when nothing later waits; a later clocked-out day says not approved yet; a rejected day is not a day', () => {
    const today = '2026-10-30'
    const approved = buildJobDaysStrip({ todayYmd: today, sessions: [s('2026-10-12'), s('2026-10-05', { approved: false })], bills: [] })
    expect(approved.lastWork).toEqual({ ymd: '2026-10-12', words: 'approved Oct 12', source: 'approved' })
    expect(approved.days.find((d) => d.ymd === '2026-10-05')).toMatchObject({ field: 'pending', open: false })
    const pending = buildJobDaysStrip({ todayYmd: today, sessions: [s('2026-10-12'), s('2026-10-28', { approved: false })], bills: [] })
    expect(pending.lastWork).toEqual({ ymd: '2026-10-28', words: 'clocked out Oct 28, not approved yet', source: 'pending' })
    const todayOut = buildJobDaysStrip({ todayYmd: today, sessions: [s('2026-10-30', { approved: false })], bills: [] })
    expect(todayOut.lastWork?.words).toBe('clocked out today, not approved yet')
    const rejected = buildJobDaysStrip({ todayYmd: today, sessions: [s('2026-10-12', { rejected: true })], bills: [] })
    expect(rejected.lastWork).toBeNull()
    expect(rejected.firstYmd).toBe('')
    expect(rejected.days).toHaveLength(1)
    expect(rejected.words).toBe('No days on the job yet. Press a day to open it in the feed.')
  })

  it('a day on both an approved and a pending session is approved; a session with no work date reads its clock-in day in the company zone', () => {
    const today = '2026-10-30'
    const both = buildJobDaysStrip({ todayYmd: today, sessions: [s('2026-10-12'), s('2026-10-12', { approved: false })], bills: [] })
    expect(both.days.find((d) => d.ymd === '2026-10-12')).toMatchObject({ field: 'approved', people: 2 })
    // 11 pm Central on Oct 11 is 04:00Z Oct 12.
    expect(sessionDayYmd({ work_date: null, clocked_in_at: '2026-10-12T04:00:00Z' })).toBe('2026-10-11')
    expect(sessionDayYmd({ work_date: ' ', clocked_in_at: '' })).toBe('')
  })

  it('a long job keeps today in view and counts the days off the left edge; the first day is only a diamond when it is on the strip', () => {
    const today = '2026-10-30'
    const long = buildJobDaysStrip({ todayYmd: today, sessions: [s('2026-03-02'), s('2026-10-12')], bills: [], sessionsTruncated: true })
    expect(long.days).toHaveLength(JOB_STRIP_MAX_DAYS)
    expect(long.endYmd).toBe(today)
    expect(long.startYmd).toBe('2026-07-03')
    expect(long.trimmedDays).toBe(123)
    expect(long.days.some((d) => d.start)).toBe(false)
    expect(long.truncated).toBe(true)
    expect(long.words).toContain('123 earlier days are off the left edge.')
    expect(long.words).toContain('Only the first 100 sessions were read.')
  })
})
