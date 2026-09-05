import { describe, expect, it } from 'vitest'
import {
  ESTIMATE_DECLINE_REASON_MAX,
  canDeclineEstimate,
  estimateDeclineBlockMessage,
  estimateDeclinedLabel,
  normalizeEstimateDeclineChannel,
  normalizeEstimateDeclineReason,
  parseEstimateDeclineMetadata,
} from '../../supabase/functions/_shared/estimateDecline'

describe('canDeclineEstimate', () => {
  it('only a sent estimate can be declined', () => {
    expect(canDeclineEstimate('sent')).toEqual({ ok: true })
    expect(canDeclineEstimate('draft')).toEqual({ ok: false, reason: 'draft' })
    expect(canDeclineEstimate('customer_accepted')).toEqual({ ok: false, reason: 'accepted' })
    expect(canDeclineEstimate('declined')).toEqual({ ok: false, reason: 'already_declined' })
    expect(canDeclineEstimate('superseded')).toEqual({ ok: false, reason: 'superseded' })
    expect(canDeclineEstimate(undefined)).toEqual({ ok: false, reason: 'unknown_status' })
  })

  it('every block reason has a sentence', () => {
    for (const r of ['draft', 'accepted', 'already_declined', 'superseded', 'unknown_status'] as const) {
      expect(estimateDeclineBlockMessage(r).length).toBeGreaterThan(10)
    }
  })
})

describe('normalizeEstimateDeclineReason', () => {
  it('trims, collapses whitespace, caps at the max', () => {
    expect(normalizeEstimateDeclineReason('  went with   another\n\nbid ')).toBe('went with another bid')
    expect(normalizeEstimateDeclineReason(42)).toBe('')
    expect(normalizeEstimateDeclineReason(null)).toBe('')
    const long = 'x'.repeat(ESTIMATE_DECLINE_REASON_MAX + 50)
    expect(normalizeEstimateDeclineReason(long)).toHaveLength(ESTIMATE_DECLINE_REASON_MAX)
  })
})

describe('decline metadata', () => {
  it('parses customer and staff shapes; unknown channels become other', () => {
    expect(parseEstimateDeclineMetadata({ by: 'customer', reason: 'too pricey' })).toEqual({ by: 'customer', note: 'too pricey' })
    expect(parseEstimateDeclineMetadata({ by: 'staff', note: 'called Tue', channel: 'phone', user_id: 'u1' })).toEqual({
      by: 'staff',
      note: 'called Tue',
      channel: 'phone',
      user_id: 'u1',
    })
    expect(parseEstimateDeclineMetadata({ by: 'staff', channel: 'carrier pigeon' })?.channel).toBe('other')
    expect(parseEstimateDeclineMetadata(null)).toBeNull()
    expect(parseEstimateDeclineMetadata([])).toBeNull()
    expect(normalizeEstimateDeclineChannel('in_person')).toBe('in_person')
  })

  it('labels say who said no', () => {
    expect(estimateDeclinedLabel(null)).toBe('Declined')
    expect(estimateDeclinedLabel({ by: 'customer', note: '' })).toBe('Declined by customer')
    expect(estimateDeclinedLabel({ by: 'staff', note: '', channel: 'phone' })).toBe('Declined — office heard it by phone')
    expect(estimateDeclinedLabel({ by: 'staff', note: '', channel: 'other' })).toBe('Declined — recorded by office')
  })
})
