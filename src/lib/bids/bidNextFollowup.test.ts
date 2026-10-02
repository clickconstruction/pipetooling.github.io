import { describe, expect, it } from 'vitest'
import {
  EMPTY_FOLLOWUP_PICK,
  applyFollowupToEntry,
  bidFollowupColumns,
  bidIsParked,
  buildFollowupChangeEntry,
  builderFollowupYmd,
  followupChangeNote,
  followupDateIsPickable,
  followupDateLabel,
  followupDayStands,
  followupEntryColumns,
  followupNeedsCall,
  followupChip,
  followupNoteSentence,
  followupQuickPickYmd,
  followupTag,
  followupWeekdayOnOrAfter,
  noteWithoutFollowupSentence,
  resolveBidFollowup,
  withFollowupSentence,
} from './bidNextFollowup'

/**
 * The owner's case (2026-10-02): a city bid sent in February, "next budget year, call us in
 * January". Today is Friday Oct 2, 2026. Instants are written with the office's UTC offset on
 * purpose: the day of a contact is the office's day (APP_CALENDAR_TZ), not UTC's.
 */
const TODAY = '2026-10-02'
const NOW = '2026-10-02T15:00:00-05:00'
const SENT = '2026-02-11'

const resolve = (over: Partial<Parameters<typeof resolveBidFollowup>[0]>, today = TODAY, now = NOW) =>
  resolveBidFollowup({ sentIso: SENT, lastContactIso: null, ...over }, today, now)

describe('the quick picks', () => {
  it('count from today and land on a weekday', () => {
    expect(followupQuickPickYmd('next-week', TODAY)).toBe('2026-10-09')
    expect(followupQuickPickYmd('two-weeks', TODAY)).toBe('2026-10-16')
    expect(followupQuickPickYmd('next-month', TODAY)).toBe('2026-11-02')
    // Jan 2, 2027 is a Saturday: the pick is the Monday.
    expect(followupQuickPickYmd('three-months', TODAY)).toBe('2027-01-04')
  })

  it('keep the day of the month where the month has it', () => {
    // Nov 30 + 3 months has no Feb 30: Feb 28, 2027, a Sunday, so Monday Mar 1.
    expect(followupQuickPickYmd('three-months', '2026-11-30')).toBe('2027-03-01')
    expect(followupQuickPickYmd('next-month', '2026-12-15')).toBe('2027-01-15')
  })

  it('move a Saturday or a Sunday to Monday and leave a weekday alone', () => {
    expect(followupWeekdayOnOrAfter('2026-10-03')).toBe('2026-10-05')
    expect(followupWeekdayOnOrAfter('2026-10-04')).toBe('2026-10-05')
    expect(followupWeekdayOnOrAfter('2026-10-05')).toBe('2026-10-05')
  })

  it('a typed day must be a real day after today', () => {
    expect(followupDateIsPickable('2027-01-05', TODAY)).toBe(true)
    expect(followupDateIsPickable('2026-10-03', TODAY)).toBe(true)
    expect(followupDateIsPickable(TODAY, TODAY)).toBe(false)
    expect(followupDateIsPickable('2026-09-30', TODAY)).toBe(false)
    expect(followupDateIsPickable('', TODAY)).toBe(false)
    expect(followupDateIsPickable('01/05/2027', TODAY)).toBe(false)
  })

  it('names a day with its weekday, and its year when it is not this year', () => {
    expect(followupDateLabel('2026-10-09', TODAY)).toBe('Fri, Oct 9')
    expect(followupDateLabel('2027-01-05', TODAY)).toBe('Tue, Jan 5, 2027')
  })
})

