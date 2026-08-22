import { describe, expect, it } from 'vitest'
import {
  assigneeListLabel,
  dailyFromScope,
  dayBeforeApplicable,
  reminderSummary,
  reminderTimeLabel,
  scopeFromDaily,
} from './checklistReminderOptions'

describe('scope mapping', () => {
  it('round-trips the checkbox', () => {
    expect(scopeFromDaily(true)).toBe('today_and_overdue')
    expect(scopeFromDaily(false)).toBe('today_only')
    expect(dailyFromScope('today_and_overdue')).toBe(true)
    expect(dailyFromScope('today_only')).toBe(false)
  })
  it('legacy empty scope reads as daily', () => {
    expect(dailyFromScope(null)).toBe(true)
    expect(dailyFromScope('')).toBe(true)
  })
})

describe('reminderTimeLabel', () => {
  it('formats 24h as 12h', () => {
    expect(reminderTimeLabel('07:00')).toBe('7:00 AM')
    expect(reminderTimeLabel('12:15')).toBe('12:15 PM')
    expect(reminderTimeLabel('16:00')).toBe('4:00 PM')
    expect(reminderTimeLabel('00:30')).toBe('12:30 AM')
  })
  it('echoes junk back', () => {
    expect(reminderTimeLabel('soon')).toBe('soon')
    expect(reminderTimeLabel('77:00')).toBe('77:00')
  })
})

describe('assigneeListLabel', () => {
  it('joins naturally up to three names', () => {
    expect(assigneeListLabel(['Michael A'])).toBe('Michael A')
    expect(assigneeListLabel(['Michael A', 'Bryan'])).toBe('Michael A & Bryan')
    expect(assigneeListLabel(['Michael A', 'Bryan', 'Wendi'])).toBe('Michael A, Bryan & Wendi')
    expect(assigneeListLabel(['a', 'b', 'c', 'd'])).toBe('4 people')
  })
  it('falls back when empty', () => {
    expect(assigneeListLabel([])).toBe('the assignees')
    expect(assigneeListLabel(['  '])).toBe('the assignees')
  })
})

describe('reminderSummary', () => {
  const base = { time: '07:00', dailyUntilDone: true, dayBefore: false, escalateAfterDays: null }
  it('is null without a time', () => {
    expect(reminderSummary({ ...base, time: '' }, ['A'])).toBeNull()
  })
  it('states the full plan', () => {
    expect(reminderSummary({ ...base, escalateAfterDays: 3 }, ['Michael A', 'Bryan'])).toBe(
      "Reminds Michael A & Bryan every day at 7:00 AM until it's done — and you after 3 days.",
    )
  })
  it('handles due-date-only, day-before, and singular day', () => {
    expect(reminderSummary({ time: '16:00', dailyUntilDone: false, dayBefore: true, escalateAfterDays: 1 }, ['Wendi'])).toBe(
      'Reminds Wendi on the due date at 4:00 PM, starting the day before — and you after 1 day.',
    )
  })
})

describe('dayBeforeApplicable', () => {
  it('always applies to repeats, never to plain today', () => {
    expect(dayBeforeApplicable('repeat', '', '2026-08-22')).toBe(true)
    expect(dayBeforeApplicable('today', '2026-08-22', '2026-08-22')).toBe(false)
  })
  it('applies to a dated task only when the date is ahead', () => {
    expect(dayBeforeApplicable('date', '2026-08-30', '2026-08-22')).toBe(true)
    expect(dayBeforeApplicable('date', '2026-08-22', '2026-08-22')).toBe(false)
  })
})
