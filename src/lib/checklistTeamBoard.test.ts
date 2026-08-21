import { describe, expect, it } from 'vitest'
import {
  BOARD_RANGE_LABELS,
  ageChipLabel,
  ageSeverity,
  initialsFor,
  oldestAgeDays,
} from './checklistTeamBoard'

describe('initialsFor', () => {
  it('first + last word initials, uppercased', () => {
    expect(initialsFor('Michael A')).toBe('MA')
    expect(initialsFor('Taunya')).toBe('T')
    expect(initialsFor('Mary Jo Roberts')).toBe('MR')
    expect(initialsFor('')).toBe('?')
    expect(initialsFor(null)).toBe('?')
  })
})

describe('oldestAgeDays', () => {
  const TODAY = '2026-08-19'
  it('picks the oldest', () => {
    expect(
      oldestAgeDays([{ scheduled_date: '2026-08-18' }, { scheduled_date: '2026-03-19' }], TODAY),
    ).toBe(153)
  })
  it('0 for empty or future-only', () => {
    expect(oldestAgeDays([], TODAY)).toBe(0)
    expect(oldestAgeDays([{ scheduled_date: '2026-08-25' }], TODAY)).toBe(0)
  })
})

describe('ageChipLabel', () => {
  it('past days get a chip, today/future none', () => {
    expect(ageChipLabel('2026-07-30', '2026-08-19')).toBe('20d')
    expect(ageChipLabel('2026-08-19', '2026-08-19')).toBe('')
    expect(ageChipLabel('2026-08-25', '2026-08-19')).toBe('')
  })
})

describe('ageSeverity', () => {
  it('under a week is ok, to a month is warn, past a month is late', () => {
    expect(ageSeverity(0)).toBe('ok')
    expect(ageSeverity(6)).toBe('ok')
    expect(ageSeverity(7)).toBe('warn')
    expect(ageSeverity(30)).toBe('warn')
    expect(ageSeverity(31)).toBe('late')
    expect(ageSeverity(116)).toBe('late')
  })
})

describe('labels', () => {
  it('non_repeating reads One-offs', () => {
    expect(BOARD_RANGE_LABELS.non_repeating).toBe('One-offs')
  })
})
