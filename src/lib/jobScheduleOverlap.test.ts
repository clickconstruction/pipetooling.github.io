import { describe, expect, it } from 'vitest'
import {
  JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES,
  scheduleBlockToRange,
  scheduleHasInternalOverlap,
  scheduleOverlapsAny,
  scheduleRangesOverlap,
  scheduleTimeToMinutesFromMidnight,
  validateJobScheduleBlockMinuteRange,
} from './jobScheduleOverlap'

const WALL = { minWallMin: 4 * 60, maxWallMin: 20 * 60 } // 4:00 AM – 8:00 PM

describe('validateJobScheduleBlockMinuteRange', () => {
  it('accepts a 30-minute block inside the wall', () => {
    expect(validateJobScheduleBlockMinuteRange({ startMin: 8 * 60, endMin: 8 * 60 + 30, ...WALL })).toBeNull()
    expect(JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES).toBe(30)
  })
  it('rejects an end at or before the start', () => {
    expect(validateJobScheduleBlockMinuteRange({ startMin: 600, endMin: 600, ...WALL })).toBe('End time must be after start time.')
    expect(validateJobScheduleBlockMinuteRange({ startMin: 600, endMin: 540, ...WALL })).toBe('End time must be after start time.')
  })
  it('rejects anything outside the wall, at either edge', () => {
    const msg = 'Times must stay between 4:00 AM and 8:00 PM Central.'
    expect(validateJobScheduleBlockMinuteRange({ startMin: 3 * 60 + 59, endMin: 8 * 60, ...WALL })).toBe(msg)
    expect(validateJobScheduleBlockMinuteRange({ startMin: 19 * 60, endMin: 20 * 60 + 1, ...WALL })).toBe(msg)
    expect(validateJobScheduleBlockMinuteRange({ startMin: 4 * 60, endMin: 20 * 60, ...WALL })).toBeNull()
  })
  it('rejects a block shorter than 30 minutes', () => {
    expect(validateJobScheduleBlockMinuteRange({ startMin: 600, endMin: 629, ...WALL })).toBe('Blocks must be at least 30 minutes.')
  })
})

describe('scheduleTimeToMinutesFromMidnight', () => {
  it('reads HH:MM and HH:MM:SS Postgres times', () => {
    expect(scheduleTimeToMinutesFromMidnight('08:30')).toBe(510)
    expect(scheduleTimeToMinutesFromMidnight('08:30:00')).toBe(510)
    expect(scheduleTimeToMinutesFromMidnight(' 17:05:59 ')).toBe(17 * 60 + 5)
    expect(scheduleTimeToMinutesFromMidnight('00:00')).toBe(0)
  })
  it('falls back to 0 for garbage rather than NaN', () => {
    expect(scheduleTimeToMinutesFromMidnight('noon')).toBe(0)
    expect(scheduleTimeToMinutesFromMidnight('')).toBe(0)
  })
})

describe('scheduleRangesOverlap', () => {
  it('is true only when the ranges share time; touching edges do not overlap', () => {
    expect(scheduleRangesOverlap({ startMin: 60, endMin: 120 }, { startMin: 90, endMin: 150 })).toBe(true)
    expect(scheduleRangesOverlap({ startMin: 90, endMin: 150 }, { startMin: 60, endMin: 120 })).toBe(true)
    expect(scheduleRangesOverlap({ startMin: 60, endMin: 120 }, { startMin: 120, endMin: 180 })).toBe(false)
    expect(scheduleRangesOverlap({ startMin: 60, endMin: 120 }, { startMin: 70, endMin: 80 })).toBe(true) // containment
  })
})

describe('scheduleBlockToRange / scheduleHasInternalOverlap / scheduleOverlapsAny', () => {
  it('converts a block to minutes', () => {
    expect(scheduleBlockToRange('07:00:00', '11:30:00')).toEqual({ startMin: 420, endMin: 690 })
  })

  it('finds an overlap anywhere in a day list, and none when blocks abut', () => {
    expect(
      scheduleHasInternalOverlap([
        { time_start: '07:00', time_end: '09:00' },
        { time_start: '09:00', time_end: '11:00' },
        { time_start: '13:00', time_end: '15:00' },
      ]),
    ).toBe(false)
    expect(
      scheduleHasInternalOverlap([
        { time_start: '07:00', time_end: '09:00' },
        { time_start: '13:00', time_end: '15:00' },
        { time_start: '14:30', time_end: '16:00' },
      ]),
    ).toBe(true)
    expect(scheduleHasInternalOverlap([])).toBe(false)
  })

  it('checks a candidate against existing blocks, ignoring the ones being edited', () => {
    const existing = [
      { id: 'a', time_start: '07:00', time_end: '09:00' },
      { id: 'b', time_start: '13:00', time_end: '15:00' },
    ]
    const candidate = { startMin: 8 * 60, endMin: 8 * 60 + 30 }
    expect(scheduleOverlapsAny(candidate, existing)).toBe(true)
    expect(scheduleOverlapsAny(candidate, existing, ['a'])).toBe(false) // re-saving block a itself
    expect(scheduleOverlapsAny({ startMin: 9 * 60, endMin: 13 * 60 }, existing)).toBe(false) // fills the gap exactly
    expect(scheduleOverlapsAny(candidate, [{ time_start: '07:00', time_end: '09:00' }], ['a'])).toBe(true) // no id → cannot be excluded
  })
})
