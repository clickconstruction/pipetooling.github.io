import { describe, it, expect } from 'vitest'
import { bidBoardDueCellParts, bidBoardLastContactParts, bidBoardNoDueDateParts, bidBoardSentLabel, UNSENT_NO_DUE_DATE_RED_AFTER_DAYS } from './bidBoardDateCells'

// Mock "today": Monday 2026-08-03 (mid-afternoon to catch midnight-normalization bugs).
const TODAY = new Date('2026-08-03T15:30:00')

describe('bidBoardDueCellParts', () => {
  it('renders weekday + M/D with (+N) for past-due dates and flags overdue', () => {
    const p = bidBoardDueCellParts('2026-07-30', TODAY)
    expect(p).toEqual({ dateLabel: 'Thu 7/30', deltaDays: 4, deltaLabel: '(+4)', urgency: 'overdue', decided: false })
  })

  it('renders (-N) for future dates', () => {
    const p = bidBoardDueCellParts('2026-08-14', TODAY)
    expect(p).toEqual({ dateLabel: 'Fri 8/14', deltaDays: -11, deltaLabel: '(-11)', urgency: 'normal', decided: false })
  })

  it('goes quiet for decided bids: urgency normal + decided, whatever the date', () => {
    // Long past due, but Won — no false alarm.
    expect(bidBoardDueCellParts('2026-04-01', TODAY, 'won')).toMatchObject({ urgency: 'normal', decided: true })
    expect(bidBoardDueCellParts('2026-08-02', TODAY, 'lost')).toMatchObject({ urgency: 'normal', decided: true })
    expect(bidBoardDueCellParts('2026-08-04', TODAY, 'started_or_complete')).toMatchObject({ urgency: 'normal', decided: true })
  })

  it('keeps urgency for open bids (null / empty / unknown outcome)', () => {
    expect(bidBoardDueCellParts('2026-08-02', TODAY, null)).toMatchObject({ urgency: 'overdue', decided: false })
    expect(bidBoardDueCellParts('2026-08-04', TODAY, '')).toMatchObject({ urgency: 'soon', decided: false })
  })

  it('goes quiet once sent, but keeps the day count (Pending section, v2.1914)', () => {
    // Past due but already sent — waiting on the GC, not on us.
    expect(bidBoardDueCellParts('2026-08-02', TODAY, null, '2026-08-01')).toMatchObject({
      urgency: 'normal',
      decided: false,
      deltaLabel: '(+1)',
    })
    // Unsent stays red/amber: blank or missing dateSent changes nothing.
    expect(bidBoardDueCellParts('2026-08-02', TODAY, null, '  ')).toMatchObject({ urgency: 'overdue', decided: false })
    expect(bidBoardDueCellParts('2026-08-02', TODAY, null, null)).toMatchObject({ urgency: 'overdue', decided: false })
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

describe('bidBoardSentLabel (J10-F2: Pending prints the field it sorts by)', () => {
  it('formats a date-only sent date as "sent Wkd M/D"', () => {
    expect(bidBoardSentLabel('2026-09-02')).toBe('sent Wed 9/2')
  })
  it('is null without a sent date', () => {
    expect(bidBoardSentLabel(null)).toBeNull()
    expect(bidBoardSentLabel('')).toBeNull()
    expect(bidBoardSentLabel('garbage')).toBeNull()
  })
})

describe('bidBoardNoDueDateParts (J10-F4: undated Unsent bids can still turn red)', () => {
  it('is quiet while the bid is younger than the threshold', () => {
    const p = bidBoardNoDueDateParts({ bid_due_date: null, created_at: '2026-07-25T14:00:00Z', outcome: null, bid_date_sent: null }, TODAY)
    expect(p).toEqual({ label: 'No due date', ageDays: 9, deltaLabel: '(+9)', urgency: 'normal' })
  })
  it(`turns red once older than ${UNSENT_NO_DUE_DATE_RED_AFTER_DAYS} days`, () => {
    const p = bidBoardNoDueDateParts({ bid_due_date: null, created_at: '2026-07-01T14:00:00Z', outcome: null, bid_date_sent: null }, TODAY)
    expect(p).toMatchObject({ ageDays: 33, deltaLabel: '(+33)', urgency: 'overdue' })
    // Exactly at the threshold stays quiet; one day past it goes red.
    const at = new Date(TODAY); at.setDate(at.getDate() - UNSENT_NO_DUE_DATE_RED_AFTER_DAYS)
    expect(bidBoardNoDueDateParts({ bid_due_date: null, created_at: at.toISOString() }, TODAY)?.urgency).toBe('normal')
    at.setDate(at.getDate() - 1)
    expect(bidBoardNoDueDateParts({ bid_due_date: null, created_at: at.toISOString() }, TODAY)?.urgency).toBe('overdue')
  })
  it('shows the chip with no day count when created_at is unknown', () => {
    expect(bidBoardNoDueDateParts({ bid_due_date: null }, TODAY)).toEqual({ label: 'No due date', ageDays: null, deltaLabel: '', urgency: 'normal' })
  })
  it('is null when the bid has a due date, is sent, or is decided', () => {
    expect(bidBoardNoDueDateParts({ bid_due_date: '2026-08-10', created_at: '2026-07-01T14:00:00Z' }, TODAY)).toBeNull()
    expect(bidBoardNoDueDateParts({ bid_due_date: null, created_at: '2026-07-01T14:00:00Z', bid_date_sent: '2026-07-20' }, TODAY)).toBeNull()
    expect(bidBoardNoDueDateParts({ bid_due_date: null, created_at: '2026-07-01T14:00:00Z', outcome: 'won' }, TODAY)).toBeNull()
    expect(bidBoardNoDueDateParts({ bid_due_date: '  ', created_at: '2026-07-01T14:00:00Z', outcome: 'lost' }, TODAY)).toBeNull()
  })
})
