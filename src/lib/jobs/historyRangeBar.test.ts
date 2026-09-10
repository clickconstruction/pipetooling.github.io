import { describe, expect, it } from 'vitest'
import { formatRangeDate, presetRange, rangeCaption, rangeDateParts, rangePreset } from './historyRangeBar'

const TODAY = '2026-09-10'

describe('history range bar kernel', () => {
  it('presets are today − N through today, and are recognised back', () => {
    expect(presetRange(180, TODAY)).toEqual({ start: '2026-03-14', end: TODAY })
    expect(rangePreset('2026-03-14', TODAY, TODAY)).toBe(180)
    expect(rangePreset('2026-06-12', TODAY, TODAY)).toBe(90)
    expect(rangePreset('2025-09-10', TODAY, TODAY)).toBe(365)
    expect(rangePreset('2026-03-14', '2026-09-09', TODAY)).toBeNull() // not ending today
    expect(rangePreset('2026-03-15', TODAY, TODAY)).toBeNull() // off by a day = custom
  })

  it('dates carry the year only when it is not this year, as two digits', () => {
    expect(formatRangeDate('2026-03-14', TODAY)).toBe('Mar 14')
    expect(formatRangeDate('2025-11-03', TODAY)).toBe('Nov 3, 25')
    expect(rangeDateParts('2025-11-03', TODAY, TODAY)).toEqual({ from: 'Nov 3, 25', to: 'Sep 10' })
  })

  it('caption names the preset, else the day count; people wording; nothing worked', () => {
    expect(rangeCaption({ start: '2026-03-14', end: TODAY, todayYmd: TODAY, daysWorked: 142, maxPeople: 9 })).toBe('last 180 days · 142 worked · up to 9 people')
    expect(rangeCaption({ start: '2025-11-03', end: TODAY, todayYmd: TODAY, daysWorked: 168, maxPeople: 9 })).toBe('312 days · 168 worked · up to 9 people')
    expect(rangeCaption({ start: '2026-03-14', end: TODAY, todayYmd: TODAY, daysWorked: 1, maxPeople: 1 })).toBe('last 180 days · 1 worked · 1 person')
    expect(rangeCaption({ start: '2026-03-14', end: TODAY, todayYmd: TODAY, daysWorked: 0, maxPeople: 0 })).toBe('last 180 days · no days worked')
  })
})
