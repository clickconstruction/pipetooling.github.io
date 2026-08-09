import { describe, expect, it } from 'vitest'
import {
  isUnlinkedMercuryRowStaleForTallyStaffFollowUp,
  unlinkedMercuryRowCalendarAgeDays,
} from './tallyStaleMinAgeDays'

// Noon UTC on Aug 9 2026 = Aug 9 in America/Chicago.
const NOW_MS = Date.parse('2026-08-09T12:00:00Z')

describe('unlinkedMercuryRowCalendarAgeDays', () => {
  it('returns whole calendar-day spans in the app timezone', () => {
    expect(unlinkedMercuryRowCalendarAgeDays('2026-08-09T12:00:00Z', NOW_MS)).toBe(0)
    expect(unlinkedMercuryRowCalendarAgeDays('2026-08-07T12:00:00Z', NOW_MS)).toBe(2)
    expect(unlinkedMercuryRowCalendarAgeDays('2026-08-05T12:00:00Z', NOW_MS)).toBe(4)
  })

  it('counts civil dates, not 24h windows: late-evening Chicago post is 1 day old the next morning', () => {
    // 2026-08-09T03:30:00Z = Aug 8, 10:30 PM in Chicago.
    expect(unlinkedMercuryRowCalendarAgeDays('2026-08-09T03:30:00Z', NOW_MS)).toBe(1)
  })

  it('returns null for null, empty, or unparsable input', () => {
    expect(unlinkedMercuryRowCalendarAgeDays(null, NOW_MS)).toBeNull()
    expect(unlinkedMercuryRowCalendarAgeDays('', NOW_MS)).toBeNull()
    expect(unlinkedMercuryRowCalendarAgeDays('not-a-date', NOW_MS)).toBeNull()
  })
})

describe('isUnlinkedMercuryRowStaleForTallyStaffFollowUp', () => {
  it('is stale strictly beyond minAgeDays and agrees with the age helper', () => {
    expect(isUnlinkedMercuryRowStaleForTallyStaffFollowUp('2026-08-07T12:00:00Z', 2, NOW_MS)).toBe(false)
    expect(isUnlinkedMercuryRowStaleForTallyStaffFollowUp('2026-08-06T12:00:00Z', 2, NOW_MS)).toBe(true)
  })
})
