import { describe, expect, it } from 'vitest'
import type { LatenessBlockRow, LatenessSessionRow } from '../scheduleLateness'
import { latenessCellKey } from '../scheduleLateness'
import {
  ATTENDANCE_RECENT_DAYS,
  ATTENDANCE_STRIP_DAYS,
  attendanceCountChips,
  attendanceDayWords,
  attendanceDotSize,
  attendanceMinutesWords,
  attendanceStrip,
  attendanceStripLabels,
  type AttendanceExcuse,
  type AttendanceNcns,
  type AttendanceStripInput,
} from './attendanceStrip'

// APP_CALENDAR_TZ is America/Chicago; October 2026 is CDT (UTC-5), so 7:00 AM wall clock = 12:00Z.
const TODAY = '2026-10-30'
const U = 'u1'

function block(work_date: string, time_start = '07:00:00', over: Partial<LatenessBlockRow> = {}): LatenessBlockRow {
  return { assignee_user_id: U, work_date, time_start, job_label: 'J996', ...over }
}
function session(work_date: string, hhmmZ: string, over: Partial<LatenessSessionRow> = {}): LatenessSessionRow {
  return { user_id: U, work_date, clocked_in_at: `${work_date}T${hhmmZ}:00Z`, origin: 'user_punch', ...over }
}
function excuse(ymd: string, note: string, byName = 'Taunya', onYmd: string | null = '2026-10-28'): [string, AttendanceExcuse] {
  return [latenessCellKey(U, ymd), { note, byName, onYmd }]
}
function run(over: Partial<AttendanceStripInput>) {
  return attendanceStrip({ userId: U, todayYmd: TODAY, blocks: [], sessions: [], excuses: new Map(), ncns: [], ...over })
}
const day = (s: ReturnType<typeof run>, ymd: string) => s.days.find((d) => d.ymd === ymd)!

