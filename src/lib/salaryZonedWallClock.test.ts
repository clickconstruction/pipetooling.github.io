import { APP_CALENDAR_TZ } from '../utils/dateUtils'
import { describe, expect, it } from 'vitest'
import { salaryPgTimeToHms, salaryZonedWallClockToUtcMs } from './salaryZonedWallClock'

const TZ = APP_CALENDAR_TZ
const utc = (iso: string) => new Date(iso).getTime()

describe('salaryPgTimeToHms', () => {
  it('parses HH:mm and HH:mm:ss', () => {
    expect(salaryPgTimeToHms('08:30')).toEqual({ h: 8, m: 30, s: 0 })
    expect(salaryPgTimeToHms('23:59:45')).toEqual({ h: 23, m: 59, s: 45 })
  })
})

describe('salaryZonedWallClockToUtcMs', () => {
  it('converts a morning Chicago wall time (CDT = UTC-5)', () => {
    expect(salaryZonedWallClockToUtcMs('2026-07-06', 8, 0, 0, TZ)).toBe(utc('2026-07-06T13:00:00Z'))
  })

  it('converts late-evening Chicago wall times (regression: scan range once ended at 20:00)', () => {
    expect(salaryZonedWallClockToUtcMs('2026-07-06', 21, 0, 0, TZ)).toBe(utc('2026-07-07T02:00:00Z'))
    expect(salaryZonedWallClockToUtcMs('2026-07-06', 23, 45, 0, TZ)).toBe(utc('2026-07-07T04:45:00Z'))
  })

  it('converts winter (CST = UTC-6) times', () => {
    expect(salaryZonedWallClockToUtcMs('2026-01-05', 8, 0, 0, TZ)).toBe(utc('2026-01-05T14:00:00Z'))
  })

  it('returns null for a wall time skipped by spring-forward', () => {
    // 2026-03-08 02:30 does not exist in America/Chicago
    expect(salaryZonedWallClockToUtcMs('2026-03-08', 2, 30, 0, TZ)).toBeNull()
  })

  it('returns null for malformed dates', () => {
    expect(salaryZonedWallClockToUtcMs('2026-7-6', 8, 0, 0, TZ)).toBeNull()
  })
})