describe('where a bid stands', () => {
  it('never contacted and no day: it has no date yet', () => {
    const f = resolve({})
    expect(f).toEqual({ state: 'none', dueYmd: null, source: 'default', daysUntil: null })
    expect(followupNeedsCall(f)).toBe(true)
    expect(followupTag(f, TODAY)).toBeNull()
  })

  it('contacted inside seven days and no day: fresh, back on the eighth day, as before', () => {
    const f = resolve({ lastContactIso: '2026-09-30T10:00:00-05:00' })
    expect(f).toEqual({ state: 'fresh', dueYmd: '2026-10-07', source: 'default', daysUntil: 5 })
    expect(followupNeedsCall(f)).toBe(false)
  })

  it('contacted long ago and no day: no date yet, not "overdue" (nobody promised a day)', () => {
    const f = resolve({ lastContactIso: '2026-03-01T10:00:00-06:00' })
    expect(f.state).toBe('none')
    expect(f.source).toBe('default')
    expect(followupNeedsCall(f)).toBe(true)
  })

  it('a contact from before the bid was sent is no contact', () => {
    expect(resolve({ lastContactIso: '2026-02-01T10:00:00-06:00' }).state).toBe('none')
  })

  it('a picked day ahead parks the bid, even one that has been quiet for months', () => {
    const f = resolve({ lastContactIso: '2026-03-01T10:00:00-06:00', bidNextYmd: '2027-01-05' })
    expect(f).toEqual({ state: 'later', dueYmd: '2027-01-05', source: 'bid', daysUntil: 95 })
    expect(followupNeedsCall(f)).toBe(false)
    expect(followupTag(f, TODAY)).toEqual({ label: 'Tue, Jan 5, 2027', tone: 'blue' })
  })

  it('on the day it is due, and after it overdue by the days missed', () => {
    const due = resolve({ bidNextYmd: '2027-01-05' }, '2027-01-05', '2027-01-05T09:00:00-06:00')
    expect(due.state).toBe('due')
    expect(followupTag(due, '2027-01-05')).toEqual({ label: 'Due today', tone: 'amber' })
    const late = resolve({ bidNextYmd: '2027-01-05' }, '2027-01-08', '2027-01-08T09:00:00-06:00')
    expect(late).toEqual({ state: 'overdue', dueYmd: '2027-01-05', source: 'bid', daysUntil: -3 })
    expect(followupTag(late, '2027-01-08')).toEqual({ label: '3 d overdue', tone: 'red' })
    expect(followupNeedsCall(late)).toBe(true)
  })

  it('a picked day beats the seven-day rule both ways: a call yesterday does not hide a promise for today', () => {
    const f = resolve({ lastContactIso: '2026-10-01T10:00:00-05:00', bidNextYmd: TODAY })
    expect(f.state).toBe('due')
  })

  it('a call in November does not erase January 5', () => {
    const f = resolve({ lastContactIso: '2026-11-10T10:00:00-06:00', bidNextYmd: '2027-01-05' }, '2026-11-20', '2026-11-20T09:00:00-06:00')
    expect(f).toMatchObject({ state: 'later', dueYmd: '2027-01-05', source: 'bid' })
  })

  it('a contact on the day, or after it, spends the day: the bid is back on the seven-day rule', () => {
    const onTheDay = resolve({ lastContactIso: '2027-01-05T10:00:00-06:00', bidNextYmd: '2027-01-05' }, '2027-01-06', '2027-01-06T09:00:00-06:00')
    expect(onTheDay).toEqual({ state: 'fresh', dueYmd: '2027-01-12', source: 'default', daysUntil: 6 })
    const late = resolve({ lastContactIso: '2027-01-08T10:00:00-06:00', bidNextYmd: '2027-01-05' }, '2027-01-20', '2027-01-20T09:00:00-06:00')
    expect(late.state).toBe('none')
    expect(followupDayStands('2027-01-05', '2027-01-04T23:30:00-06:00')).toBe(true)
  })

  it('the day of a contact is the office day: 11:30 PM Chicago on Jan 4 is not Jan 5', () => {
    // 2027-01-05T05:30Z is Jan 4, 11:30 PM in Chicago.
    expect(followupDayStands('2027-01-05', '2027-01-05T05:30:00Z')).toBe(true)
    expect(followupDayStands('2027-01-05', '2027-01-05T06:30:00Z')).toBe(false)
  })

  it('a bid with no day of its own takes its builder\'s; its own day wins when it has one', () => {
    expect(resolve({ builderNextYmd: '2026-10-12' })).toMatchObject({ state: 'later', dueYmd: '2026-10-12', source: 'builder' })
    expect(resolve({ builderNextYmd: '2026-09-28' })).toMatchObject({ state: 'overdue', source: 'builder', daysUntil: -4 })
    expect(resolve({ builderNextYmd: '2026-10-12', bidNextYmd: '2027-01-05' })).toMatchObject({ dueYmd: '2027-01-05', source: 'bid' })
    // The bid's own day is spent, the builder's still stands.
    expect(resolve({ lastContactIso: '2026-09-25T10:00:00-05:00', bidNextYmd: '2026-09-20', builderNextYmd: '2026-10-12' })).toMatchObject({ dueYmd: '2026-10-12', source: 'builder' })
  })

  it('junk in the day column is no day', () => {
    expect(resolve({ bidNextYmd: 'soon' }).state).toBe('none')
    expect(resolve({ bidNextYmd: '' }).state).toBe('none')
  })
})

