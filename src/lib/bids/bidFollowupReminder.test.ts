import { describe, expect, it } from 'vitest'
import {
  BID_FOLLOWUP_REMINDER_HOUR,
  bidDueForReminder,
  bidFollowupReminderMessage,
  followupDayStandsOnServer,
  officeHour,
  officeYmd,
  reminderKey,
  reminderRecipientId,
  type BidFollowupReminderRow,
} from '../../../supabase/functions/_shared/bidFollowupReminder'
import { followupDayStands } from './bidNextFollowup'

/** The phone reminder's rules (v2.4427). They live with the edge function and are tested here. */

const TODAY = '2027-01-05'
const NONE = { remindedDays: new Set<string>(), twinUserIds: new Set<string>() }

function row(over: Partial<BidFollowupReminderRow> = {}): BidFollowupReminderRow {
  return {
    id: 'b1',
    bid_date_sent: '2026-02-11',
    outcome: null,
    last_contact: '2026-10-02T20:00:00Z',
    adopted_into_bid_id: null,
    next_followup_on: '2027-01-05',
    account_manager_id: 'am',
    estimator_id: 'est',
    created_by: 'maker',
    ...over,
  }
}

describe('the office clock', () => {
  it('reads the day and the hour in the office, not in UTC', () => {
    // 2027-01-05T05:30Z is 11:30 PM on Jan 4 in the office.
    expect(officeYmd('2027-01-05T05:30:00Z')).toBe('2027-01-04')
    expect(officeHour(new Date('2027-01-05T05:30:00Z'))).toBe(23)
    // 14:00Z is 8 AM in January (standard time) and 9 AM in July (daylight time).
    expect(officeHour(new Date('2027-01-05T14:00:00Z'))).toBe(8)
    expect(officeHour(new Date('2027-07-05T14:00:00Z'))).toBe(9)
    expect(officeHour(new Date('2027-01-05T06:10:00Z'))).toBe(0)
    expect(officeYmd(null)).toBe('')
    expect(officeYmd('junk')).toBe('')
    expect(BID_FOLLOWUP_REMINDER_HOUR).toBe(8)
  })
})

describe('the server agrees with the app on when a day stands', () => {
  const cases: Array<[string | null, string | null]> = [
    ['2027-01-05', null],
    ['2027-01-05', '2026-11-10T16:00:00Z'],
    ['2027-01-05', '2027-01-05T05:30:00Z'], // Jan 4, 11:30 PM in the office: before the day
    ['2027-01-05', '2027-01-05T06:30:00Z'], // Jan 5, 12:30 AM: on the day
    ['2027-01-05', '2027-01-09T16:00:00Z'],
    [null, null],
    ['soon', null],
    ['', '2026-01-01T00:00:00Z'],
  ]
  it.each(cases)('day %s, last contact %s', (next, contact) => {
    expect(followupDayStandsOnServer(next, contact)).toBe(followupDayStands(next, contact))
  })
})

describe('bidDueForReminder', () => {
  it('a standing day that is today, or missed, is due once', () => {
    expect(bidDueForReminder(row(), TODAY, NONE)).toBe(true)
    expect(bidDueForReminder(row({ next_followup_on: '2026-12-28' }), TODAY, NONE)).toBe(true)
    expect(bidDueForReminder(row(), TODAY, { ...NONE, remindedDays: new Set([reminderKey('b1', '2027-01-05')]) })).toBe(false)
  })

  it('a day moved later is a new day: it reminds again', () => {
    const reminded = { ...NONE, remindedDays: new Set([reminderKey('b1', '2027-01-05')]) }
    expect(bidDueForReminder(row({ next_followup_on: '2027-02-01' }), '2027-02-01', reminded)).toBe(true)
  })

  it('not before the day, not after the answer, not once the call was made', () => {
    expect(bidDueForReminder(row({ next_followup_on: '2027-01-06' }), TODAY, NONE)).toBe(false)
    expect(bidDueForReminder(row({ outcome: 'won' }), TODAY, NONE)).toBe(false)
    expect(bidDueForReminder(row({ outcome: 'lost' }), TODAY, NONE)).toBe(false)
    expect(bidDueForReminder(row({ bid_date_sent: null }), TODAY, NONE)).toBe(false)
    expect(bidDueForReminder(row({ adopted_into_bid_id: 'x' }), TODAY, NONE)).toBe(false)
    expect(bidDueForReminder(row({ next_followup_on: null }), TODAY, NONE)).toBe(false)
    expect(bidDueForReminder(row({ last_contact: '2027-01-05T16:00:00Z' }), TODAY, NONE)).toBe(false)
  })

  it("a robot's bid reminds nobody", () => {
    expect(bidDueForReminder(row(), TODAY, { ...NONE, twinUserIds: new Set(['est']) })).toBe(false)
    expect(bidDueForReminder(row({ estimator_id: null }), TODAY, { ...NONE, twinUserIds: new Set(['maker']) })).toBe(false)
  })
})

describe('who is told and what it says', () => {
  it('the account manager, else the estimator, else whoever set the day', () => {
    expect(reminderRecipientId(row(), 'setter')).toBe('am')
    expect(reminderRecipientId(row({ account_manager_id: null }), 'setter')).toBe('est')
    expect(reminderRecipientId(row({ account_manager_id: null, estimator_id: null }), 'setter')).toBe('setter')
    expect(reminderRecipientId(row({ account_manager_id: null, estimator_id: null }), null)).toBeNull()
  })

  it('names the builder, the bid and who to ask for', () => {
    expect(bidFollowupReminderMessage({ bidLabel: 'BP82', projectName: 'City re-pipe', builderName: 'City of Riverton', personName: 'J. Rayburn', dueYmd: TODAY, todayYmd: TODAY })).toEqual({
      title: 'Bid follow-up due today',
      body: 'City of Riverton, BP82 City re-pipe. Ask for J. Rayburn.',
    })
    expect(bidFollowupReminderMessage({ bidLabel: 'BP82', projectName: null, builderName: null, personName: null, dueYmd: TODAY, todayYmd: TODAY }).body).toBe('BP82.')
  })

  it('says the day when the day was missed', () => {
    expect(bidFollowupReminderMessage({ bidLabel: 'BP82', projectName: 'City re-pipe', builderName: 'City of Riverton', personName: null, dueYmd: '2026-12-28', todayYmd: TODAY }).title).toBe('Bid follow-up was due Dec 28')
  })
})
