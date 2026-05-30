import { describe, expect, it } from 'vitest'
import { compareBidsForPartyDetail, type PartyDetailSortBid } from './compareBidsForPartyDetail'

const bid = (over: Partial<PartyDetailSortBid>): PartyDetailSortBid => ({
  bid_date_sent: '2026-01-01',
  outcome: null,
  bid_due_date: null,
  ...over,
})

describe('compareBidsForPartyDetail', () => {
  it('ranks unsent < won < started_or_complete < lost < other', () => {
    const unsent = bid({ bid_date_sent: null })
    const won = bid({ outcome: 'won' })
    const started = bid({ outcome: 'started_or_complete' })
    const lost = bid({ outcome: 'lost' })
    const other = bid({ outcome: null })

    expect(compareBidsForPartyDetail(unsent, won)).toBeLessThan(0)
    expect(compareBidsForPartyDetail(won, started)).toBeLessThan(0)
    expect(compareBidsForPartyDetail(started, lost)).toBeLessThan(0)
    expect(compareBidsForPartyDetail(lost, other)).toBeLessThan(0)
  })

  it('sorts whole list into rank order', () => {
    const list: PartyDetailSortBid[] = [
      bid({ outcome: 'lost' }),
      bid({ bid_date_sent: null }),
      bid({ outcome: null }),
      bid({ outcome: 'won' }),
      bid({ outcome: 'started_or_complete' }),
    ]
    const sorted = [...list].sort(compareBidsForPartyDetail).map((b) => (!b.bid_date_sent ? 'unsent' : b.outcome ?? 'other'))
    expect(sorted).toEqual(['unsent', 'won', 'started_or_complete', 'lost', 'other'])
  })

  it('breaks ties within the same rank by bid_due_date ascending', () => {
    const earlier = bid({ outcome: 'won', bid_due_date: '2026-01-15' })
    const later = bid({ outcome: 'won', bid_due_date: '2026-03-01' })
    expect(compareBidsForPartyDetail(earlier, later)).toBeLessThan(0)
    expect(compareBidsForPartyDetail(later, earlier)).toBeGreaterThan(0)
  })

  it('treats null bid_due_date as empty string in the tiebreak', () => {
    const noDue = bid({ outcome: 'won', bid_due_date: null })
    const withDue = bid({ outcome: 'won', bid_due_date: '2026-01-15' })
    expect(compareBidsForPartyDetail(noDue, withDue)).toBeLessThan(0)
  })
})
