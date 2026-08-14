import { describe, expect, it } from 'vitest'
import { formatDaySheetDayLabel, hoursGridCellStatus } from './hoursGridDaySheet'

describe('hoursGridCellStatus', () => {
  it('missing-job wins over pending, matching the desktop tint precedence', () => {
    expect(hoursGridCellStatus({ pendingCount: 2, missingJob: true })).toEqual({ word: 'no job', tone: 'missing' })
    expect(hoursGridCellStatus({ pendingCount: 2, missingJob: false })).toEqual({ word: '2 pending', tone: 'pending' })
    expect(hoursGridCellStatus({ pendingCount: 0, missingJob: false })).toEqual({ word: null, tone: null })
  })
})

describe('formatDaySheetDayLabel', () => {
  it('formats weekday + month + day, appending the year only when not current', () => {
    expect(formatDaySheetDayLabel('2026-08-14', 2026)).toBe('Fri Aug 14')
    expect(formatDaySheetDayLabel('2025-12-31', 2026)).toBe('Wed Dec 31, 2025')
    expect(formatDaySheetDayLabel('garbage', 2026)).toBe('garbage')
  })
})
