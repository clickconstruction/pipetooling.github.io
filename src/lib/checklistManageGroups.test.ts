import { describe, expect, it } from 'vitest'
import { isScheduledAhead, nextOccurrenceLabel, openAgeLabel, repeatChipLabel } from './checklistManageGroups'

describe('repeatChipLabel', () => {
  it('until completed wins', () => {
    expect(repeatChipLabel({ show_until_completed: true, repeat_type: 'day_of_week' })).toBe('until completed')
  })
  it('weekly days abbreviate; all seven collapses', () => {
    expect(repeatChipLabel({ repeat_type: 'day_of_week', repeat_days_of_week: [1, 3, 5] })).toBe('Mon Wed Fri')
    expect(repeatChipLabel({ repeat_type: 'day_of_week', repeat_days_of_week: [0, 1, 2, 3, 4, 5, 6] })).toBe('Every day')
    expect(repeatChipLabel({ repeat_type: 'day_of_week', repeat_days_of_week: [] })).toBe('weekly')
  })
  it('after-completion cadence', () => {
    expect(repeatChipLabel({ repeat_type: 'days_after_completion', repeat_days_after: 7 })).toBe('7 days after done')
    expect(repeatChipLabel({ repeat_type: 'days_after_completion', repeat_days_after: 1 })).toBe('1 day after done')
  })
  it('once fallback', () => {
    expect(repeatChipLabel({ repeat_type: 'once' })).toBe('once')
  })
})

describe('openAgeLabel', () => {
  it('formats ages and handles empty', () => {
    expect(openAgeLabel('2026-03-22', '2026-08-19')).toBe('open 150 days')
    expect(openAgeLabel('2026-08-18', '2026-08-19')).toBe('open 1 day')
    expect(openAgeLabel('2026-08-19', '2026-08-19')).toBe('open today')
    expect(openAgeLabel(undefined, '2026-08-19')).toBe('')
  })
  it('future dates say when the task starts, not "open today" (v2.2346)', () => {
    expect(openAgeLabel('2026-08-31', '2026-08-26')).toBe('starts Mon, Aug 31')
    expect(openAgeLabel('2026-08-27', '2026-08-26')).toBe('starts Thu, Aug 27')
  })
})

describe('isScheduledAhead', () => {
  it('true only for a strictly future earliest-open date', () => {
    expect(isScheduledAhead('2026-08-31', '2026-08-26')).toBe(true)
    expect(isScheduledAhead('2026-08-26', '2026-08-26')).toBe(false)
    expect(isScheduledAhead('2026-08-20', '2026-08-26')).toBe(false)
    expect(isScheduledAhead(undefined, '2026-08-26')).toBe(false)
  })
})

describe('nextOccurrenceLabel', () => {
  it('names the next day, says due today for today, empty when none', () => {
    expect(nextOccurrenceLabel('2026-08-24', '2026-08-21')).toBe('next Mon, Aug 24')
    expect(nextOccurrenceLabel('2026-08-21', '2026-08-21')).toBe('due today')
    expect(nextOccurrenceLabel(undefined, '2026-08-21')).toBe('')
  })
})
