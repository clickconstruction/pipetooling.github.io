import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { NO_JOB_HOURS, hoursPeopleWords, hoursWords, jobHoursByJob, jobHoursLead, jobHoursLine, type JobHoursSession } from './jobHours'

// Made-up people on a made-up job.
const dayLabel = (ymd: string): string => `Mar ${Number(ymd.slice(8))}`
const s = (over: Partial<JobHoursSession>): JobHoursSession => ({ jobId: 'j1', userId: 'u1', name: 'Dana Reyes', ymd: '2026-03-02', hours: 8, approved: true, ...over })
const sessions: JobHoursSession[] = [
  s({ ymd: '2026-03-02', hours: 8 }),
  s({ ymd: '2026-03-03', hours: 7.5 }),
  s({ ymd: '2026-03-03', hours: 1 }),
  s({ userId: 'u2', name: 'Sam Holt', ymd: '2026-03-03', hours: 6 }),
  s({ userId: 'u2', name: 'Sam Holt', ymd: '2026-03-05', hours: 4, approved: false }),
  s({ userId: 'u3', name: 'Lee Park', ymd: '2026-03-04', hours: 2 }),
  s({ jobId: 'j2', userId: 'u3', name: 'Lee Park', ymd: '2026-03-04', hours: 3, approved: false }),
  // A session that never ran counts for nothing.
  s({ userId: 'u4', name: 'Nobody Here', hours: 0 }),
]

describe('the hours behind a job', () => {
  const by = jobHoursByJob(sessions)
  const j1 = by.get('j1')!

  it('totals the approved hours and keeps the waiting ones apart', () => {
    expect(j1.hours).toBe(24.5)
    expect(j1.waitingHours).toBe(4)
    expect(j1).toMatchObject({ firstYmd: '2026-03-02', lastYmd: '2026-03-05', dayCount: 4 })
    expect(by.get('j2')).toMatchObject({ hours: 0, waitingHours: 3 })
    expect(by.has('j3')).toBe(false)
  })

  it('lists each person, the most hours first, with their days and last day', () => {
    expect(j1.people).toEqual([
      { userId: 'u1', name: 'Dana Reyes', hours: 16.5, waitingHours: 0, days: 2, lastYmd: '2026-03-03' },
      { userId: 'u2', name: 'Sam Holt', hours: 6, waitingHours: 4, days: 2, lastYmd: '2026-03-05' },
      { userId: 'u3', name: 'Lee Park', hours: 2, waitingHours: 0, days: 1, lastYmd: '2026-03-04' },
    ])
  })

  it('lists a row for each person on each day, newest first, two sessions on a day as one', () => {
    expect(j1.days.map((d) => [d.ymd, d.name, d.hours, d.waiting])).toEqual([
      ['2026-03-05', 'Sam Holt', 4, true],
      ['2026-03-04', 'Lee Park', 2, false],
      ['2026-03-03', 'Dana Reyes', 8.5, false],
      ['2026-03-03', 'Sam Holt', 6, false],
      ['2026-03-02', 'Dana Reyes', 8, false],
    ])
  })

  it('says the hours and who on the job’s line', () => {
    expect(jobHoursLine(j1)).toBe('25 hours by Dana, Sam and Lee')
    expect(jobHoursLine(by.get('j2'))).toBe('3 hours waiting on approval, by Lee')
    expect(jobHoursLine(undefined)).toBe('No hours yet')
    expect(jobHoursLine(NO_JOB_HOURS)).toBe('No hours yet')
    expect(hoursPeopleWords([{ name: 'Dana Reyes' }])).toBe('Dana')
    expect(hoursPeopleWords([{ name: 'Dana Reyes' }, { name: 'Sam Holt' }])).toBe('Dana and Sam')
    expect(hoursPeopleWords([{ name: 'Dana Reyes' }, { name: 'Sam Holt' }, { name: 'Lee Park' }, { name: 'Ana Cruz' }, { name: 'Jo Bell' }])).toBe('Dana, Sam and 3 more')
  })

  it('says hours as a person would', () => {
    expect(hoursWords(0)).toBe('0 hours')
    expect(hoursWords(0.02)).toBe('0.1 hours')
    expect(hoursWords(1)).toBe('1 hour')
    expect(hoursWords(7.46)).toBe('7.5 hours')
    expect(hoursWords(24.5)).toBe('25 hours')
    expect(hoursWords(1234.2)).toBe('1,234 hours')
  })

  it('writes the window’s lead in plain words', () => {
    expect(jobHoursLead(j1, dayLabel)).toEqual(['25 hours approved over 4 days, from Mar 2 to Mar 5.', '4 hours more still wait on approval. They are not in the total.'])
    expect(jobHoursLead(jobHoursByJob([s({})]).get('j1')!, dayLabel)).toEqual(['8 hours approved on Mar 2.'])
    expect(jobHoursLead(NO_JOB_HOURS, dayLabel)).toEqual(['Nobody has clocked time on this job yet.'])
    for (const l of [...jobHoursLead(j1, dayLabel), ...jobHoursLead(NO_JOB_HOURS, dayLabel), jobHoursLine(j1), jobHoursLine(by.get('j2'))]) expect(plainWordsFailures(l), l).toEqual([])
  })
})
