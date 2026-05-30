import { describe, expect, it } from 'vitest'
import { getBidStatusLabel } from './bidStatusLabel'

describe('getBidStatusLabel', () => {
  it('returns Unsent when no send date, regardless of outcome', () => {
    expect(getBidStatusLabel({ bid_date_sent: null, outcome: null })).toBe('Unsent')
    expect(getBidStatusLabel({ bid_date_sent: null, outcome: 'won' })).toBe('Unsent')
    expect(getBidStatusLabel({ bid_date_sent: '', outcome: 'won' })).toBe('Unsent')
  })

  it('maps outcomes once sent', () => {
    expect(getBidStatusLabel({ bid_date_sent: '2026-01-01', outcome: 'won' })).toBe('Won')
    expect(getBidStatusLabel({ bid_date_sent: '2026-01-01', outcome: 'lost' })).toBe('Lost')
    expect(getBidStatusLabel({ bid_date_sent: '2026-01-01', outcome: 'started_or_complete' })).toBe('Started or Complete')
  })

  it('falls back to "Not yet won or lost" for sent bids with no/unknown outcome', () => {
    expect(getBidStatusLabel({ bid_date_sent: '2026-01-01', outcome: null })).toBe('Not yet won or lost')
    expect(getBidStatusLabel({ bid_date_sent: '2026-01-01', outcome: 'something_else' })).toBe('Not yet won or lost')
  })
})
