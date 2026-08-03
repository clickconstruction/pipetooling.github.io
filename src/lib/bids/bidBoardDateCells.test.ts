import { describe, it, expect } from 'vitest'
import { bidBoardDueCellParts, bidBoardLastContactParts } from './bidBoardDateCells'

// Mock "today": Monday 2026-08-03 (mid-afternoon to catch midnight-normalization bugs).
const TODAY = new Date('2026-08-03T15:30:00')

describe('bidBoardDueCellParts', () => {
  it('renders weekday + M/D with (+N) for past-due dates and flags overdue', () => {
    const p = bidBoardDueCellParts('2026-07-30', TODAY)
    expect(p).toEqual({ dateLabel: 'Thu 7/30', deltaDays: 4, deltaLabel: '(+4)', urgency: 'overdue' })
  })

  it('renders (-N) for future dates', () => {
    const p = bidBoardDueCellParts('2026-08-14', TODAY)
    expect(p).toEqual({ dateLabel: 'Fri 8/14', deltaDays: -11, deltaLabel: '(-11)', urgency: 'normal' })
  })

  it('marks due-today and the next 3 days as soon', () => {
    expect(bidBoardDueCellParts('2026-08-03', TODAY)).toMatchObject({ deltaLabel: '(+0)', urgency: 'soon' })
    expect(bidBoardDueCellParts('2026-08-05', TODAY)).toMatchObject({ dateLabel: 'Wed 8/5', deltaLabel: '(-2)', urgency: 'soon' })
    expect(bidBoardDueCellParts('2026-08-06', TODAY)).toMatchObject({ urgency: 'soon' })
    expect(bidBoardDueCellParts('2026-08-07', TODAY)).toMatchObject({ urgency: 'normal' })
  })

  it('is overdue starting the day after the due date', () => {
    expect(bidBoardDueCellParts('2026-08-02', TODAY)).toMatchObject({ deltaLabel: '(+1)', urgency: 'overdue' })
  })

  it('returns null for empty or unparseable input', () => {
    expect(bidBoardDueCellParts(null, TODAY)).toBeNull()
    expect(bidBoardDueCellParts('', TODAY)).toBeNull()
    expect(bidBoardDueCellParts('not-a-date', TODAY)).toBeNull()
  })
})

describe('bidBoardLastContactParts', () => {
  it('renders weekday + M/D with (+N) days since', () => {
    const p = bidBoardLastContactParts('2026-07-28T09:15:00', TODAY)
    expect(p).toEqual({ dateLabel: 'Tue 7/28', deltaDays: 6, deltaLabel: '(+6)' })
  })

  it('counts whole days from local midnight, not 24h windows', () => {
    // Late last night → still "1 day ago" even though <24h elapsed.
    const p = bidBoardLastContactParts('2026-08-02T23:50:00', TODAY)
    expect(p).toMatchObject({ deltaDays: 1, deltaLabel: '(+1)' })
  })

  it('handles same-day contact as (+0)', () => {
    expect(bidBoardLastContactParts('2026-08-03T08:00:00', TODAY)).toMatchObject({ deltaLabel: '(+0)' })
  })

  it('returns null for empty or unparseable input', () => {
    expect(bidBoardLastContactParts(null, TODAY)).toBeNull()
    expect(bidBoardLastContactParts('garbage', TODAY)).toBeNull()
  })
})
