/**
 * Send later (v2.6774, punch list #291 PR 4): the window's hours and the zone math the run shares, the default, the
 * fence, the fields, the chips, the words and the relative time. Times are Central (CST in November, UTC-6).
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { inSendWindow, nextWindowOpen, SEND_WINDOW_HELD, wallClockInAppTz, zonedTimeToMs } from '../../../supabase/functions/_shared/sendWindow'
import { dayAfterYmd, dayWord, defaultSendAt, fenceHm, fieldsOf, isPast, relativeWords, SEND_LATER_WORDS, sendAtFrom, sendLaterChips, shortWhen, TIME_FIELD } from './sendLater'

/** Monday 2026-11-09 3:32 PM Central. */
const NOW = Date.parse('2026-11-09T21:32:00Z')
/** Tuesday 2026-11-10 9:00 AM Central. */
const TUE_9 = Date.parse('2026-11-10T15:00:00Z')

describe('the window the run and the picker share', () => {
  it('names an instant’s wall clock in the app’s zone, and finds the instant a wall clock names, across the clock change', () => {
    expect(wallClockInAppTz(NOW)).toEqual({ ymd: '2026-11-09', hour: 15, minute: 32, weekday: 1 })
    expect(zonedTimeToMs('2026-11-10', 9, 0)).toBe(TUE_9)
    // Summer: 9:00 AM CDT is 14:00 UTC.
    expect(zonedTimeToMs('2026-07-10', 9, 0)).toBe(Date.parse('2026-07-10T14:00:00Z'))
    // The day the clocks fall back (2026-11-01): 9 AM CST is 15:00 UTC.
    expect(zonedTimeToMs('2026-11-01', 9, 0)).toBe(Date.parse('2026-11-01T15:00:00Z'))
  })
  it('opens at 8 AM and closes after 9:00 PM, Central', () => {
    expect(inSendWindow(zonedTimeToMs('2026-11-09', 7, 59))).toBe(false)
    expect(inSendWindow(zonedTimeToMs('2026-11-09', 8, 0))).toBe(true)
    expect(inSendWindow(zonedTimeToMs('2026-11-09', 21, 0))).toBe(true)
    expect(inSendWindow(zonedTimeToMs('2026-11-09', 21, 15))).toBe(false)
    expect(inSendWindow(zonedTimeToMs('2026-11-09', 23, 0))).toBe(false)
  })
  it('the next opening is 8 AM today before 8, else 8 AM tomorrow', () => {
    expect(nextWindowOpen(zonedTimeToMs('2026-11-09', 6, 30))).toBe(zonedTimeToMs('2026-11-09', 8, 0))
    expect(nextWindowOpen(zonedTimeToMs('2026-11-09', 22, 0))).toBe(zonedTimeToMs('2026-11-10', 8, 0))
    expect(nextWindowOpen(NOW)).toBe(zonedTimeToMs('2026-11-10', 8, 0))
    expect(plainWordsFailures(SEND_WINDOW_HELD)).toEqual([])
  })
})

describe('the default and the fence', () => {
  it('defaults to today 9 AM before 9, else tomorrow 9 AM, as the morning run’s day', () => {
    expect(defaultSendAt(zonedTimeToMs('2026-11-09', 7, 10))).toBe(zonedTimeToMs('2026-11-09', 9, 0))
    expect(defaultSendAt(zonedTimeToMs('2026-11-09', 9, 0))).toBe(TUE_9)
    expect(defaultSendAt(NOW)).toBe(TUE_9)
  })
  it('fences a time to 8:00 through 21:00 in quarter hours', () => {
    expect(fenceHm('07:30')).toBe('08:00')
    expect(fenceHm('21:30')).toBe('21:00')
    expect(fenceHm('13:07')).toBe('13:00')
    expect(fenceHm('13:08')).toBe('13:15')
    expect(fenceHm('18:00')).toBe('18:00')
    expect(fenceHm('')).toBe('09:00')
    expect(TIME_FIELD).toEqual({ min: '08:00', max: '21:00', step: 900 })
  })
  it('the fields and the instant round-trip, and a bad day is null', () => {
    expect(fieldsOf(TUE_9)).toEqual({ ymd: '2026-11-10', time: '09:00' })
    expect(sendAtFrom('2026-11-10', '09:00')).toBe(TUE_9)
    expect(sendAtFrom('2026-11-10', '07:00')).toBe(zonedTimeToMs('2026-11-10', 8, 0))
    expect(sendAtFrom('tomorrow', '09:00')).toBeNull()
    expect(dayAfterYmd('2026-11-30')).toBe('2026-12-01')
  })
  it('a moment in the past, or inside the next minute, is past', () => {
    expect(isPast(NOW - 1, NOW)).toBe(true)
    expect(isPast(NOW + 30_000, NOW)).toBe(true)
    expect(isPast(NOW + 5 * 60_000, NOW)).toBe(false)
  })
})

