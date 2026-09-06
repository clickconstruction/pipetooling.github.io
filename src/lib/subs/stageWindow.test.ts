import { describe, expect, it } from 'vitest'
import { dayInStageWindow, defaultStageWindow, endAfterWeekdays, nextWeekdayOnOrAfter, stageWindowByLabel, stageWindowLabel, stageWindowPhase, stageWindowProblem, stageWindowSpan, stageWindowWeekdays } from './stageWindow'

describe('stageWindow', () => {
  it('validates the span the office typed', () => {
    expect(stageWindowProblem('2026-09-08', '2026-09-19')).toBeNull()
    expect(stageWindowProblem('2026-09-08', '2026-09-08')).toBeNull()
    expect(stageWindowProblem('2026-09-19', '2026-09-08')).toBe('The end comes before the start')
    expect(stageWindowProblem('', '2026-09-08')).toBe('Pick both days')
    expect(stageWindowProblem('9/8/2026', '2026-09-08')).toBe('Pick both days')
  })

  it('counts weekdays and tests membership', () => {
    // Tue Sep 8 – Sat Sep 19 2026: 9 weekdays (Sep 8–11, 14–18)
    expect(stageWindowWeekdays({ start: '2026-09-08', end: '2026-09-19' })).toBe(9)
    expect(stageWindowWeekdays({ start: '2026-09-12', end: '2026-09-13' })).toBe(0)
    expect(dayInStageWindow('2026-09-08', { start: '2026-09-08', end: '2026-09-19' })).toBe(true)
    expect(dayInStageWindow('2026-09-20', { start: '2026-09-08', end: '2026-09-19' })).toBe(false)
  })

  it('reads a span off a row only when both ends are there', () => {
    expect(stageWindowSpan({ window_start: '2026-09-08', window_end: '2026-09-19' })).toEqual({ start: '2026-09-08', end: '2026-09-19' })
    expect(stageWindowSpan({ window_start: '2026-09-08', window_end: null })).toBeNull()
    expect(stageWindowSpan(null)).toBeNull()
  })

  it('labels the span and who set it', () => {
    expect(stageWindowLabel({ start: '2026-09-08', end: '2026-09-19' })).toBe('Sep 8 – Sep 19')
    expect(stageWindowLabel({ start: '2026-09-28', end: '2026-10-02' })).toBe('Sep 28 – Oct 2')
    expect(stageWindowLabel({ start: '2026-09-10', end: '2026-09-10' })).toBe('Sep 10')
    expect(stageWindowByLabel('office')).toBe('set by the office')
    expect(stageWindowByLabel('gc')).toBe('as the GC asked')
    expect(stageWindowByLabel(null)).toBe('set by the office')
  })

  it('phases a window against today', () => {
    const w = { start: '2026-09-08', end: '2026-09-19' }
    expect(stageWindowPhase(w, '2026-09-05')).toBe('ahead')
    expect(stageWindowPhase(w, '2026-09-08')).toBe('open')
    expect(stageWindowPhase(w, '2026-09-19')).toBe('open')
    expect(stageWindowPhase(w, '2026-09-20')).toBe('past')
  })

  it('never defaults onto a weekend', () => {
    expect(nextWeekdayOnOrAfter('2026-09-05')).toBe('2026-09-07') // Sat → Mon
    expect(nextWeekdayOnOrAfter('2026-09-06')).toBe('2026-09-07') // Sun → Mon
    expect(nextWeekdayOnOrAfter('2026-09-08')).toBe('2026-09-08')
    expect(endAfterWeekdays('2026-09-07', 2)).toBe('2026-09-08')
    expect(endAfterWeekdays('2026-09-11', 2)).toBe('2026-09-14') // Fri + 1 weekday = Mon
    expect(endAfterWeekdays('2026-09-07', 1)).toBe('2026-09-07')
    expect(defaultStageWindow('2026-09-05')).toEqual({ start: '2026-09-07', end: '2026-09-18' })
  })
})
