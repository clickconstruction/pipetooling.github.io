import { describe, expect, it } from 'vitest'
import {
  PERSON_HOURS_STRIP_DAYS,
  earlierPendingCount,
  earlierPendingStubWords,
  firstOfLastDays,
  formatStripHours,
  hoursStripDayTitle,
  hoursStripDays,
  hoursStripWords,
  isWeekendYmd,
  pendingHoursByWorkDate,
  personHoursHeadChip,
  reviewApproveLabel,
  reviewHoursButtonWords,
  reviewedThroughRule,
  reviewedThroughWords,
  sessionHours,
  type HoursStripSession,
} from './hoursDayStrip'

const today = '2026-10-30' // a Friday
const first = firstOfLastDays(today, PERSON_HOURS_STRIP_DAYS)

function session(work_date: string, hours: number, over: Partial<HoursStripSession> = {}): HoursStripSession {
  const start = Date.parse(`${work_date}T13:00:00Z`)
  return { work_date, clocked_in_at: new Date(start).toISOString(), clocked_out_at: new Date(start + hours * 3_600_000).toISOString(), approved_at: '2026-10-29T00:00:00Z', ...over }
}

describe('hoursStripDays', () => {
  it('runs the last fourteen days to today, weekends known', () => {
    expect(first).toBe('2026-10-17')
    const days = hoursStripDays([], { firstYmd: first, todayYmd: today })
    expect(days).toHaveLength(14)
    expect(days[0]!.ymd).toBe('2026-10-17')
    expect(days[13]).toMatchObject({ ymd: today, today: true, kind: 'none', hours: 0 })
    expect(days.filter((d) => d.weekend).map((d) => d.ymd)).toEqual(['2026-10-17', '2026-10-18', '2026-10-24', '2026-10-25'])
    expect(isWeekendYmd('2026-10-26')).toBe(false)
  })

  it('an approved day is a filled dot, a waiting day a ring even with approved hours, an open day the clock', () => {
    const rows: HoursStripSession[] = [
      session('2026-10-26', 8),
      session('2026-10-27', 4),
      session('2026-10-27', 4.5, { approved_at: null }),
      session('2026-10-29', 8.5, { approved_at: null }),
      session('2026-10-28', 8, { rejected_at: '2026-10-29T00:00:00Z' }),
      session('2026-10-28', 2, { approved_at: null, revoked_at: '2026-10-29T00:00:00Z' }),
      { work_date: today, clocked_in_at: `${today}T12:05:00Z`, clocked_out_at: null, approved_at: null },
      session('2026-10-01', 8),
    ]
    const days = hoursStripDays(rows, { firstYmd: first, todayYmd: today })
    const by = new Map(days.map((d) => [d.ymd, d]))
    expect(by.get('2026-10-26')).toMatchObject({ kind: 'approved', approvedHours: 8, waitingHours: 0, hours: 8 })
    expect(by.get('2026-10-27')).toMatchObject({ kind: 'waiting', approvedHours: 4, waitingHours: 4.5, hours: 8.5 })
    expect(by.get('2026-10-28')).toMatchObject({ kind: 'none', hours: 0 })
    expect(by.get('2026-10-29')).toMatchObject({ kind: 'waiting', waitingHours: 8.5 })
    expect(by.get(today)).toMatchObject({ kind: 'open', open: true, hours: 0, today: true })
    expect(hoursStripDayTitle(by.get('2026-10-27')!)).toBe('Tue, Oct 27 · 4 h approved · 4.5 h waiting on approval')
    expect(hoursStripDayTitle(by.get(today)!)).toBe('Fri, Oct 30 · on the clock')
    expect(hoursStripDayTitle(by.get('2026-10-28')!)).toBe('Wed, Oct 28')
    expect(hoursStripWords(days, '2026-10-18')).toBe('14 days · 2 approved · 2 waiting · on the clock today · reviewed through Oct 18')
  })

  it('reads a session’s hours only when it closed after it opened', () => {
    expect(sessionHours(session('2026-10-26', 7.5))).toBe(7.5)
    expect(sessionHours({ clocked_in_at: '2026-10-26T13:00:00Z', clocked_out_at: null })).toBe(0)
    expect(sessionHours({ clocked_in_at: '2026-10-26T13:00:00Z', clocked_out_at: '2026-10-26T12:00:00Z' })).toBe(0)
    expect(sessionHours({ clocked_in_at: 'x', clocked_out_at: '2026-10-26T12:00:00Z' })).toBe(0)
  })

  it('formats hours as the strip prints them', () => {
    expect(formatStripHours(8)).toBe('8')
    expect(formatStripHours(8.5)).toBe('8.5')
    expect(formatStripHours(8.04)).toBe('8')
    expect(formatStripHours(0)).toBe('')
    expect(formatStripHours(-1)).toBe('')
  })
})

