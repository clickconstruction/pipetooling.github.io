import { describe, expect, it } from 'vitest'
import { bidFollowupCalendarItems, bidFollowupsDue, bidHasStandingDay, followupNamesLine, type BidFollowupRow } from './bidFollowupsDue'

const TODAY = '2027-01-05'

function row(over: Partial<BidFollowupRow>): BidFollowupRow {
  return {
    id: 'b1',
    project_name: 'City re-pipe',
    bid_value: 27_000,
    bid_date_sent: '2026-02-11',
    outcome: null,
    last_contact: '2026-10-02T20:00:00Z',
    next_followup_on: '2027-01-05',
    adopted_into_bid_id: null,
    builderName: 'City of Riverton',
    ...over,
  }
}

describe('a standing day', () => {
  it('is a picked day on a sent bid with no answer, not yet spent by a later contact', () => {
    expect(bidHasStandingDay(row({}))).toBe(true)
    expect(bidHasStandingDay(row({ next_followup_on: null }))).toBe(false)
    expect(bidHasStandingDay(row({ outcome: 'won' }))).toBe(false)
    expect(bidHasStandingDay(row({ outcome: 'lost' }))).toBe(false)
    expect(bidHasStandingDay(row({ bid_date_sent: null }))).toBe(false)
    expect(bidHasStandingDay(row({ adopted_into_bid_id: 'other' }))).toBe(false)
    // Called on Jan 6, after the day: the promise is kept and spent.
    expect(bidHasStandingDay(row({ last_contact: '2027-01-06T16:00:00Z' }))).toBe(false)
    // Never contacted, but a day was set by a note: it stands.
    expect(bidHasStandingDay(row({ last_contact: null }))).toBe(true)
  })
})

describe('bidFollowupsDue — the Needs You card', () => {
  it('is null when nothing is due: a day still ahead is not a reminder yet', () => {
    expect(bidFollowupsDue([row({ next_followup_on: '2027-01-06' })], TODAY)).toBeNull()
    expect(bidFollowupsDue([], TODAY)).toBeNull()
  })

  it('counts the calls due today and the ones missed, with their dollars and builders', () => {
    const due = bidFollowupsDue(
      [
        row({}),
        row({ id: 'b2', builderName: 'Hilltop Builders', project_name: 'Clinic', bid_value: 48_900, next_followup_on: '2026-12-28' }),
        row({ id: 'b3', builderName: 'Hilltop Builders', project_name: 'Annex', bid_value: null, next_followup_on: '2027-01-05' }),
        row({ id: 'b4', builderName: 'Later GC', next_followup_on: '2027-02-01' }),
        row({ id: 'b5', builderName: 'Won GC', outcome: 'won' }),
      ],
      TODAY,
    )
    // The most overdue builder leads; a builder with two due bids is named once.
    expect(due).toEqual({ count: 3, overdueCount: 1, value: 75_900, names: ['Hilltop Builders', 'City of Riverton'] })
  })

  it('names a bid with no builder by its project', () => {
    expect(bidFollowupsDue([row({ builderName: null })], TODAY)?.names).toEqual(['City re-pipe'])
  })

  it('writes the names in one line, and says how many are left', () => {
    expect(followupNamesLine(['A', 'B'])).toBe('A · B')
    expect(followupNamesLine(['A', 'B', 'C', 'D', 'E'])).toBe('A · B · C · 2 more')
  })
})

describe('bidFollowupCalendarItems', () => {
  it('puts each standing day on its day, ahead or missed, and skips spent and decided ones', () => {
    expect(
      bidFollowupCalendarItems([
        row({}),
        row({ id: 'b2', builderName: null, project_name: 'Annex', next_followup_on: '2026-12-28' }),
        row({ id: 'b3', outcome: 'lost' }),
        row({ id: 'b4', last_contact: '2027-01-06T16:00:00Z' }),
      ]),
    ).toEqual([
      { bidId: 'b1', dateKey: '2027-01-05', title: 'City of Riverton · City re-pipe' },
      { bidId: 'b2', dateKey: '2026-12-28', title: 'Annex' },
    ])
  })
})