describe('the chips and the words', () => {
  it('offers Now, Tomorrow 9:00 AM and Today 6:00 PM while 6 PM is ahead', () => {
    expect(sendLaterChips(NOW).map((c) => c.label)).toEqual(['Now', 'Tomorrow 9:00 AM', 'Today 6:00 PM'])
    expect(sendLaterChips(NOW)[1]?.atMs).toBe(TUE_9)
    expect(sendLaterChips(zonedTimeToMs('2026-11-09', 19, 0)).map((c) => c.label)).toEqual(['Now', 'Tomorrow 9:00 AM'])
  })
  it('names a moment short, long, with its distance, and the press after it', () => {
    expect(shortWhen(TUE_9, NOW)).toBe('Tomorrow 9:00 AM')
    expect(shortWhen(zonedTimeToMs('2026-11-09', 18, 0), NOW)).toBe('Today 6:00 PM')
    expect(shortWhen(zonedTimeToMs('2026-11-12', 9, 0), NOW)).toBe('Thu 9:00 AM')
    expect(shortWhen(zonedTimeToMs('2026-11-24', 9, 0), NOW)).toBe('Nov 24 9:00 AM')
    expect(dayWord(TUE_9, NOW)).toBe('tomorrow')
    expect(relativeWords(TUE_9, NOW)).toBe('about 17 hours')
    expect(relativeWords(NOW + 40 * 60_000, NOW)).toBe('about 40 minutes')
    expect(relativeWords(NOW + 3 * 86_400_000, NOW)).toBe('about 3 days')
    expect(SEND_LATER_WORDS.press(TUE_9, NOW)).toBe('Send later · Tomorrow 9:00 AM')
    expect(SEND_LATER_WORDS.goes(TUE_9, NOW)).toBe('Goes Tuesday, Nov 10 at 9:00 AM Central, in about 17 hours.')
    expect(SEND_LATER_WORDS.send(TUE_9, NOW)).toBe('Send tomorrow 9:00 AM')
    expect(SEND_LATER_WORDS.send(zonedTimeToMs('2026-11-12', 9, 0), NOW)).toBe('Send Thursday 9:00 AM')
    expect(SEND_LATER_WORDS.readyLine(TUE_9)).toBe('Goes Tuesday, Nov 10 at 9:00 AM Central from the company number.')
    expect(SEND_LATER_WORDS.rowGoes(TUE_9, NOW)).toBe('Goes Tomorrow 9:00 AM')
    expect(SEND_LATER_WORDS.toast(TUE_9, NOW)).toBe('It goes Tomorrow 9:00 AM from the company number.')
  })
  it('reads plain', () => {
    for (const w of [SEND_LATER_WORDS.goes(TUE_9, NOW), SEND_LATER_WORDS.fence, SEND_LATER_WORDS.where, SEND_LATER_WORDS.past, SEND_LATER_WORDS.readyLine(TUE_9), SEND_LATER_WORDS.subtitle('Dana'), SEND_LATER_WORDS.toast(TUE_9, NOW)]) expect(plainWordsFailures(w), w).toEqual([])
  })
})
