import { describe, expect, it } from 'vitest'
import { resolveScheduleDispatchLinkedDay, scheduleDispatchDayTabWorkDate } from './scheduleDispatchDayLink'

const WEEK = ['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']
const WEEKDAYS = WEEK.slice(1, 6)

describe('resolveScheduleDispatchLinkedDay', () => {
  it('a Day-view link renders the linked day, not today (J18-F11)', () => {
    const day = resolveScheduleDispatchLinkedDay({ isTomorrow: false, tomorrowYmd: 'x', dayParam: '2026-09-03', visibleDayKeys: WEEK })
    expect(day).toBe('2026-09-03')
    expect(scheduleDispatchDayTabWorkDate(day)).toBe('2026-09-03')
  })

  it('no ?day= → no linked day; the Day tab falls back to its own default', () => {
    expect(resolveScheduleDispatchLinkedDay({ isTomorrow: false, tomorrowYmd: 'x', dayParam: null, visibleDayKeys: WEEK })).toBe('')
    expect(resolveScheduleDispatchLinkedDay({ isTomorrow: false, tomorrowYmd: 'x', dayParam: '  ', visibleDayKeys: WEEK })).toBe('')
    expect(scheduleDispatchDayTabWorkDate('')).toBeUndefined()
  })

  it('a day outside the visible week is ignored (the page strips the param too)', () => {
    expect(resolveScheduleDispatchLinkedDay({ isTomorrow: false, tomorrowYmd: 'x', dayParam: '2026-09-09', visibleDayKeys: WEEK })).toBe('')
  })

  it('weekend-hidden weeks reject a Saturday link', () => {
    expect(resolveScheduleDispatchLinkedDay({ isTomorrow: false, tomorrowYmd: 'x', dayParam: '2026-09-05', visibleDayKeys: WEEKDAYS })).toBe('')
    expect(resolveScheduleDispatchLinkedDay({ isTomorrow: false, tomorrowYmd: 'x', dayParam: '2026-09-04', visibleDayKeys: WEEKDAYS })).toBe('2026-09-04')
  })

  it('trims the raw param', () => {
    expect(resolveScheduleDispatchLinkedDay({ isTomorrow: false, tomorrowYmd: 'x', dayParam: ' 2026-09-02 ', visibleDayKeys: WEEK })).toBe('2026-09-02')
  })

  it('the Tomorrow route is pinned to tomorrow whatever the URL says', () => {
    expect(resolveScheduleDispatchLinkedDay({ isTomorrow: true, tomorrowYmd: '2026-09-06', dayParam: '2026-09-02', visibleDayKeys: WEEK })).toBe(
      '2026-09-06',
    )
  })
})
