import { describe, expect, it } from 'vitest'
import { buildCrewCalendar, crewDayLabel, crewDayWords, crewHoursWords, crewMonthName, crewQuietWords, crewRangeFor, crewSummaryWords, sessionMinutes } from './jobHistoryCalendar'
import type { ProjectsJobHistoryClockRow } from '../projectsJobHistoryData'
import { ymdAddDays } from '../../utils/dateUtils'

const JOB = 'job-1'
function row(work_date: string, user_id: string, extra: Partial<ProjectsJobHistoryClockRow> = {}): ProjectsJobHistoryClockRow {
  return { job_ledger_id: JOB, user_id, work_date, clocked_in_at: `${work_date}T12:00:00Z`, clocked_out_at: `${work_date}T20:30:00Z`, quick_add_minutes: null, ...extra }
}

// Job 890's shape: July rough-in, an August push with four on site one day, two September days, and work this week.
const rows: ProjectsJobHistoryClockRow[] = [
  row('2026-07-14', 'malachi'), row('2026-07-14', 'jose'),
  row('2026-07-15', 'malachi'), row('2026-07-15', 'jose'), row('2026-07-15', 'edgar'),
  row('2026-08-05', 'malachi'), row('2026-08-05', 'jose'), row('2026-08-05', 'edgar'), row('2026-08-05', 'luis'),
  row('2026-08-05', 'malachi', { clocked_in_at: '2026-08-05T21:00:00Z', clocked_out_at: '2026-08-05T22:00:00Z' }), // a second session, same person, same day
  row('2026-09-15', 'malachi', { clocked_in_at: null, clocked_out_at: null, quick_add_minutes: 240 }),
  row('2026-10-05', 'malachi'), row('2026-10-05', 'jose'), row('2026-10-05', 'edgar'),
  row('2026-10-06', 'malachi'), row('2026-10-06', 'jose', { clocked_out_at: null }),
  { job_ledger_id: 'other-job', user_id: 'malachi', work_date: '2026-08-06', clocked_out_at: '2026-08-06T20:00:00Z' },
]
const opts = { jobId: JOB, todayYmd: '2026-10-06', startYmd: '2026-01-01', endYmd: '2026-10-06' }

