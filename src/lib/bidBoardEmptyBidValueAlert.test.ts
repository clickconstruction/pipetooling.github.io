import { describe, expect, it } from 'vitest'
import { shouldShowEmptyBidValueAlert } from './bidBoardEmptyBidValueAlert'

const base = {
  bid_date_sent: '2026-05-10',
  outcome: null as string | null,
  bid_value: null as number | null,
}

describe('shouldShowEmptyBidValueAlert', () => {
  it('true when sent + no outcome + no value (the canonical case)', () => {
    expect(shouldShowEmptyBidValueAlert(base)).toBe(true)
  })

  it('false when not sent yet', () => {
    expect(shouldShowEmptyBidValueAlert({ ...base, bid_date_sent: null })).toBe(false)
    expect(shouldShowEmptyBidValueAlert({ ...base, bid_date_sent: '' })).toBe(false)
    expect(shouldShowEmptyBidValueAlert({ ...base, bid_date_sent: '   ' })).toBe(false)
  })

  it('false when outcome is won', () => {
    expect(shouldShowEmptyBidValueAlert({ ...base, outcome: 'won' })).toBe(false)
  })

  it('false when outcome is lost', () => {
    expect(shouldShowEmptyBidValueAlert({ ...base, outcome: 'lost' })).toBe(false)
  })

  it('false when outcome is started_or_complete', () => {
    expect(shouldShowEmptyBidValueAlert({ ...base, outcome: 'started_or_complete' })).toBe(false)
  })

  it('true when outcome is a non-terminal value (e.g. submitted)', () => {
    expect(shouldShowEmptyBidValueAlert({ ...base, outcome: 'submitted' })).toBe(true)
  })

  it('false when bid_value is a positive number', () => {
    expect(shouldShowEmptyBidValueAlert({ ...base, bid_value: 30000 })).toBe(false)
  })

  it('true when bid_value is zero', () => {
    expect(shouldShowEmptyBidValueAlert({ ...base, bid_value: 0 })).toBe(true)
  })

  it('true when bid_value is a non-finite number (defensive)', () => {
    expect(shouldShowEmptyBidValueAlert({ ...base, bid_value: Number.NaN })).toBe(true)
  })

  it('true when bid_value is a negative number (defensive)', () => {
    expect(shouldShowEmptyBidValueAlert({ ...base, bid_value: -10 })).toBe(true)
  })

  it('handles string bid_value: empty / whitespace / unparseable = true', () => {
    expect(shouldShowEmptyBidValueAlert({ ...base, bid_value: '' })).toBe(true)
    expect(shouldShowEmptyBidValueAlert({ ...base, bid_value: '   ' })).toBe(true)
    expect(shouldShowEmptyBidValueAlert({ ...base, bid_value: 'abc' })).toBe(true)
  })

  it('handles string bid_value: parseable positive = false', () => {
    expect(shouldShowEmptyBidValueAlert({ ...base, bid_value: '30000' })).toBe(false)
    expect(shouldShowEmptyBidValueAlert({ ...base, bid_value: '0' })).toBe(true)
  })
})
