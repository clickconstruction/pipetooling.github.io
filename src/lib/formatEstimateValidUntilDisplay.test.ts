import { describe, expect, it } from 'vitest'
import { formatValidUntilCompact, formatValidUntilForDisplay } from './formatEstimateValidUntilDisplay'

describe('formatValidUntilForDisplay', () => {
  it('shows weekday + short date, passes junk through', () => {
    expect(formatValidUntilForDisplay('2026-09-18')).toBe('Fri Sep 18, 2026')
    expect(formatValidUntilForDisplay('not-a-date')).toBe('not-a-date')
  })
})

describe('formatValidUntilCompact (v2.2780)', () => {
  it('drops the weekday so the accept page validity line fits one phone line', () => {
    expect(formatValidUntilCompact('2026-09-18')).toBe('Sep 18, 2026')
    expect(formatValidUntilCompact('not-a-date')).toBe('not-a-date')
  })
})
