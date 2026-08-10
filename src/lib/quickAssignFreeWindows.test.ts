import { describe, expect, it } from 'vitest'
import {
  RIBBON_GUIDE_TICK_MINUTES,
  freeGapsForDay,
  intersectGapLists,
  mergeBusyIntervals,
  ribbonSpanPct,
  ribbonTickLeftPct,
  suggestCommonWindows,
  windowOverlapsBusy,
} from './quickAssignFreeWindows'

const I = (startMin: number, endMin: number) => ({ startMin, endMin })

describe('mergeBusyIntervals', () => {
  it('merges overlapping and touching intervals, drops invalid', () => {
    expect(
      mergeBusyIntervals([I(600, 720), I(480, 600), I(700, 780), I(900, 900), I(1000, 990)]),
    ).toEqual([I(480, 780)])
  })
})

describe('freeGapsForDay', () => {
  it('gaps around blocks within the 6a–6p day', () => {
    // busy 8–12 and 1–4 → free 6–8, 12–1, 4–6
    expect(freeGapsForDay([I(480, 720), I(780, 960)])).toEqual([
      I(360, 480),
      I(720, 780),
      I(960, 1080),
    ])
  })

  it('empty day = one full gap; fully booked = none', () => {
    expect(freeGapsForDay([])).toEqual([I(360, 1080)])
    expect(freeGapsForDay([I(300, 1100)])).toEqual([])
  })

  it('clamps blocks outside the day bounds', () => {
    expect(freeGapsForDay([I(0, 420)])).toEqual([I(420, 1080)])
  })
})

describe('intersectGapLists', () => {
  it('intersects across people', () => {
    const a = [I(360, 480), I(720, 1080)]
    const b = [I(420, 540), I(900, 1020)]
    expect(intersectGapLists([a, b])).toEqual([I(420, 480), I(900, 1020)])
  })

  it('empty input → empty; disjoint → empty', () => {
    expect(intersectGapLists([])).toEqual([])
    expect(intersectGapLists([[I(360, 400)], [I(500, 600)]])).toEqual([])
  })
})

describe('suggestCommonWindows', () => {
  it('ranks longest first, filters short windows, caps at limit', () => {
    // person A busy 8–12; person B busy 1–4 → common free: 6–8 (120m), 12–1 (60m), 4–6 (120m)
    const out = suggestCommonWindows([[I(480, 720)], [I(780, 960)]])
    expect(out).toEqual([I(360, 480), I(960, 1080), I(720, 780)])
  })

  it('drops sub-30-minute slivers', () => {
    const out = suggestCommonWindows([[I(360, 1060)]])
    expect(out).toEqual([]) // only 4:40–6:00... wait 1060→1080 is 20m — dropped
  })

  it('nobody selected → no suggestions', () => {
    expect(suggestCommonWindows([])).toEqual([])
  })
})

describe('windowOverlapsBusy', () => {
  it('detects overlap and respects boundaries', () => {
    expect(windowOverlapsBusy(I(600, 660), [I(480, 720)])).toBe(true)
    expect(windowOverlapsBusy(I(720, 780), [I(480, 720)])).toBe(false)
  })
})

describe('ribbonSpanPct', () => {
  it('maps intervals to percentages of the 6a–6p ribbon', () => {
    expect(ribbonSpanPct(I(360, 720))).toEqual({ leftPct: 0, widthPct: 50 })
    expect(ribbonSpanPct(I(1080, 1200))).toBeNull()
  })
})

describe('ribbonTickLeftPct', () => {
  it('places the 8a/12p/4p guide ticks on the 6a-6p ribbon', () => {
    const pcts = RIBBON_GUIDE_TICK_MINUTES.map((m) => ribbonTickLeftPct(m))
    expect(pcts[0]).toBeCloseTo(16.667, 2)
    expect(pcts[1]).toBeCloseTo(50, 5)
    expect(pcts[2]).toBeCloseTo(83.333, 2)
  })

  it('returns null at or beyond the ribbon edges', () => {
    expect(ribbonTickLeftPct(6 * 60)).toBeNull()
    expect(ribbonTickLeftPct(18 * 60)).toBeNull()
    expect(ribbonTickLeftPct(5 * 60)).toBeNull()
  })
})
