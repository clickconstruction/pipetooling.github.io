import { describe, expect, it } from 'vitest'
import {
  buildJobHoursPrintHtml,
  buildJobHoursStoryDays,
  buildJobHoursSummaryText,
  formatBlockTime,
  formatMinutesAsHhMm,
  jobHoursStoryTotals,
  type JobHoursClockSession,
  type JobHoursScheduleBlock,
} from './jobHoursStory'

const session = (p: Partial<JobHoursClockSession> & Pick<JobHoursClockSession, 'id'>): JobHoursClockSession => ({
  userName: 'Michael A',
  clockedInAt: '2026-08-11T13:02:00Z',
  clockedOutAt: '2026-08-11T20:41:00Z',
  workDate: '2026-08-11',
  notes: '',
  ...p,
})

const block = (p: Partial<JobHoursScheduleBlock> & Pick<JobHoursScheduleBlock, 'id'>): JobHoursScheduleBlock => ({
  userName: 'Bryan',
  workDate: '2026-08-11',
  timeStart: '08:00:00',
  timeEnd: '16:00:00',
  note: 'Rough-in day',
  ...p,
})

describe('buildJobHoursStoryDays', () => {
  it('groups by work date ascending, clock entries before schedule within a day', () => {
    const days = buildJobHoursStoryDays(
      [session({ id: 'c2', workDate: '2026-08-13', clockedInAt: '2026-08-13T14:00:00Z' }), session({ id: 'c1' })],
      [block({ id: 'b1' })],
      true,
    )
    expect(days.map((d) => d.ymd)).toEqual(['2026-08-11', '2026-08-13'])
    expect(days[0]!.entries.map((e) => e.kind)).toEqual(['clock', 'schedule'])
    expect(days[0]!.label).toContain('Aug 11')
  })

  it('omits schedule blocks when the overlay is off', () => {
    const days = buildJobHoursStoryDays([session({ id: 'c1' })], [block({ id: 'b1' })], false)
    expect(days).toHaveLength(1)
    expect(days[0]!.entries).toHaveLength(1)
  })

  it('an open session reads "now" with no duration', () => {
    const days = buildJobHoursStoryDays([session({ id: 'c1', clockedOutAt: null })], [], false)
    const e = days[0]!.entries[0]!
    expect(e.stillClockedIn).toBe(true)
    expect(e.durationMinutes).toBeNull()
    expect(e.timeLabel).toContain('now')
  })
})

describe('jobHoursStoryTotals', () => {
  it('sums closed sessions, counts people/days/open', () => {
    const t = jobHoursStoryTotals([
      session({ id: 'a' }), // 459m
      session({ id: 'b', userName: 'Bryan', workDate: '2026-08-13', clockedOutAt: null }),
    ])
    expect(t.totalMinutes).toBe(459)
    expect(t.peopleCount).toBe(2)
    expect(t.dayCount).toBe(2)
    expect(t.openSessionCount).toBe(1)
  })
})

describe('summary + print', () => {
  it('summary lists only described entries with dated lines', () => {
    const days = buildJobHoursStoryDays(
      [session({ id: 'a', notes: 'Set tub valves' }), session({ id: 'b', userName: 'Bryan', notes: '' })],
      [block({ id: 'k' })],
      true,
    )
    const text = buildJobHoursSummaryText(days, '707 · The Learning Experience')
    expect(text).toContain('707 · The Learning Experience')
    expect(text).toContain('Michael A: Set tub valves')
    expect(text).toContain('Bryan: Rough-in day (scheduled)')
    expect(text.split('\n')).toHaveLength(3)
  })

  it('summary falls back when nothing is described', () => {
    const days = buildJobHoursStoryDays([session({ id: 'a' })], [], false)
    expect(buildJobHoursSummaryText(days, 'Job')).toContain('no work descriptions recorded yet')
  })

  it('print html escapes content and carries totals', () => {
    const days = buildJobHoursStoryDays([session({ id: 'a', notes: '<b>PVC & fittings</b>' })], [], false)
    const html = buildJobHoursPrintHtml('707 <PLUM>', days, jobHoursStoryTotals([session({ id: 'a' })]))
    expect(html).toContain('Work on 707 &lt;PLUM&gt;')
    expect(html).toContain('&lt;b&gt;PVC &amp; fittings&lt;/b&gt;')
    expect(html).toContain('7h 39m worked')
  })
})

describe('formatting', () => {
  it('formats block times and minutes', () => {
    expect(formatBlockTime('08:00:00')).toBe('8:00 AM')
    expect(formatBlockTime('13:30')).toBe('1:30 PM')
    expect(formatBlockTime('00:15')).toBe('12:15 AM')
    expect(formatMinutesAsHhMm(459)).toBe('7h 39m')
    expect(formatMinutesAsHhMm(42)).toBe('42m')
  })
})