describe('jobHistoryCalendar (v2.4694)', () => {
  it('session minutes: quick-add first, else clock-in to clock-out, else nothing', () => {
    expect(sessionMinutes({ clocked_in_at: '2026-08-05T12:00:00Z', clocked_out_at: '2026-08-05T20:30:00Z', quick_add_minutes: null })).toBe(510)
    expect(sessionMinutes({ clocked_in_at: null, clocked_out_at: null, quick_add_minutes: 240 })).toBe(240)
    expect(sessionMinutes({ clocked_in_at: '2026-08-05T12:00:00Z', clocked_out_at: null, quick_add_minutes: null })).toBe(0)
    expect(sessionMinutes({ clocked_out_at: null })).toBe(0)
  })

  it('hours words', () => {
    expect(crewHoursWords(0)).toBe('0 h')
    expect(crewHoursWords(570)).toBe('9.5 h')
    expect(crewHoursWords(480)).toBe('8 h')
    expect(crewHoursWords(22800)).toBe('380 h')
  })

  it('one month per month worked, Sunday-first, weekends and today marked, quiet months counted', () => {
    const cal = buildCrewCalendar(rows, opts)
    expect(cal.months.map((m) => m.key)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10'])
    const jul = cal.months[0]!
    expect(jul.name).toBe('Jul 2026')
    expect(jul.leadBlanks).toBe(3) // Jul 1 2026 is a Wednesday
    expect(jul.days.length).toBe(31)
    expect(jul.days[0]!.dow).toBe(3)
    expect(jul.days[3]!.weekend).toBe(true) // Sat Jul 4
    expect(jul.daysWorked).toBe(2)
    expect(jul.maxPeople).toBe(3)
    expect(jul.quietMonthsBefore).toBe(0)
    const aug = cal.months[1]!
    expect(aug.leadBlanks).toBe(6) // Aug 1 2026 is a Saturday
    expect(aug.days[4]!.people).toBe(4)
    expect(aug.days[4]!.minutes).toBe(4 * 510 + 60) // the second session adds to the day, not to the head count
    expect(aug.days[5]!.people).toBe(0) // the other job's day is not ours
    const oct = cal.months[3]!
    expect(oct.days[5]!.today).toBe(true)
    expect(oct.days[5]!.open).toBe(true)
    expect(oct.days[5]!.people).toBe(2)
    expect(oct.days[5]!.minutes).toBe(510) // the open session counts no minutes
    expect(crewMonthName('2026-10')).toBe('Oct 2026')
  })

  it('a gap of months is skipped and counted', () => {
    const cal = buildCrewCalendar([row('2026-03-02', 'a'), row('2026-07-14', 'a')], opts)
    expect(cal.months.map((m) => m.key)).toEqual(['2026-03', '2026-07'])
    expect(cal.months[1]!.quietMonthsBefore).toBe(3)
    expect(crewQuietWords(3)).toBe('after 3 quiet months')
    expect(crewQuietWords(1)).toBe('after a quiet month')
    expect(crewQuietWords(0)).toBe('')
  })

  it('who: most days first, with their minutes; the summary line', () => {
    const cal = buildCrewCalendar(rows, opts)
    expect(cal.people.map((p) => [p.userId, p.days])).toEqual([['malachi', 6], ['jose', 5], ['edgar', 3], ['luis', 1]])
    expect(cal.people[0]!.minutes).toBe(510 * 4 + 60 + 240 + 510)
    expect(cal.daysWorked).toBe(6)
    expect(cal.maxPeople).toBe(4)
    expect(cal.firstYmd).toBe('2026-07-14')
    expect(cal.lastYmd).toBe('2026-10-06')
    expect(crewSummaryWords(cal, '2026-10-06')).toBe('6 days · Jul 14 → today · 4 people at most · 116 h')
  })

  it('a picked person dims every day they were not there; the range clips', () => {
    const cal = buildCrewCalendar(rows, { ...opts, onlyUserId: 'luis' })
    const aug = cal.months.find((m) => m.key === '2026-08')!
    expect(aug.days[4]!.dimmed).toBe(false)
    expect(cal.months[0]!.days[13]!.dimmed).toBe(true)
    expect(cal.people.length).toBe(4) // the chips stay whole
    const clipped = buildCrewCalendar(rows, { ...opts, startYmd: '2026-10-01' })
    expect(clipped.months.map((m) => m.key)).toEqual(['2026-10'])
    expect(clipped.daysWorked).toBe(2)
    expect(crewSummaryWords(buildCrewCalendar([], opts), '2026-10-06')).toBe('No days worked in this range.')
  })

  it('a day\'s label names the people and the hours; the range modes', () => {
    const cal = buildCrewCalendar(rows, opts)
    const aug5 = cal.months[1]!.days[4]!
    expect(crewDayLabel(aug5, { malachi: 'Malachi', jose: 'Jose', edgar: 'Edgar', luis: 'Luis' })).toBe('Wed Aug 5 · 4 people · 35 h · Malachi, Jose, Edgar, Luis')
    expect(crewDayLabel(cal.months[3]!.days[5]!, { malachi: 'Malachi' })).toBe('Tue Oct 6 · 2 people · 8.5 h · Malachi · still clocked in')
    expect(crewDayLabel(cal.months[0]!.days[0]!, {})).toBe('Wed Jul 1 · nobody')
    expect(crewDayWords('2026-08-05')).toBe('Wed Aug 5')
    expect(crewRangeFor('whole', '2026-10-06', '2026-07-14', { start: 'x', end: 'y' }, ymdAddDays)).toEqual({ start: '2026-07-14', end: '2026-10-06' })
    expect(crewRangeFor('whole', '2026-10-06', '', { start: 'x', end: 'y' }, ymdAddDays)).toEqual({ start: '2026-10-06', end: '2026-10-06' })
    expect(crewRangeFor(90, '2026-10-06', '2026-07-14', { start: 'x', end: 'y' }, ymdAddDays)).toEqual({ start: '2026-07-08', end: '2026-10-06' })
    expect(crewRangeFor('custom', '2026-10-06', '2026-07-14', { start: '2026-09-01', end: '2026-09-30' }, ymdAddDays)).toEqual({ start: '2026-09-01', end: '2026-09-30' })
  })
})
