import { describe, expect, it } from 'vitest'
import { assistantHoursWindowFloorYmd, clampHoursRangeToFloor } from './assistantHoursWindow'

describe('assistantHoursWindowFloorYmd', () => {
  it('weeks=3 mid-week → the Sunday two weeks before the current week', () => {
    // 2026-08-12 is a Wednesday; its week starts Sunday 2026-08-09.
    expect(assistantHoursWindowFloorYmd('2026-08-12', 3)).toBe('2026-07-26')
  })

  it('weeks=1 → the current week Sunday itself', () => {
    expect(assistantHoursWindowFloorYmd('2026-08-12', 1)).toBe('2026-08-09')
  })

  it('on a Sunday the current week starts that same day', () => {
    expect(assistantHoursWindowFloorYmd('2026-08-09', 3)).toBe('2026-07-26')
    expect(assistantHoursWindowFloorYmd('2026-08-09', 1)).toBe('2026-08-09')
  })

  it('on a Saturday still anchors to the preceding Sunday', () => {
    expect(assistantHoursWindowFloorYmd('2026-08-15', 1)).toBe('2026-08-09')
  })

  it('crosses month boundaries', () => {
    // 2026-08-01 is a Saturday; its week starts Sunday 2026-07-26.
    expect(assistantHoursWindowFloorYmd('2026-08-01', 2)).toBe('2026-07-19')
  })

  it('weeks<=0 or garbage → null (unlimited)', () => {
    expect(assistantHoursWindowFloorYmd('2026-08-12', 0)).toBeNull()
    expect(assistantHoursWindowFloorYmd('2026-08-12', -5)).toBeNull()
    expect(assistantHoursWindowFloorYmd('2026-08-12', Number.NaN)).toBeNull()
  })

  it('fractional weeks floor to whole weeks', () => {
    expect(assistantHoursWindowFloorYmd('2026-08-12', 3.9)).toBe('2026-07-26')
  })
})

describe('clampHoursRangeToFloor', () => {
  it('null floor leaves the range unchanged', () => {
    expect(clampHoursRangeToFloor('2020-01-01', '2020-01-07', null)).toEqual({
      start: '2020-01-01',
      end: '2020-01-07',
    })
  })

  it('range entirely at/after the floor is unchanged', () => {
    expect(clampHoursRangeToFloor('2026-08-09', '2026-08-15', '2026-07-26')).toEqual({
      start: '2026-08-09',
      end: '2026-08-15',
    })
  })

  it('start below the floor clamps to it, end untouched', () => {
    expect(clampHoursRangeToFloor('2026-07-01', '2026-08-15', '2026-07-26')).toEqual({
      start: '2026-07-26',
      end: '2026-08-15',
    })
  })

  it('range entirely below the floor collapses to the floor day', () => {
    expect(clampHoursRangeToFloor('2026-07-05', '2026-07-11', '2026-07-26')).toEqual({
      start: '2026-07-26',
      end: '2026-07-26',
    })
  })
})
