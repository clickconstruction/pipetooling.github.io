import { describe, expect, it } from 'vitest'
import { todayYmdInAppTz as edgeTodayYmdInAppTz, ymdAddDays } from '../../supabase/functions/_shared/appTimeZone'
import { todayYmdInAppTz as appTodayYmdInAppTz } from '../utils/dateUtils'

/** The Edge twin of `todayYmdInAppTz` must give the same civil day as the app's, at every kind of instant. */
describe('_shared/appTimeZone parity with dateUtils (v2.2703)', () => {
  const instants = [
    '2026-09-03T15:00:00Z', // working hours
    '2026-09-04T01:30:00Z', // 8:30 PM CDT — UTC has rolled
    '2026-01-15T00:30:00Z', // 6:30 PM CST — UTC has rolled
    '2026-03-08T07:30:00Z', // spring-forward morning
    '2026-11-01T06:30:00Z', // fall-back morning
    '2026-12-31T23:59:59Z', // New Year's Eve evening, still Dec 31 in Chicago... it is 5:59 PM
  ]
  it.each(instants)('%s', (iso) => {
    const now = new Date(iso)
    expect(edgeTodayYmdInAppTz(now)).toBe(appTodayYmdInAppTz(now))
  })
  it('evening instants land on the Central date, not the UTC one', () => {
    expect(edgeTodayYmdInAppTz(new Date('2026-09-04T01:30:00Z'))).toBe('2026-09-03')
    expect(edgeTodayYmdInAppTz(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12-31')
  })
  it('ymdAddDays is pure civil arithmetic', () => {
    expect(ymdAddDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(ymdAddDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(ymdAddDays('2026-03-08', 7)).toBe('2026-03-15')
    expect(ymdAddDays('bad', 1)).toBe('')
  })
})