describe('attendanceStrip — the attendance card as ninety days of dots (v2.6140, punch list #217)', () => {
  it('runs ninety days to today, one column a day, the last thirty shaded, with the four fixed labels', () => {
    const s = run({})
    expect(ATTENDANCE_STRIP_DAYS).toBe(90)
    expect(ATTENDANCE_RECENT_DAYS).toBe(30)
    expect(s.startYmd).toBe('2026-08-02')
    expect(s.endYmd).toBe(TODAY)
    expect(s.recentStartYmd).toBe('2026-10-01')
    expect(s.days.length).toBe(90)
    expect(s.days[0]!.dow).toBe(0)
    expect(s.days[0]!.weekend).toBe(true)
    expect(s.days[89]!.today).toBe(true)
    expect(s.days.filter((d) => d.recent).length).toBe(30)
    expect(day(s, '2026-09-30').recent).toBe(false)
    expect(day(s, '2026-10-01').recent).toBe(true)
    expect(s.labels).toEqual([
      { index: 0, text: 'Aug 2', tone: 'muted', align: 'left' },
      { index: 30, text: 'Sep 1', tone: 'muted', align: 'center' },
      { index: 60, text: 'Oct 1, last 30 days', tone: 'hot', align: 'center' },
      { index: 89, text: 'today', tone: 'today', align: 'right' },
    ])
    expect(s.days.every((d) => d.kind === 'none' && d.receipt === null)).toBe(true)
    expect(day(s, '2026-10-27').words).toBe('Tue, Oct 27: nothing scheduled.')
    expect(s.warn).toBe(false)
    expect(s.writeupLines).toEqual([])
  })

  it('a late day is an amber dot sized by its minutes past grace, with the block, the clock-in and the minutes on its receipt', () => {
    const s = run({ blocks: [block('2026-10-27')], sessions: [session('2026-10-27', '12:35')] })
    const d = day(s, '2026-10-27')
    expect(d.kind).toBe('late')
    expect(d.minutesPastGrace).toBe(20)
    expect(d.size).toBe('mid')
    expect(d.words).toBe('Tue, Oct 27: late 35 minutes, 20 minutes past grace.')
    expect(d.receipt).toEqual({ heading: 'Tue, Oct 27', lines: ['Block 7:00 AM on J996.', 'First clock-in 7:35 AM.', '20 minutes past the 15-minute grace.'] })
    expect(s.counts).toMatchObject({ scheduled: 1, onTime: 0, late: 1, excused: 0, recentLate: 1, medianLateMinutes: 35 })
    expect(s.words).toBe('90 days, Aug 2 to Oct 30, one column a day. 1 late day as amber dots sized by minutes past grace. The last 30 days are shaded. Press a day for its receipt.')
  })

  it('three sizes: a few minutes, a half hour, an hour or more past the grace', () => {
    expect(attendanceDotSize(1)).toBe('small')
    expect(attendanceDotSize(15)).toBe('small')
    expect(attendanceDotSize(16)).toBe('mid')
    expect(attendanceDotSize(45)).toBe('mid')
    expect(attendanceDotSize(46)).toBe('big')
    expect(attendanceMinutesWords(1)).toBe('1 minute')
    expect(attendanceMinutesWords(59)).toBe('59 minutes')
    expect(attendanceMinutesWords(60)).toBe('1 hour')
    expect(attendanceMinutesWords(160)).toBe('2 hours 40 minutes')
    const s = run({ blocks: [block('2026-10-26'), block('2026-10-27'), block('2026-10-28')], sessions: [session('2026-10-26', '12:16'), session('2026-10-27', '12:45'), session('2026-10-28', '13:30')] })
    expect(day(s, '2026-10-26').size).toBe('small')
    expect(day(s, '2026-10-27').size).toBe('mid')
    expect(day(s, '2026-10-28').size).toBe('big')
    expect(day(s, '2026-10-28').words).toBe('Wed, Oct 28: late 1 hour 30 minutes, 1 hour 15 minutes past grace.')
    expect(day(s, '2026-10-28').receipt?.lines[2]).toBe('1 hour 15 minutes past the 15-minute grace.')
  })

  it('an excused late is a grey slash: out of the late count and the median, its excuse on the receipt', () => {
    const s = run({
      blocks: [block('2026-10-26'), block('2026-10-27')],
      sessions: [session('2026-10-26', '12:35'), session('2026-10-27', '13:00')],
      excuses: new Map([excuse('2026-10-26', 'dentist, told office 7:40')]),
    })
    const d = day(s, '2026-10-26')
    expect(d.kind).toBe('excused')
    expect(d.size).toBe('mid')
    expect(d.words).toBe('Mon, Oct 26: late 35 minutes, excused.')
    expect(d.receipt?.lines).toEqual(['Block 7:00 AM on J996.', 'First clock-in 7:35 AM.', '20 minutes past the 15-minute grace.', 'Excused by Taunya on Wed, Oct 28: dentist, told office 7:40'])
    expect(s.counts).toMatchObject({ late: 1, excused: 1, recentLate: 1, medianLateMinutes: 60 })
    expect(s.chips.find((c) => c.key === 'late')).toEqual({ key: 'late', text: 'late 1 · 1 excused', tone: 'warn', words: "1 unexcused late day in 90 days, and 1 excused late. Median 1 hour late. Late is a first clock-in more than 15 minutes after the earliest block's start." })
  })

  it('a scheduled day clocked inside the grace is a ring with its receipt; one with no clock-in is a faint ring', () => {
    const s = run({ blocks: [block('2026-10-26'), block('2026-10-27'), block('2026-10-28'), block(TODAY)], sessions: [session('2026-10-26', '11:52'), session('2026-10-27', '12:10')] })
    expect(day(s, '2026-10-26')).toMatchObject({ kind: 'onTime', size: null, words: 'Mon, Oct 26: on time.' })
    expect(day(s, '2026-10-26').receipt?.lines).toEqual(['Block 7:00 AM on J996.', 'First clock-in 6:52 AM.', 'On time.'])
    expect(day(s, '2026-10-27').receipt?.lines).toEqual(['Block 7:00 AM on J996.', 'First clock-in 7:10 AM.', '10 minutes after the start, inside the 15-minute grace.'])
    expect(day(s, '2026-10-28')).toMatchObject({ kind: 'noClockIn', words: 'Wed, Oct 28: scheduled, no clock-in.' })
    expect(day(s, '2026-10-28').receipt?.lines).toEqual(['Block 7:00 AM on J996.', 'No clock-in that day.'])
    expect(day(s, TODAY)).toMatchObject({ kind: 'noClockIn', words: 'Fri, Oct 30: scheduled, no clock-in yet.' })
    expect(day(s, TODAY).receipt?.lines[1]).toBe('No clock-in yet today.')
    expect(s.counts).toMatchObject({ scheduled: 4, onTime: 2, noClockIn: 2, late: 0 })
    expect(s.chips.find((c) => c.key === 'onTime')).toEqual({ key: 'onTime', text: 'on time 2 of 4', tone: 'neutral', words: 'On time on 2 of 4 scheduled days. 2 scheduled days had no clock-in.' })
    expect(s.chips.find((c) => c.key === 'late')?.tone).toBe('neutral')
  })

  it('a filed no-call no-show is a red diamond whatever else the day holds, with who filed it and the note', () => {
    const ncns: AttendanceNcns = { work_date: '2026-10-09', byName: 'Taunya', filedYmd: '2026-10-10', details: 'No answer on his phone.' }
    const s = run({ ncns: [ncns, { work_date: '2026-07-01', byName: null, filedYmd: null, details: null }] })
    const d = day(s, '2026-10-09')
    expect(d.kind).toBe('ncns')
    expect(d.words).toBe('Fri, Oct 9: no call, no show.')
    expect(d.receipt).toEqual({ heading: 'Fri, Oct 9', lines: ['No call, no show.', 'Filed by Taunya on Sat, Oct 10.', 'No answer on his phone.'] })
    expect(s.counts.ncns).toBe(1)
    expect(s.chips.find((c) => c.key === 'ncns')).toEqual({ key: 'ncns', text: 'NCNS 1', tone: 'stop', words: '1 no-call no-show filed in 90 days.' })
    expect(s.words).toContain('1 no-call no-show as a red diamond.')
  })

  it('three unexcused lates in the last thirty days raise the warning; the write-up context lists each late as a line, newest first', () => {
    const s = run({
      blocks: [block('2026-08-10'), block('2026-10-05', '08:00:00', { job_label: null }), block('2026-10-20'), block('2026-10-27'), block('2026-10-28')],
      sessions: [session('2026-08-10', '12:40'), session('2026-10-05', '13:20'), session('2026-10-20', '12:31'), session('2026-10-27', '12:35'), session('2026-10-28', '12:50')],
      excuses: new Map([excuse('2026-10-20', 'flat tire')]),
    })
    expect(s.counts).toMatchObject({ late: 4, excused: 1, recentLate: 3, medianLateMinutes: 38 })
    expect(s.warn).toBe(true)
    expect(s.writeupLines).toEqual([
      '3 unexcused lates in the last 30 days.',
      '4 in the last 90 days, median 38 minutes late.',
      'Wed, Oct 28: block 7:00 AM on J996, clocked in 7:50 AM, 35 minutes past grace.',
      'Tue, Oct 27: block 7:00 AM on J996, clocked in 7:35 AM, 20 minutes past grace.',
      'Mon, Oct 5: block 8:00 AM, clocked in 8:20 AM, 5 minutes past grace.',
      'Mon, Aug 10: block 7:00 AM on J996, clocked in 7:40 AM, 25 minutes past grace.',
    ])
    // Two lates in the recent run do not raise it.
    expect(run({ blocks: [block('2026-10-27'), block('2026-10-28')], sessions: [session('2026-10-27', '12:35'), session('2026-10-28', '12:50')] }).warn).toBe(false)
  })

  it('a salaried person is unmarked: sessions made at schedule time are never late, and the strip says so; a filed no-call no-show still draws', () => {
    const s = run({
      blocks: [block('2026-10-26'), block('2026-10-27')],
      sessions: [session('2026-10-26', '12:00', { origin: 'salary_schedule' }), session('2026-10-27', '12:35')],
      ncns: [{ work_date: '2026-10-09', byName: null, filedYmd: null, details: null }],
    })
    expect(s.salaried).toBe(true)
    expect(day(s, '2026-10-26')).toMatchObject({ kind: 'none', words: 'Mon, Oct 26: scheduled, salaried.' })
    expect(day(s, '2026-10-27').kind).toBe('none')
    expect(day(s, '2026-10-09').kind).toBe('ncns')
    expect(s.counts).toMatchObject({ scheduled: 0, late: 0, onTime: 0, ncns: 1 })
    expect(s.chips.map((c) => c.key)).toEqual(['ncns'])
    expect(s.words).toBe('90 days, Aug 2 to Oct 30, one column a day. Salaried: clock sessions are made at schedule time, so no day is marked late or on time. 1 no-call no-show as a red diamond. The last 30 days are shaded. Press a day for its receipt.')
    expect(s.warn).toBe(false)
    expect(s.writeupLines).toEqual([])
  })

  it("reads only this person's rows inside the window", () => {
    const s = run({
      blocks: [block('2026-08-01'), block('2026-10-27', '07:00:00', { assignee_user_id: 'u2' }), block('2026-10-27')],
      sessions: [session('2026-08-01', '13:00'), session('2026-10-27', '13:00', { user_id: 'u2' })],
    })
    expect(s.counts).toMatchObject({ scheduled: 1, late: 0, noClockIn: 1 })
    expect(s.days.some((d) => d.ymd === '2026-08-01')).toBe(false)
  })

  it('labels: a month first within a week of a fixed label is dropped, so two labels never touch', () => {
    const days = Array.from({ length: 90 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 7, 5 + i))
      const ymd = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      return { ymd, today: i === 89 }
    })
    // Aug 5 to Nov 2: Nov 1 sits a day before today and Oct 1 three days before the recent edge, so both are dropped.
    const labels = attendanceStripLabels(days, '2026-10-04')
    expect(labels).toEqual([
      { index: 0, text: 'Aug 5', tone: 'muted', align: 'left' },
      { index: 27, text: 'Sep 1', tone: 'muted', align: 'center' },
      { index: 60, text: 'last 30 days', tone: 'hot', align: 'center' },
      { index: 89, text: 'today', tone: 'today', align: 'right' },
    ])
    expect(attendanceDayWords('2026-11-01')).toBe('Sun, Nov 1')
    expect(attendanceCountChips({ scheduled: 0, onTime: 0, late: 0, excused: 0, ncns: 0, noClockIn: 0, recentLate: 0, medianLateMinutes: null }, false).map((c) => c.text)).toEqual(['late 0', 'NCNS 0', 'on time 0 of 0'])
  })
})
