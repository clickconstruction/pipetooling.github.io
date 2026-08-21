import { describe, expect, it } from 'vitest'
import {
  bidClock,
  bidDisplayValue,
  bidOutcomeBucket,
  bidOutcomeSummary,
  estimateStatusShortLabel,
  sortProfileBids,
  type ProfileBid,
} from './customerProfileRails'

const TODAY = '2026-08-21'

function bid(p: Partial<ProfileBid> & { id: string }): ProfileBid {
  return {
    bid_number: null,
    project_name: null,
    outcome: null,
    address: null,
    bid_value: null,
    agreed_value: null,
    bid_date_sent: null,
    bid_due_date: null,
    ...p,
  }
}

describe('customerProfileRails', () => {
  it('buckets outcomes: started_or_complete counts as won; null/pending is undecided', () => {
    expect(bidOutcomeBucket('won')).toBe('won')
    expect(bidOutcomeBucket('started_or_complete')).toBe('won')
    expect(bidOutcomeBucket('lost')).toBe('lost')
    expect(bidOutcomeBucket(null)).toBe('undecided')
    expect(bidOutcomeBucket('pending')).toBe('undecided')
    expect(
      bidOutcomeSummary([bid({ id: 'a', outcome: 'won' }), bid({ id: 'b', outcome: 'started_or_complete' }), bid({ id: 'c', outcome: 'lost' }), bid({ id: 'd' })]),
    ).toEqual({ total: 4, won: 2, lost: 1, undecided: 1 })
  })

  it('display value prefers agreed_value once won; hides zero/unset', () => {
    expect(bidDisplayValue(bid({ id: 'a', outcome: 'won', bid_value: 400_000, agreed_value: 524_000 }))).toBe(524_000)
    expect(bidDisplayValue(bid({ id: 'b', outcome: 'won', bid_value: 400_000 }))).toBe(400_000)
    expect(bidDisplayValue(bid({ id: 'c', bid_value: 188_450 }))).toBe(188_450)
    expect(bidDisplayValue(bid({ id: 'd' }))).toBeNull()
  })

  it('clock: live due dates count down, hit today, and go overdue only when never sent', () => {
    expect(bidClock(bid({ id: 'a', bid_due_date: '2026-08-24' }), TODAY)).toEqual({ text: 'due in 3d', tone: 'due' })
    expect(bidClock(bid({ id: 'b', bid_due_date: '2026-08-21' }), TODAY)).toEqual({ text: 'due today', tone: 'due' })
    expect(bidClock(bid({ id: 'c', bid_due_date: '2026-08-16' }), TODAY)).toEqual({ text: 'due 5d ago', tone: 'overdue' })
    // Sent before a passed due date → it's out the door and waiting, not overdue.
    expect(bidClock(bid({ id: 'd', bid_due_date: '2026-08-16', bid_date_sent: '2026-07-30' }), TODAY)).toEqual({
      text: 'sent 22d ago · undecided',
      tone: 'waiting',
    })
  })

  it('clock: decided bids show the outcome with their sent date; dateless undecided stays plain', () => {
    expect(bidClock(bid({ id: 'a', outcome: 'won', bid_date_sent: '2026-06-12' }), TODAY)).toEqual({ text: 'won · Jun 12', tone: 'won' })
    expect(bidClock(bid({ id: 'b', outcome: 'lost' }), TODAY)).toEqual({ text: 'lost', tone: 'lost' })
    expect(bidClock(bid({ id: 'c' }), TODAY)).toEqual({ text: 'undecided', tone: 'none' })
  })

  it('sorts chase-first: due soonest, then longest-waiting undecided, then decided as fetched', () => {
    const bids = [
      bid({ id: 'decided-new', outcome: 'won' }),
      bid({ id: 'waiting-long', bid_date_sent: '2026-07-01' }),
      bid({ id: 'due-later', bid_due_date: '2026-09-01' }),
      bid({ id: 'waiting-short', bid_date_sent: '2026-08-10' }),
      bid({ id: 'due-soon', bid_due_date: '2026-08-24' }),
      bid({ id: 'decided-old', outcome: 'lost' }),
    ]
    expect(sortProfileBids(bids, TODAY).map((b) => b.id)).toEqual([
      'due-soon',
      'due-later',
      'waiting-long',
      'waiting-short',
      'decided-new',
      'decided-old',
    ])
  })

  it('estimate status labels read human', () => {
    expect(estimateStatusShortLabel('customer_accepted')).toBe('accepted')
    expect(estimateStatusShortLabel('sent')).toBe('sent · waiting')
    expect(estimateStatusShortLabel('draft')).toBe('draft')
  })
})
