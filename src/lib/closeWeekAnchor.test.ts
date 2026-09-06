import { describe, expect, it } from 'vitest'
import {
  closeWeekContaining,
  closeWeekMonday,
  closeWeekStillRunning,
  formatCloseWeekLabel,
  isDefaultCloseWeek,
  moneyfillHref,
  parseCloseWeekParam,
  previousCompleteCloseWeek,
  previousCompleteCloseWeekMonday,
  resolveWeeklyMoneyReportWeek,
} from './closeWeekAnchor'
import { previousCompleteWeekMonday } from './moneyfillWeekClose'
import { previousCompletePayWeek } from './payWeekAnchor'

// Wed Sep 2 2026, mid-day Central.
const WED = new Date('2026-09-02T18:00:00-05:00')
// Sunday Sep 6 2026 morning Central — the current close week has one day left.
const SUN = new Date('2026-09-06T08:00:00-05:00')
// Monday Sep 7 2026 morning Central — the week that just ended is Aug 31 – Sep 6.
const MON = new Date('2026-09-07T08:00:00-05:00')

describe('closeWeekAnchor — Mon–Sun is the one close week', () => {
  it('closeWeekMonday is the Monday on or before the date', () => {
    expect(closeWeekMonday('2026-09-02')).toBe('2026-08-31') // Wed → Mon
    expect(closeWeekMonday('2026-08-31')).toBe('2026-08-31') // Monday stays
    expect(closeWeekMonday('2026-09-06')).toBe('2026-08-31') // Sunday → its Monday
  })

  it('closeWeekContaining spans Monday through Sunday', () => {
    expect(closeWeekContaining('2026-09-02')).toEqual({ monday: '2026-08-31', sunday: '2026-09-06' })
  })

  it('previousCompleteCloseWeek is the prior Mon–Sun — Moneyfill AND the report default here', () => {
    expect(previousCompleteCloseWeek(WED)).toEqual({ monday: '2026-08-24', sunday: '2026-08-30' })
    // Sunday: the current week is not complete yet, so the default is still the week before.
    expect(previousCompleteCloseWeek(SUN)).toEqual({ monday: '2026-08-24', sunday: '2026-08-30' })
    // Monday morning: the week that ended yesterday.
    expect(previousCompleteCloseWeek(MON)).toEqual({ monday: '2026-08-31', sunday: '2026-09-06' })
    expect(previousCompleteCloseWeekMonday(MON)).toBe('2026-08-31')
  })

  it('moneyfillWeekClose.previousCompleteWeekMonday is this anchor (one implementation)', () => {
    expect(previousCompleteWeekMonday(WED)).toBe(previousCompleteCloseWeekMonday(WED))
    expect(previousCompleteWeekMonday(MON)).toBe(previousCompleteCloseWeekMonday(MON))
  })

  it('the two families stay distinct: the pay week ending inside the close week starts the Sunday before', () => {
    const close = previousCompleteCloseWeek(WED)
    const pay = previousCompletePayWeek(WED)
    expect(close).toEqual({ monday: '2026-08-24', sunday: '2026-08-30' })
    expect(pay).toEqual({ start: '2026-08-23', end: '2026-08-29' })
  })

  it('formatCloseWeekLabel reads like the picker header', () => {
    expect(formatCloseWeekLabel('2026-08-24')).toBe('Aug 24 – 30')
    expect(formatCloseWeekLabel('2026-08-31')).toBe('Aug 31 – Sep 6')
  })

  it('isDefaultCloseWeek / closeWeekStillRunning', () => {
    expect(isDefaultCloseWeek('2026-08-24', WED)).toBe(true)
    expect(isDefaultCloseWeek('2026-08-31', WED)).toBe(false)
    expect(closeWeekStillRunning('2026-08-31', WED)).toBe(true) // current week
    expect(closeWeekStillRunning('2026-08-31', SUN)).toBe(true) // last day still running
    expect(closeWeekStillRunning('2026-08-31', MON)).toBe(false) // ended yesterday
    expect(closeWeekStillRunning('2026-08-24', WED)).toBe(false)
  })
})

describe('resolveWeeklyMoneyReportWeek — the report opens on the close week', () => {
  it('lands on the previous complete close week when nothing pins it (menu opener, bare ?stagesMoney=1)', () => {
    expect(resolveWeeklyMoneyReportWeek(null, WED)).toBe('2026-08-24')
    expect(resolveWeeklyMoneyReportWeek(undefined, WED)).toBe('2026-08-24')
    expect(resolveWeeklyMoneyReportWeek('', WED)).toBe('2026-08-24')
    expect(resolveWeeklyMoneyReportWeek(null, MON)).toBe('2026-08-31')
  })

  it('a pinned week wins and is normalized to its Monday', () => {
    expect(resolveWeeklyMoneyReportWeek('2026-08-31', WED)).toBe('2026-08-31')
    expect(resolveWeeklyMoneyReportWeek('2026-08-13', WED)).toBe('2026-08-10')
  })

  it('a garbage pin falls back to the close week instead of this week', () => {
    expect(resolveWeeklyMoneyReportWeek('last week', WED)).toBe('2026-08-24')
    expect(resolveWeeklyMoneyReportWeek('2026-02-31', WED)).toBe('2026-08-24')
  })
})

describe('moneyfillHref / parseCloseWeekParam', () => {
  it('pins the picker to a week; a mid-week day keys its Monday', () => {
    expect(moneyfillHref('2026-08-24')).toBe('/moneyfill?week=2026-08-24')
    expect(moneyfillHref('2026-08-26')).toBe('/moneyfill?week=2026-08-24')
  })

  it('drops the companion when the week is garbage or missing', () => {
    expect(moneyfillHref(null)).toBe('/moneyfill')
    expect(moneyfillHref('nope')).toBe('/moneyfill')
    expect(parseCloseWeekParam(' 2026-09-06 ')).toBe('2026-08-31')
    expect(parseCloseWeekParam('2026-02-31')).toBeNull()
    expect(parseCloseWeekParam(undefined)).toBeNull()
  })
})