describe('the reviewed-through rule and the header chip', () => {
  const days = hoursStripDays([], { firstYmd: first, todayYmd: today })
  it('sits after the last day on or before the review, before the strip when older, nowhere with none', () => {
    expect(reviewedThroughRule(days, '2026-10-18')).toEqual({ kind: 'after', index: 1 })
    expect(reviewedThroughRule(days, '2026-10-24')).toEqual({ kind: 'after', index: 7 })
    expect(reviewedThroughRule(days, today)).toEqual({ kind: 'after', index: 13 })
    expect(reviewedThroughRule(days, '2026-10-01')).toEqual({ kind: 'before' })
    expect(reviewedThroughRule(days, null)).toEqual({ kind: 'none' })
    expect(reviewedThroughRule([], '2026-10-18')).toEqual({ kind: 'none' })
    expect(reviewedThroughWords('2026-10-18')).toBe('reviewed through Oct 18')
    expect(reviewedThroughWords(null)).toBe('no review yet')
  })

  it('the header keeps one chip: what waits, else the clock, else nothing', () => {
    expect(personHoursHeadChip({ count: 1, hours: 8.5 }, true)).toEqual({ words: '1 waiting · 8.5 h', tone: 'amber' })
    expect(personHoursHeadChip({ count: 2, hours: 0.02 }, false)).toEqual({ words: '2 waiting · 0 h', tone: 'amber' })
    expect(personHoursHeadChip({ count: 0, hours: 0 }, true)).toEqual({ words: 'on the clock', tone: 'green' })
    expect(personHoursHeadChip({ count: 0, hours: 0 }, false)).toEqual({ words: 'nothing waiting', tone: 'grey' })
  })
})

describe('People → Hours: pending days and the earlier weeks', () => {
  it('sums closed pending hours by work day and skips approved, open, rejected and revoked', () => {
    const rows: HoursStripSession[] = [
      session('2026-10-27', 2, { approved_at: null }),
      session('2026-10-27', 1.5, { approved_at: null }),
      session('2026-10-28', 3, { approved_at: null }),
      session('2026-10-28', 8),
      session('2026-10-29', 4, { approved_at: null, rejected_at: '2026-10-29T00:00:00Z' }),
      { work_date: '2026-10-30', clocked_in_at: '2026-10-30T12:00:00Z', clocked_out_at: null, approved_at: null },
    ]
    expect(pendingHoursByWorkDate(rows)).toEqual({ '2026-10-27': 3.5, '2026-10-28': 3 })
  })

  it('the stub counts what the strip does not show, and says so only above zero', () => {
    expect(earlierPendingCount(11, 4)).toBe(7)
    expect(earlierPendingCount(3, 4)).toBe(0)
    expect(earlierPendingCount(null, 4)).toBeNull()
    expect(earlierPendingStubWords(7)).toBe('7 earlier ›')
    expect(earlierPendingStubWords(0)).toBe('')
    expect(earlierPendingStubWords(null)).toBe('')
    expect(reviewApproveLabel(12.5)).toBe('Review & approve · 12.5 h')
    expect(reviewApproveLabel(0)).toBe('Review & approve')
  })

  it('the Review Hours press claims a review only when one is recorded', () => {
    expect(reviewHoursButtonWords([])).toMatchObject({ label: 'Review Hours', checked: false })
    expect(reviewHoursButtonWords([null, null])).toMatchObject({ label: 'Review Hours', checked: false })
    expect(reviewHoursButtonWords(['2026-10-18', '2026-10-18'])).toEqual({
      label: 'Reviewed through Oct 18',
      checked: true,
      title: 'Everyone shown is reviewed through Oct 18. Opens Review Hours.',
    })
    expect(reviewHoursButtonWords(['2026-10-18', '2026-10-25']).title).toBe('Everyone shown is reviewed through Oct 18. The newest review reaches Oct 25. Opens Review Hours.')
    expect(reviewHoursButtonWords(['2026-10-25', null, '2026-10-18'])).toEqual({
      label: 'Reviewed through Oct 18',
      checked: false,
      title: 'Everyone with a review is reviewed through Oct 18. The newest review reaches Oct 25. 1 shown has no review. Opens Review Hours.',
    })
    expect(reviewHoursButtonWords(['2026-10-25', null, null]).title).toBe('Everyone with a review is reviewed through Oct 25. 2 shown have no review. Opens Review Hours.')
  })
})