describe('the builder\'s day', () => {
  it('is the call window\'s promise, or a snooze still ahead', () => {
    expect(builderFollowupYmd(null, TODAY)).toBeNull()
    expect(builderFollowupYmd({ next_followup_at: '2026-10-09T13:00:00Z' }, TODAY)).toBe('2026-10-09')
    expect(builderFollowupYmd({ next_followup_at: '2026-10-09T13:00:00Z', snoozed_until: '2026-11-01T13:00:00Z' }, TODAY)).toBe('2026-11-01')
    // A snooze that has ended no longer parks anything.
    expect(builderFollowupYmd({ next_followup_at: '2026-10-09T13:00:00Z', snoozed_until: '2026-09-01T13:00:00Z' }, TODAY)).toBe('2026-10-09')
    expect(builderFollowupYmd({ snoozed_until: '2026-09-01T13:00:00Z' }, TODAY)).toBeNull()
  })
})

describe('what a pick writes', () => {
  const pick = { ymd: '2027-01-05', personId: 'p1', personName: 'J. Rayburn', reason: 'budget' as const }

  it('the three log columns, and nothing at all when no day is picked', () => {
    expect(followupEntryColumns(pick)).toEqual({ next_followup_on: '2027-01-05', next_followup_contact_person_id: 'p1', next_followup_reason: 'budget' })
    // The database refuses a person or a reason with no day; a pick with no day sends neither.
    expect(followupEntryColumns({ ...pick, ymd: null })).toEqual({ next_followup_on: null, next_followup_contact_person_id: null, next_followup_reason: null })
    expect(followupEntryColumns(EMPTY_FOLLOWUP_PICK)).toEqual({ next_followup_on: null, next_followup_contact_person_id: null, next_followup_reason: null })
  })

  it('a plain sentence in the note, so every reader of the log sees the day', () => {
    expect(followupNoteSentence(pick, TODAY)).toBe('Call again Tue, Jan 5, 2027. Ask for J. Rayburn. Waiting on their budget.')
    expect(followupNoteSentence({ ...pick, personId: null, personName: null, reason: null }, TODAY)).toBe('Call again Tue, Jan 5, 2027.')
    // "Other" is not worth a sentence.
    expect(followupNoteSentence({ ...pick, personName: null, reason: 'other' }, TODAY)).toBe('Call again Tue, Jan 5, 2027.')
    expect(followupNoteSentence(EMPTY_FOLLOWUP_PICK, TODAY)).toBe('')
  })

  it('joins what was said and the day, and takes them apart again', () => {
    const note = withFollowupSentence('Still pending. Holding for the next budget year', pick, TODAY)
    expect(note).toBe('Still pending. Holding for the next budget year. Call again Tue, Jan 5, 2027. Ask for J. Rayburn. Waiting on their budget.')
    expect(noteWithoutFollowupSentence(note)).toBe('Still pending. Holding for the next budget year.')
    expect(withFollowupSentence('Still pending.', EMPTY_FOLLOWUP_PICK, TODAY)).toBe('Still pending.')
    expect(withFollowupSentence('', pick, TODAY)).toBe('Call again Tue, Jan 5, 2027. Ask for J. Rayburn. Waiting on their budget.')
    expect(noteWithoutFollowupSentence('Left a message')).toBe('Left a message')
    expect(noteWithoutFollowupSentence(null)).toBe('')
  })

  it('a date changed with no call writes a note that says so', () => {
    expect(followupChangeNote(pick, TODAY)).toBe('Date moved. Call again Tue, Jan 5, 2027. Ask for J. Rayburn. Waiting on their budget.')
    expect(followupChangeNote(EMPTY_FOLLOWUP_PICK, TODAY)).toBe('Call-again date removed.')
  })
})

