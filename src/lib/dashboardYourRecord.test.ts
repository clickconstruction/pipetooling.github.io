import { describe, expect, it } from 'vitest'
import { buildYourRecordItems, yourRecordItemCopy, type YourRecordJob, type YourRecordSession } from './dashboardYourRecord'

const job = (o: Partial<YourRecordJob> & { id: string }): YourRecordJob => ({ hcpNumber: 'J1', jobName: 'Job', jobAddress: '', pctComplete: 40, status: 'working', ...o })
const s = (o: Partial<YourRecordSession> & { id: string }): YourRecordSession => ({ jobId: 'j1', workDate: '2026-09-08', clockedOutAt: '2026-09-08T20:00:00Z', hours: 8, ...o })
const base = { todayYmd: '2026-09-11', weekStart: '2026-09-06', reportedJobIds: new Set<string>(), officeJobId: 'office' }

describe('buildYourRecordItems', () => {
  it('is empty when the record is clean', () => {
    const items = buildYourRecordItems({ ...base, sessions: [s({ id: 'a' })], jobsById: new Map([['j1', job({ id: 'j1' })]]), reportedJobIds: new Set(['j1']) })
    expect(items).toEqual([])
  })

  it('flags a session still running from a past day, oldest first, but not one running today', () => {
    const items = buildYourRecordItems({
      ...base,
      sessions: [s({ id: 'today', workDate: '2026-09-11', clockedOutAt: null, hours: 0 }), s({ id: 'wed', workDate: '2026-09-09', clockedOutAt: null, hours: 0 }), s({ id: 'mon', workDate: '2026-09-07', clockedOutAt: null, hours: 0, jobId: null })],
      jobsById: new Map([['j1', job({ id: 'j1', hcpNumber: '878', jobName: 'Take 5 Seguin' })]]),
      reportedJobIds: new Set(['j1']),
    })
    expect(items.map((i) => i.key)).toEqual(['clock-open', 'clock-open'])
    expect(items[0]).toMatchObject({ sessionId: 'mon', ymd: '2026-09-07', job: null })
    expect(items[1]).toMatchObject({ sessionId: 'wed', jobId: 'j1' })
    expect(yourRecordItemCopy(items[1]!)).toEqual({ title: "You're still on the clock from Wednesday", detail: 'Clocked in at 878 Take 5 Seguin, never clocked out. Fix the day so the hours are right.', action: 'Fix day' })
  })

  it('flags open jobs worked this week with no % (most hours first), skipping finished jobs, the office job, and last week', () => {
    const items = buildYourRecordItems({
      ...base,
      sessions: [
        s({ id: 'a', jobId: 'big', hours: 6 }),
        s({ id: 'b', jobId: 'big', hours: 18, workDate: '2026-09-09' }),
        s({ id: 'c', jobId: 'small', hours: 3 }),
        s({ id: 'd', jobId: 'done', hours: 8 }),
        s({ id: 'e', jobId: 'office', hours: 2 }),
        s({ id: 'f', jobId: 'old', hours: 8, workDate: '2026-09-04' }),
        s({ id: 'g', jobId: 'set', hours: 8 }),
      ],
      jobsById: new Map([
        ['big', job({ id: 'big', hcpNumber: '1007', jobName: 'SpaceX', pctComplete: null })],
        ['small', job({ id: 'small', hcpNumber: '523', jobName: 'Mission Hills', pctComplete: 0 })],
        ['done', job({ id: 'done', pctComplete: null, status: 'billed' })],
        ['office', job({ id: 'office', pctComplete: null })],
        ['old', job({ id: 'old', pctComplete: null })],
        ['set', job({ id: 'set', pctComplete: 60 })],
      ]),
      reportedJobIds: new Set(['big', 'small', 'set']),
    })
    expect(items.map((i) => i.key === 'no-pct' && `${i.jobId}:${i.hours}`)).toEqual(['big:24', 'small:3'])
    expect(yourRecordItemCopy(items[0]!)).toEqual({ title: '1007 SpaceX has no % complete', detail: 'You clocked 24h there this week. Nobody has said how far along it is.', action: 'Set %' })
  })

  it('flags jobs worked this week with no report from you, and caps the list at three, clock-open and no-pct first', () => {
    const items = buildYourRecordItems({
      ...base,
      sessions: [
        s({ id: 'open', workDate: '2026-09-10', clockedOutAt: null, hours: 0 }),
        s({ id: 'a', jobId: 'nopct', hours: 4 }),
        s({ id: 'b', jobId: 'r1', hours: 5, workDate: '2026-09-09' }),
        s({ id: 'c', jobId: 'r2', hours: 6 }),
      ],
      jobsById: new Map([
        ['j1', job({ id: 'j1' })],
        ['nopct', job({ id: 'nopct', pctComplete: null })],
        ['r1', job({ id: 'r1', hcpNumber: '878', jobName: 'Take 5 Seguin' })],
        ['r2', job({ id: 'r2' })],
      ]),
      reportedJobIds: new Set(['j1']),
    })
    // clock-open (1) + no-pct (1) + the first no-report by hours (r2, 6h) — r1 and nopct's own report row fall off the cap.
    expect(items.map((i) => i.key)).toEqual(['clock-open', 'no-pct', 'no-report'])
    expect(items[2]).toMatchObject({ jobId: 'r2', hours: 6 })
    const r1 = buildYourRecordItems({ ...base, sessions: [s({ id: 'b', jobId: 'r1', hours: 5, workDate: '2026-09-09' })], jobsById: new Map([['r1', job({ id: 'r1', hcpNumber: '878', jobName: 'Take 5 Seguin' })]]) })
    expect(yourRecordItemCopy(r1[0]!)).toEqual({ title: 'No report on 878 Take 5 Seguin', detail: 'You worked it Wednesday (5.0h this week); no field report from you yet.', action: 'Report' })
  })
})
