import { describe, expect, it } from 'vitest'
import { daysPillPrefix, stageCardPills, wordCount } from './stageCardPills'

describe('wordCount', () => {
  it('counts runs of non-blank characters', () => {
    expect(wordCount('call the owner first')).toBe(4)
    expect(wordCount('  two   words \n')).toBe(2)
    expect(wordCount('one')).toBe(1)
    expect(wordCount('line one\nline two\ttabbed')).toBe(5)
  })

  it('is 0 for blank or no text', () => {
    expect(wordCount('')).toBe(0)
    expect(wordCount('   \n ')).toBe(0)
    expect(wordCount(null)).toBe(0)
    expect(wordCount(undefined)).toBe(0)
  })
})

describe('daysPillPrefix', () => {
  it('says day for one and days for the rest, zero included', () => {
    expect(daysPillPrefix(1)).toBe('[1 day] ')
    expect(daysPillPrefix(3)).toBe('[3 days] ')
    expect(daysPillPrefix(0)).toBe('[0 days] ')
  })

  it('is blank for no count', () => {
    expect(daysPillPrefix(null)).toBe('')
  })
})

describe('stageCardPills', () => {
  const now = new Date('2026-09-10T12:00:00Z')
  const base = {
    status: 'pending',
    started_at: null,
    ended_at: null,
    notes: null,
    private_notes: null,
    scheduled_start_date: null,
    scheduled_end_date: null,
  }

  it('is all zeros and blanks for an untouched step', () => {
    expect(stageCardPills(base, [], now)).toEqual({
      days: null,
      daysPrefix: '',
      itemCount: 0,
      itemsTotal: 0,
      notesWords: 0,
      privateWords: 0,
      hasExpected: false,
    })
  })

  it('counts a step in progress up to now', () => {
    const pills = stageCardPills({ ...base, status: 'in_progress', started_at: '2026-09-07T12:00:00Z' }, [], now)
    expect(pills.days).toBe(3)
    expect(pills.daysPrefix).toBe('[3 days] ')
  })

  it('counts a finished step from its start to its end', () => {
    const pills = stageCardPills(
      { ...base, status: 'completed', started_at: '2026-09-01T12:00:00Z', ended_at: '2026-09-02T12:00:00Z' },
      [],
      now,
    )
    expect(pills.daysPrefix).toBe('[1 day] ')
  })

  it('has no day count for a step in progress that already carries an end', () => {
    const pills = stageCardPills(
      { ...base, status: 'in_progress', started_at: '2026-09-01T12:00:00Z', ended_at: '2026-09-02T12:00:00Z' },
      [],
      now,
    )
    expect(pills.days).toBeNull()
    expect(pills.daysPrefix).toBe('')
  })

  it('has no day count for a started step that is not in progress and has no end', () => {
    expect(stageCardPills({ ...base, status: 'rejected', started_at: '2026-09-01T12:00:00Z' }, [], now).days).toBeNull()
  })

  it('counts the line items and adds them up, a null as 0 and a credit as a negative', () => {
    const pills = stageCardPills(base, [{ amount: 1200.5 }, { amount: null }, { amount: -200 }], now)
    expect(pills.itemCount).toBe(3)
    expect(pills.itemsTotal).toBe(1000.5)
  })

  it('counts the words of each note', () => {
    const pills = stageCardPills({ ...base, notes: 'call the owner first', private_notes: ' owes us ' }, [], now)
    expect(pills.notesWords).toBe(4)
    expect(pills.privateWords).toBe(2)
  })

  it('shows the expected pill when either date is set', () => {
    expect(stageCardPills({ ...base, scheduled_start_date: '2026-09-07' }, [], now).hasExpected).toBe(true)
    expect(stageCardPills({ ...base, scheduled_end_date: '2026-09-07' }, [], now).hasExpected).toBe(true)
    expect(stageCardPills({ ...base, scheduled_start_date: '' }, [], now).hasExpected).toBe(false)
  })
})
