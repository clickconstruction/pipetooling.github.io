import { describe, expect, it } from 'vitest'
import { getSubmissionSectionKey } from './submissionSections'

describe('getSubmissionSectionKey — which pile a bid sits in', () => {
  it('an outcome decides the pile, sent or not', () => {
    expect(getSubmissionSectionKey({ outcome: 'won', bid_date_sent: '2026-09-01' })).toBe('won')
    expect(getSubmissionSectionKey({ outcome: 'won', bid_date_sent: null })).toBe('won')
    expect(getSubmissionSectionKey({ outcome: 'started_or_complete', bid_date_sent: null })).toBe('startedOrComplete')
    expect(getSubmissionSectionKey({ outcome: 'lost', bid_date_sent: '2026-09-01' })).toBe('lost')
    expect(getSubmissionSectionKey({ outcome: 'lost', bid_date_sent: null })).toBe('lost')
  })

  it('no outcome and no sent date is unsent', () => {
    expect(getSubmissionSectionKey({ outcome: null, bid_date_sent: null })).toBe('unsent')
    expect(getSubmissionSectionKey({ outcome: null, bid_date_sent: '' })).toBe('unsent')
  })

  it('no outcome and a sent date is pending', () => {
    expect(getSubmissionSectionKey({ outcome: null, bid_date_sent: '2026-09-01' })).toBe('pending')
  })

  it('an outcome it does not know falls through to the sent date', () => {
    expect(getSubmissionSectionKey({ outcome: 'withdrawn', bid_date_sent: '2026-09-01' })).toBe('pending')
    expect(getSubmissionSectionKey({ outcome: '', bid_date_sent: null })).toBe('unsent')
  })

  it('always names a pile', () => {
    for (const outcome of [null, '', 'won', 'lost', 'started_or_complete', 'other']) {
      for (const bid_date_sent of [null, '', '2026-09-01']) {
        expect(getSubmissionSectionKey({ outcome, bid_date_sent })).not.toBeNull()
      }
    }
  })
})
