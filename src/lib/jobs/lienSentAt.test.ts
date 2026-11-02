import { describe, expect, it } from 'vitest'
import { calendarYmdInAppTzFromIso, ymdDaysBetween } from '../../utils/dateUtils'
import { appTzNoonIso, earliestSendDay, sentAtForTypedDay } from './lienSentAt'

/** The typed mailing day as the desk item's `sent_at` (punch list #243, PR 2). */

describe('appTzNoonIso', () => {
  it('is noon in the app’s calendar on that day, in summer and in winter, and reads back as the same day', () => {
    expect(appTzNoonIso('2026-09-22')).toBe('2026-09-22T17:00:00.000Z')
    expect(appTzNoonIso('2026-12-10')).toBe('2026-12-10T18:00:00.000Z')
    for (const d of ['2026-09-22', '2026-11-01', '2026-11-02', '2026-12-10']) expect(calendarYmdInAppTzFromIso(appTzNoonIso(d)!)).toBe(d)
  })
  it('refuses what is not a day', () => {
    expect(appTzNoonIso('')).toBeNull()
    expect(appTzNoonIso('2026-9-22')).toBeNull()
    expect(appTzNoonIso('yesterday')).toBeNull()
  })
})

describe('sentAtForTypedDay', () => {
  it('a day before today is kept as noon of that day, and the clocks read the typed day', () => {
    const at = sentAtForTypedDay('2026-09-22', '2026-10-06')
    expect(at).toBe('2026-09-22T17:00:00.000Z')
    expect(calendarYmdInAppTzFromIso(at!)).toBe('2026-09-22')
    expect(ymdDaysBetween(calendarYmdInAppTzFromIso(at!), '2026-10-06')).toBe(14)
    // A notice recorded ten days back reads day 10 on every clock.
    const ten = sentAtForTypedDay('2026-10-23', '2026-11-02')!
    expect(ymdDaysBetween(calendarYmdInAppTzFromIso(ten), '2026-11-02')).toBe(10)
  })
  it('today, a day ahead, a blank and a non-day leave the stamp to the trigger', () => {
    expect(sentAtForTypedDay('2026-10-06', '2026-10-06')).toBeNull()
    expect(sentAtForTypedDay('2026-10-07', '2026-10-06')).toBeNull()
    expect(sentAtForTypedDay('', '2026-10-06')).toBeNull()
    expect(sentAtForTypedDay(null, '2026-10-06')).toBeNull()
    expect(sentAtForTypedDay(undefined, '2026-10-06')).toBeNull()
    expect(sentAtForTypedDay('last week', '2026-10-06')).toBeNull()
  })
})

describe('earliestSendDay', () => {
  it('is the first day any send names, whatever else rides with it; null when none does', () => {
    expect(earliestSendDay([{ recipient: 'owner', method: 'certified_mail', tracking: '9407', sent_on: '2026-10-14' }, { recipient: 'original_contractor', method: 'email', tracking: 'resend:1', sent_on: '2026-10-13' }])).toBe('2026-10-13')
    expect(earliestSendDay([{ sent_on: '2026-10-14', via: 'docsmit', piece_id: 'p1' }])).toBe('2026-10-14')
    expect(earliestSendDay([{ recipient: 'owner' }, { sent_on: 'soon' }])).toBeNull()
    expect(earliestSendDay([])).toBeNull()
    expect(earliestSendDay(null)).toBeNull()
    expect(earliestSendDay('2026-10-14')).toBeNull()
  })
})