describe('the log rows', () => {
  const pick = { ymd: '2027-01-05', personId: 'p1', personName: 'J. Rayburn', reason: 'budget' as const }
  const entry = { bid_id: 'b1', gc_customer_id: null, contact_method: 'Phone', notes: 'Still pending. Holding for next year', occurred_at: NOW, created_by: 'u1' }

  it('a contact with a pick carries the columns and the sentence', () => {
    expect(applyFollowupToEntry(entry, pick, TODAY)).toEqual({
      ...entry,
      notes: 'Still pending. Holding for next year. Call again Tue, Jan 5, 2027. Ask for J. Rayburn. Waiting on their budget.',
      next_followup_on: '2027-01-05',
      next_followup_contact_person_id: 'p1',
      next_followup_reason: 'budget',
    })
  })

  it('a contact with no pick is the row it always was: no new keys at all', () => {
    expect(applyFollowupToEntry(entry, EMPTY_FOLLOWUP_PICK, TODAY)).toBe(entry)
    expect(Object.keys(applyFollowupToEntry(entry, { ...pick, ymd: null }, TODAY))).toEqual(Object.keys(entry))
  })

  it('a date moved with no call is a note, not a contact', () => {
    expect(buildFollowupChangeEntry({ bidId: 'b1', userId: 'u1', nowIso: NOW, pick, todayYmd: TODAY })).toEqual({
      bid_id: 'b1',
      gc_customer_id: null,
      contact_method: null,
      notes: 'Date moved. Call again Tue, Jan 5, 2027. Ask for J. Rayburn. Waiting on their budget.',
      occurred_at: NOW,
      created_by: 'u1',
      next_followup_on: '2027-01-05',
      next_followup_contact_person_id: 'p1',
      next_followup_reason: 'budget',
      next_followup_cleared: false,
    })
  })

  it('a date removed says so and carries nothing else', () => {
    expect(buildFollowupChangeEntry({ bidId: 'b1', userId: 'u1', nowIso: NOW, gcCustomerId: 'gc1', pick: { ...pick, ymd: null }, todayYmd: TODAY })).toMatchObject({
      gc_customer_id: 'gc1',
      contact_method: null,
      notes: 'Call-again date removed.',
      next_followup_on: null,
      next_followup_contact_person_id: null,
      next_followup_reason: null,
      next_followup_cleared: true,
    })
  })
})

describe('reading a bid row', () => {
  it('takes the day, who and why off the row', () => {
    expect(bidFollowupColumns({ next_followup_on: '2027-01-05', next_followup_contact_person_id: 'p1', next_followup_reason: 'budget', next_followup_entry_id: 'e1' })).toEqual({ nextYmd: '2027-01-05', personId: 'p1', reason: 'budget', entryId: 'e1' })
  })

  it('a row from before the columns existed has no day, and neither does junk', () => {
    const none = { nextYmd: null, personId: null, reason: null, entryId: null }
    expect(bidFollowupColumns({ id: 'b1' })).toEqual(none)
    expect(bidFollowupColumns(null)).toEqual(none)
    expect(bidFollowupColumns({ next_followup_on: 'soon', next_followup_contact_person_id: 'p1' })).toEqual(none)
    expect(bidFollowupColumns({ next_followup_on: '2027-01-05', next_followup_reason: 'vacation' })).toEqual({ nextYmd: '2027-01-05', personId: null, reason: null, entryId: null })
  })
})

describe('the day on other screens', () => {
  const row = { next_followup_on: '2027-01-05', next_followup_contact_person_id: 'p1', next_followup_reason: 'budget' }
  const chip = (over: Partial<Parameters<typeof followupChip>[0]>) => followupChip({ bid: row, sentIso: SENT, lastContactIso: null, todayYmd: TODAY, nowIso: NOW, ...over })

  it('a parked bid wears a blue chip with the day and who to ask for', () => {
    expect(chip({ personName: 'J. Rayburn' })).toEqual({ label: 'call again Tue, Jan 5, 2027 · J. Rayburn', short: 'Jan 5', tone: 'blue', title: 'Call again Tue, Jan 5, 2027 · ask for J. Rayburn · waiting on their budget' })
    expect(chip({})?.label).toBe('call again Tue, Jan 5, 2027')
  })

  it('amber on the day, red after it', () => {
    expect(chip({ todayYmd: '2027-01-05', nowIso: '2027-01-05T09:00:00-06:00' })).toMatchObject({ label: 'call today', short: 'today', tone: 'amber' })
    expect(chip({ todayYmd: '2027-01-08', nowIso: '2027-01-08T09:00:00-06:00', personName: 'J. Rayburn' })).toMatchObject({ label: 'call was due Tue, Jan 5 · J. Rayburn', short: 'was Jan 5', tone: 'red' })
  })

  it('no chip with no day, a spent day, or a bid not sent', () => {
    expect(chip({ bid: {} })).toBeNull()
    expect(chip({ lastContactIso: '2027-01-06T10:00:00-06:00', todayYmd: '2027-01-07', nowIso: '2027-01-07T09:00:00-06:00' })).toBeNull()
    expect(chip({ sentIso: null })).toBeNull()
  })

  it('parked means a day of its own still ahead', () => {
    expect(bidIsParked(row, null, TODAY)).toBe(true)
    expect(bidIsParked(row, '2026-11-10T10:00:00-06:00', '2026-11-20')).toBe(true)
    expect(bidIsParked(row, null, '2027-01-05')).toBe(false) // due today: not parked
    expect(bidIsParked(row, '2027-01-05T10:00:00-06:00', '2027-01-06')).toBe(false) // spent
    expect(bidIsParked({}, null, TODAY)).toBe(false)
  })
})
