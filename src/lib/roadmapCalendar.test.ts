import { describe, expect, it } from 'vitest'
import { bandFraction, calendarBand, observedPace, paceLabel, monthLabelStride } from './roadmapCalendar'

const NOW = new Date('2026-08-22T12:00:00')
const done = (iso: string) => ({ completed_at: iso })
const open = () => ({ completed_at: null })

describe('observedPace', () => {
  it('returns null when nothing was ever completed', () => {
    expect(observedPace([open(), open()], NOW)).toBeNull()
  })

  it('uses the 4-week window when it has completions', () => {
    const tasks = [done('2026-08-20T00:00:00'), done('2026-08-10T00:00:00'), done('2026-08-01T00:00:00'), open()]
    const pace = observedPace(tasks, NOW)
    expect(pace).toEqual({ tasksPerWeek: 3 / 4, basis: 'recent' })
  })

  it('falls back to all-time pace when the window is empty', () => {
    // 2 completions, the first ~10 weeks ago → ~0.2/week
    const tasks = [done('2026-06-13T12:00:00'), done('2026-06-20T12:00:00'), open()]
    const pace = observedPace(tasks, NOW)
    expect(pace?.basis).toBe('allTime')
    expect(pace?.tasksPerWeek).toBeCloseTo(0.2, 5)
  })

  it('ignores malformed and future stamps', () => {
    expect(observedPace([done('not-a-date'), done('2027-01-01T00:00:00')], NOW)).toBeNull()
  })
})

describe('paceLabel', () => {
  it('rounds to one decimal, no trailing .0', () => {
    expect(paceLabel(7)).toBe('7')
    expect(paceLabel(3 / 4)).toBe('0.8')
    expect(paceLabel(2.449)).toBe('2.4')
  })
})

describe('calendarBand', () => {
  const wave = (finishIso: string, remaining: number) => ({ finish: new Date(finishIso), remainingTasks: remaining })

  it('lays months from the current month through the goal month', () => {
    const band = calendarBand([wave('2026-10-15T00:00:00', 88)], NOW)
    expect(band.months.map((m) => m.label)).toEqual(['Aug', 'Sep', 'Oct'])
    expect(band.months[0]!.left).toBe(0)
    expect(band.months.reduce((a, m) => a + m.width, 0)).toBeCloseTo(1, 5)
    expect(band.goal?.label).toBe('≈ Oct')
    expect(band.goal?.clamped).toBe(false)
    expect(band.todayLeft).toBeGreaterThan(0.2)
    expect(band.todayLeft).toBeLessThan(band.goal!.left)
    expect(band.runway).toEqual({ left: band.todayLeft, width: band.goal!.left - band.todayLeft })
  })

  it('keeps at least 3 months and labels next-year months with the year', () => {
    const nearGoal = calendarBand([wave('2026-08-25T00:00:00', 2)], NOW)
    expect(nearGoal.months).toHaveLength(3)
    const winter = calendarBand([wave('2027-01-10T00:00:00', 40)], new Date('2026-11-05T00:00:00'))
    expect(winter.months.map((m) => m.label)).toEqual(['Nov', 'Dec', "Jan '27"])
  })

  it('pins a far goal to the right edge instead of squeezing months', () => {
    const band = calendarBand([wave('2028-03-01T00:00:00', 500)], NOW)
    expect(band.months).toHaveLength(12)
    expect(band.goal?.clamped).toBe(true)
    expect(band.goal?.left).toBe(0.98)
    expect(band.goal?.label).toBe("≈ Mar '28")
  })

  it('has no goal or runway without a projection, but today still renders', () => {
    const band = calendarBand([], NOW)
    expect(band.goal).toBeNull()
    expect(band.runway).toBeNull()
    expect(band.months).toHaveLength(3)
    expect(band.todayLeft).toBeGreaterThan(0)
  })

  it('exposes the horizon so extra dates can be placed on the band', () => {
    const band = calendarBand([wave('2026-10-15T00:00:00', 88)], NOW)
    expect(band.horizonStart).toEqual(new Date(2026, 7, 1))
    expect(band.horizonEnd).toEqual(new Date(2026, 10, 1))
    expect(bandFraction(band, new Date(2026, 7, 1))).toBe(0)
    expect(bandFraction(band, new Date(2026, 8, 16))).toBeCloseTo(0.5, 1)
    expect(bandFraction(band, new Date(2027, 5, 1))).toBe(1) // beyond the horizon clamps
  })

  it('marks intermediate waves only when they are far enough from today, each other, and the goal', () => {
    const spread = calendarBand(
      [wave('2026-09-15T00:00:00', 30), wave('2026-10-20T00:00:00', 20), wave('2026-11-25T00:00:00', 10), wave('2026-12-20T00:00:00', 5)],
      NOW,
    )
    expect(spread.markers.map((m) => m.index)).toEqual([1, 2])
    // all waves finishing together (empty later waves) → markers collapse into the goal flag
    const collapsed = calendarBand(
      [wave('2026-10-15T00:00:00', 88), wave('2026-10-15T00:00:00', 0), wave('2026-10-15T00:00:00', 0), wave('2026-10-15T00:00:00', 0)],
      NOW,
    )
    expect(collapsed.markers).toEqual([])
  })
})

describe('monthLabelStride', () => {
  it('labels every month when each month is wide enough', () => {
    expect(monthLabelStride(1100, 1 / 12)).toBe(1)
    expect(monthLabelStride(330, 1 / 3)).toBe(1)
  })
  it('thins to every 2nd (then 3rd) month as the band narrows', () => {
    expect(monthLabelStride(330, 1 / 12)).toBe(2) // 27.5px months → 44/27.5 → 2
    expect(monthLabelStride(200, 1 / 12)).toBe(3) // 16.7px months → 3
  })
  it('is 1 while unmeasured or degenerate', () => {
    expect(monthLabelStride(0, 1 / 12)).toBe(1)
    expect(monthLabelStride(330, 0)).toBe(1)
  })
})
