import { describe, expect, it } from 'vitest'
import { endOfYmdInAppTzMs, startOfYmdInAppTzMs, todayYmdInAppTz } from './dateUtils'

/**
 * v2.2703 — the before/after measurement for the civil-date sweep, kept as tests.
 * Three instants: a working-hours one where UTC and Central agree, and two evening ones
 * (summer and winter) where the UTC calendar has already rolled to tomorrow.
 */
const INSTANTS = [
  { iso: '2026-09-03T15:00:00Z', label: '10:00 AM CDT', legacy: '2026-09-03', civil: '2026-09-03' },
  { iso: '2026-09-04T01:30:00Z', label: '8:30 PM CDT Sep 3', legacy: '2026-09-04', civil: '2026-09-03' },
  { iso: '2026-01-15T00:30:00Z', label: '6:30 PM CST Jan 14', legacy: '2026-01-15', civil: '2026-01-14' },
] as const

describe('todayYmdInAppTz', () => {
  it.each(INSTANTS)('$label → $civil (the UTC slice would say $legacy)', ({ iso, legacy, civil }) => {
    const now = new Date(iso)
    expect(now.toISOString().slice(0, 10)).toBe(legacy) // the pattern the sweep removed
    expect(todayYmdInAppTz(now)).toBe(civil)
  })

  it('agrees with the UTC slice during working hours and disagrees only in the evening window', () => {
    const agree = INSTANTS.filter((i) => i.legacy === i.civil).map((i) => i.label)
    const differ = INSTANTS.filter((i) => i.legacy !== i.civil).map((i) => i.label)
    expect(agree).toEqual(['10:00 AM CDT'])
    expect(differ).toEqual(['8:30 PM CDT Sep 3', '6:30 PM CST Jan 14'])
  })
})

describe('start/end of a civil day in the app zone', () => {
  it('summer day (CDT, UTC−5)', () => {
    expect(new Date(startOfYmdInAppTzMs('2026-09-03')).toISOString()).toBe('2026-09-03T05:00:00.000Z')
    expect(new Date(endOfYmdInAppTzMs('2026-09-03')).toISOString()).toBe('2026-09-04T04:59:59.999Z')
  })
  it('winter day (CST, UTC−6)', () => {
    expect(new Date(startOfYmdInAppTzMs('2026-01-15')).toISOString()).toBe('2026-01-15T06:00:00.000Z')
    expect(new Date(endOfYmdInAppTzMs('2026-01-15')).toISOString()).toBe('2026-01-16T05:59:59.999Z')
  })
  it('DST switch days: spring-forward day is 23h, fall-back day is 25h', () => {
    expect(endOfYmdInAppTzMs('2026-03-08') - startOfYmdInAppTzMs('2026-03-08') + 1).toBe(23 * 3_600_000)
    expect(endOfYmdInAppTzMs('2026-11-01') - startOfYmdInAppTzMs('2026-11-01') + 1).toBe(25 * 3_600_000)
    expect(new Date(endOfYmdInAppTzMs('2026-03-08')).toISOString()).toBe('2026-03-09T04:59:59.999Z')
    expect(new Date(endOfYmdInAppTzMs('2026-11-01')).toISOString()).toBe('2026-11-02T05:59:59.999Z')
  })
  it('the old T23:59:59.999Z end-of-day was 5–6 hours early', () => {
    const legacy = new Date('2026-09-03T23:59:59.999Z').getTime()
    expect(endOfYmdInAppTzMs('2026-09-03') - legacy).toBe(5 * 3_600_000)
  })
  it('malformed input → NaN, never a wrong date', () => {
    expect(startOfYmdInAppTzMs('nope')).toBeNaN()
    expect(endOfYmdInAppTzMs('2026-9-3')).toBeNaN()
  })
})
