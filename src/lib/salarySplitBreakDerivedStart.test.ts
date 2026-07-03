import { describe, expect, it } from 'vitest'
import {
  breakMinutesBetweenAB,
  nearestValidSplitBreakMinute,
  segmentBStartFromBreak,
  validSplitBreakMinutesForAnchor,
} from './salarySplitBreakDerivedStart'

const TZ = 'America/Chicago'
const MONDAY = '2026-07-06'

describe('breakMinutesBetweenAB', () => {
  it('computes the gap between segment A end and segment B start', () => {
    // A: 08:00 + 240min → ends 12:00; B starts 12:30 → 30 min break
    expect(
      breakMinutesBetweenAB({
        segmentAStart: '08:00',
        segmentADurationMinutes: 240,
        segmentBStart: '12:30',
        timeZone: TZ,
        anchorWorkDateYmd: MONDAY,
      }),
    ).toBe(30)
  })

  it('rounds to 15-minute steps', () => {
    expect(
      breakMinutesBetweenAB({
        segmentAStart: '08:00',
        segmentADurationMinutes: 240,
        segmentBStart: '12:20',
        timeZone: TZ,
        anchorWorkDateYmd: MONDAY,
      }),
    ).toBe(15)
  })

  it('falls back to 30 when B starts before A ends (negative gap)', () => {
    expect(
      breakMinutesBetweenAB({
        segmentAStart: '08:00',
        segmentADurationMinutes: 240,
        segmentBStart: '11:00',
        timeZone: TZ,
        anchorWorkDateYmd: MONDAY,
      }),
    ).toBe(30)
  })

  it('clamps to 480 minutes', () => {
    // A ends 12:00; B at 21:00 → raw 540 → clamp 480
    expect(
      breakMinutesBetweenAB({
        segmentAStart: '08:00',
        segmentADurationMinutes: 240,
        segmentBStart: '21:00',
        timeZone: TZ,
        anchorWorkDateYmd: MONDAY,
      }),
    ).toBe(480)
  })
})

describe('segmentBStartFromBreak', () => {
  it('derives segment B local start from A end + break', () => {
    expect(
      segmentBStartFromBreak({
        segmentAStart: '08:00',
        segmentADurationMinutes: 240,
        breakMinutes: 30,
        timeZone: TZ,
        anchorWorkDateYmd: MONDAY,
      }),
    ).toBe('12:30')
  })

  it('rounds the break to 15-minute steps before deriving', () => {
    expect(
      segmentBStartFromBreak({
        segmentAStart: '08:00',
        segmentADurationMinutes: 240,
        breakMinutes: 20,
        timeZone: TZ,
        anchorWorkDateYmd: MONDAY,
      }),
    ).toBe('12:15')
  })

  it('returns null when the derived start crosses to the next civil date', () => {
    // A: 20:00 + 240min → ends at midnight (next date); any break lands off-anchor
    expect(
      segmentBStartFromBreak({
        segmentAStart: '20:00',
        segmentADurationMinutes: 240,
        breakMinutes: 0,
        timeZone: TZ,
        anchorWorkDateYmd: MONDAY,
      }),
    ).toBeNull()
  })
})

describe('validSplitBreakMinutesForAnchor', () => {
  it('lists every 15-minute break when the whole range stays on the anchor date', () => {
    // A ends 12:00 → 12:00..20:00 all on the same date → 33 options (0..480)
    const opts = validSplitBreakMinutesForAnchor({
      segmentAStart: '08:00',
      segmentADurationMinutes: 240,
      timeZone: TZ,
      anchorWorkDateYmd: MONDAY,
    })
    expect(opts).toHaveLength(33)
    expect(opts[0]).toBe(0)
    expect(opts[32]).toBe(480)
  })

  it('cuts off options that would land on the next civil date', () => {
    // A: 15:00 + 480min → ends 23:00 → only 0/15/30/45 keep B on the anchor date
    const opts = validSplitBreakMinutesForAnchor({
      segmentAStart: '15:00',
      segmentADurationMinutes: 480,
      timeZone: TZ,
      anchorWorkDateYmd: MONDAY,
    })
    expect(opts).toEqual([0, 15, 30, 45])
  })
})

describe('nearestValidSplitBreakMinute', () => {
  it('picks the closest option', () => {
    expect(nearestValidSplitBreakMinute(40, [0, 15, 30, 45])).toBe(45)
    expect(nearestValidSplitBreakMinute(100, [0, 15, 30, 45])).toBe(45)
  })

  it('prefers the earlier option on ties and returns null for empty options', () => {
    expect(nearestValidSplitBreakMinute(15, [0, 30])).toBe(0)
    expect(nearestValidSplitBreakMinute(30, [])).toBeNull()
  })
})
