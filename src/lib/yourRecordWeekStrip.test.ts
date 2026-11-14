import { describe, expect, it } from 'vitest'
import { MIN_BAR_PCT, buildYourRecordWeekStrip, hoursWords, lineOf } from './yourRecordWeekStrip'
import type { YourRecordItem, YourRecordJob, YourRecordSession } from './dashboardYourRecord'

/** The pay week of Sun 2026-10-25 to Sat 2026-10-31; today is Friday the 30th at 10:12 in the company's day. */
const WEEK_START = '2026-10-25'
const TODAY = '2026-10-30'
const NOW_MS = Date.parse('2026-10-30T15:12:00Z')

const job: YourRecordJob = { id: 'j1', hcpNumber: '1318', jobName: 'Sample Retail Shell rough-in', jobAddress: '', pctComplete: 40, status: 'working' }
const noReport: YourRecordItem = { key: 'no-report', jobId: 'j1', job, hours: 8.5, lastWorkYmd: '2026-10-29' }
const s = (o: Partial<YourRecordSession> & { id: string }): YourRecordSession => ({ jobId: 'j1', workDate: '2026-10-29', clockedOutAt: '2026-10-29T22:30:00Z', hours: 8.5, clockedInAt: '2026-10-29T13:00:00Z', ...o })

describe('buildYourRecordWeekStrip', () => {
  it('draws a closed day as a bar with its hours, the ends labelled, today tinted, the rest empty', () => {
    const strip = buildYourRecordWeekStrip({ item: noReport, todayYmd: TODAY, weekStart: WEEK_START, nowMs: NOW_MS, sessions: [s({ id: 'thu' })], reportDays: new Set() })
    expect(strip.weekEnd).toBe('2026-10-31')
    expect(strip.days.map((d) => d.short)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
    const thu = strip.days[4]!
    expect(thu).toMatchObject({ hours: 8.5, openHours: 0, open: false, barPct: 100, label: '8.5h', report: false })
    expect(thu.words).toBe('Thu, Oct 29 · 8.5 h on this job')
    expect(strip.days[5]).toMatchObject({ today: true, hours: 0, barPct: 0, label: '', words: 'Today · nothing on this job' })
    expect(strip.days[6]).toMatchObject({ future: true, label: '', words: 'Sat, Oct 31 · not yet' })
    expect(strip.days.filter((d) => d.label).length).toBe(1)
    expect(strip).toMatchObject({ closedHours: 8.5, openHours: 0, reportDays: 0, line: 'no report from you this pay week' })
    expect(strip.words).toBe('Sun, Oct 25 to Sat, Oct 31: 8.5 h Thursday. No report from you this pay week.')
  })

  it("today's open session is a hatched bar with its hours so far, no label, and said in the words", () => {
    const strip = buildYourRecordWeekStrip({
      item: noReport,
      todayYmd: TODAY,
      weekStart: WEEK_START,
      nowMs: NOW_MS,
      sessions: [s({ id: 'thu' }), s({ id: 'fri', workDate: TODAY, clockedOutAt: null, hours: 0, clockedInAt: '2026-10-30T12:30:00Z' })],
      reportDays: new Set(),
    })
    const fri = strip.days[5]!
    expect(fri).toMatchObject({ today: true, open: true, hours: 0, openHours: 2.7, label: '' })
    expect(fri.barPct).toBe(Math.round((100 * 2.7) / 8.5))
    expect(fri.words).toBe('Today · 2.7 h so far, still on the clock')
    expect(strip.openHours).toBe(2.7)
    expect(strip.words).toBe('Sun, Oct 25 to Sat, Oct 31: 8.5 h Thursday; 2.7 h so far today, still on the clock. No report from you this pay week.')
  })

  it('a report day gets a dot and is counted; a short day still shows a sliver', () => {
    const strip = buildYourRecordWeekStrip({
      item: { key: 'no-pct', jobId: 'j1', job, hours: 9 },
      todayYmd: TODAY,
      weekStart: WEEK_START,
      nowMs: NOW_MS,
      sessions: [s({ id: 'tue', workDate: '2026-10-27', hours: 8 }), s({ id: 'wed', workDate: '2026-10-28', hours: 0.4 })],
      reportDays: new Set(['2026-10-27']),
    })
    expect(strip.days[2]).toMatchObject({ report: true, hours: 8, label: '8.0h' })
    expect(strip.days[2]!.words).toBe('Tue, Oct 27 · 8.0 h on this job · a report landed')
    expect(strip.days[3]!.barPct).toBe(MIN_BAR_PCT)
    expect(strip.reportDays).toBe(1)
    expect(strip.line).toBe('nobody has said how far along it is')
    expect(strip.words).toBe('Sun, Oct 25 to Sat, Oct 31: 8.0 h Tuesday, 0.4 h Wednesday; a report Tuesday. Nobody has said how far along it is.')
  })

  it('a week with nothing on the job draws seven empty days and says so', () => {
    const strip = buildYourRecordWeekStrip({ item: noReport, todayYmd: TODAY, weekStart: WEEK_START, nowMs: NOW_MS, sessions: [s({ id: 'other', jobId: 'j2' })], reportDays: new Set() })
    expect(strip.days.every((d) => d.barPct === 0 && !d.open && !d.report)).toBe(true)
    expect(strip.closedHours).toBe(0)
    expect(strip.words).toBe('Sun, Oct 25 to Sat, Oct 31: nothing yet. No report from you this pay week.')
  })

  it('a clock left running from a past day is hatched on that day with no hours, and the line names the day', () => {
    const item: YourRecordItem = { key: 'clock-open', sessionId: 'wed', ymd: '2026-10-28', jobId: 'j1', job }
    const strip = buildYourRecordWeekStrip({
      item,
      todayYmd: TODAY,
      weekStart: WEEK_START,
      nowMs: NOW_MS,
      sessions: [s({ id: 'wed', workDate: '2026-10-28', clockedOutAt: null, hours: 0 }), s({ id: 'thu' })],
      reportDays: new Set(),
    })
    expect(strip.days[3]).toMatchObject({ open: true, openHours: 0, hours: 0, barPct: 0, words: 'Wed, Oct 28 · clocked in, never clocked out' })
    expect(lineOf(item)).toBe('still on the clock from Wednesday')
    expect(strip.words).toContain('clocked in Wednesday, never clocked out')
  })

  it('labels a worked day with its hours alone, whole from ten, so two worked neighbours never overprint', () => {
    const strip = buildYourRecordWeekStrip({
      item: noReport,
      todayYmd: TODAY,
      weekStart: WEEK_START,
      nowMs: NOW_MS,
      sessions: [s({ id: 'wed', workDate: '2026-10-28', hours: 12.4 }), s({ id: 'thu' })],
      reportDays: new Set(),
    })
    expect(strip.days.map((d) => d.label)).toEqual(['', '', '', '12h', '8.5h', '', ''])
  })

  it('prints hours in tenths under ten and whole from ten', () => {
    expect(hoursWords(8.5)).toBe('8.5 h')
    expect(hoursWords(12.4)).toBe('12 h')
    expect(hoursWords(0.04)).toBe('0.0 h')
  })
})
