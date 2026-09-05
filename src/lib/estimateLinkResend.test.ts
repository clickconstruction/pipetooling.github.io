import { describe, expect, it } from 'vitest'
import {
  canResendEstimateLink,
  estimateLinkResendBlockMessage,
  rewriteEstimateAcceptUrl,
  type EstimateLinkResendBlockReason,
} from '../../supabase/functions/_shared/estimateLinkResend'

// Noon Central, well inside a single civil day in America/Chicago.
const NOW = new Date('2026-09-05T17:00:00Z')
const SENT_AT = '2026-08-29T14:03:00Z'

/** Shared predicate behind the "Resend link" button and send-estimate-to-customer mode=resend (J17-F2/N3). */
describe('_shared/estimateLinkResend canResendEstimateLink', () => {
  it('allows a sent estimate with a send on record', () => {
    expect(canResendEstimateLink('sent', SENT_AT, NOW)).toEqual({ ok: true })
  })

  it('does not treat an expired 14-day token as a blocker — that is what a resend fixes', () => {
    // No token expiry is passed at all: the predicate never reads it.
    expect(canResendEstimateLink('sent', '2026-01-02T00:00:00Z', NOW)).toEqual({ ok: true })
  })

  it('allows pricing that is good through today (company calendar), blocks yesterday', () => {
    expect(canResendEstimateLink('sent', SENT_AT, NOW, { validUntil: '2026-09-05' })).toEqual({ ok: true })
    expect(canResendEstimateLink('sent', SENT_AT, NOW, { validUntil: '2026-12-31' })).toEqual({ ok: true })
    expect(canResendEstimateLink('sent', SENT_AT, NOW, { validUntil: '2026-09-04' })).toEqual({
      ok: false,
      reason: 'pricing_expired',
    })
  })

  it('compares valid_until on the Central civil day, not the UTC day', () => {
    // 11 PM Central on Sep 4 is already Sep 5 in UTC; pricing good through Sep 4 is still good.
    const lateEvening = new Date('2026-09-05T04:00:00Z')
    expect(canResendEstimateLink('sent', SENT_AT, lateEvening, { validUntil: '2026-09-04' })).toEqual({ ok: true })
  })

  it('ignores a malformed valid_until', () => {
    expect(canResendEstimateLink('sent', SENT_AT, NOW, { validUntil: 'soon' })).toEqual({ ok: true })
    expect(canResendEstimateLink('sent', SENT_AT, NOW, { validUntil: '' })).toEqual({ ok: true })
    expect(canResendEstimateLink('sent', SENT_AT, NOW, { validUntil: null })).toEqual({ ok: true })
  })

  it('refuses every non-sent status with a named reason', () => {
    expect(canResendEstimateLink('draft', null, NOW)).toEqual({ ok: false, reason: 'draft' })
    expect(canResendEstimateLink('customer_accepted', SENT_AT, NOW)).toEqual({ ok: false, reason: 'accepted' })
    expect(canResendEstimateLink('declined', SENT_AT, NOW)).toEqual({ ok: false, reason: 'declined' })
    expect(canResendEstimateLink('superseded', SENT_AT, NOW)).toEqual({ ok: false, reason: 'superseded' })
    expect(canResendEstimateLink('bogus', SENT_AT, NOW)).toEqual({ ok: false, reason: 'unknown_status' })
    expect(canResendEstimateLink(null, SENT_AT, NOW)).toEqual({ ok: false, reason: 'unknown_status' })
    expect(canResendEstimateLink(undefined, SENT_AT, NOW)).toEqual({ ok: false, reason: 'unknown_status' })
  })

  it('refuses a sent row with no usable sent_at', () => {
    expect(canResendEstimateLink('sent', null, NOW)).toEqual({ ok: false, reason: 'never_sent' })
    expect(canResendEstimateLink('sent', '', NOW)).toEqual({ ok: false, reason: 'never_sent' })
    expect(canResendEstimateLink('sent', 'not a date', NOW)).toEqual({ ok: false, reason: 'never_sent' })
  })

  it('refuses a change order that lives in a bid room', () => {
    expect(canResendEstimateLink('sent', SENT_AT, NOW, { inBidRoom: true })).toEqual({ ok: false, reason: 'bid_room' })
    expect(canResendEstimateLink('sent', SENT_AT, NOW, { inBidRoom: false })).toEqual({ ok: true })
  })

  it('has one office-worded sentence per block reason', () => {
    const reasons: EstimateLinkResendBlockReason[] = [
      'draft',
      'accepted',
      'declined',
      'superseded',
      'never_sent',
      'pricing_expired',
      'bid_room',
      'unknown_status',
    ]
    const seen = new Set<string>()
    for (const r of reasons) {
      const msg = estimateLinkResendBlockMessage(r)
      expect(msg.length).toBeGreaterThan(20)
      expect(seen.has(msg)).toBe(false)
      seen.add(msg)
    }
    expect(estimateLinkResendBlockMessage('pricing_expired')).toMatch(/new estimate/i)
    expect(estimateLinkResendBlockMessage('declined')).toMatch(/new estimate/i)
  })
})

describe('_shared/estimateLinkResend rewriteEstimateAcceptUrl', () => {
  const OLD = 'https://pipetooling.com/estimate/accept?t=0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9'
  const NEW = 'https://pipetooling.com/estimate/accept?t=ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

  it('swaps every stored accept URL for the fresh one (the snapshot holds it twice)', () => {
    const body = `Please review and accept your estimate.\n\nOpen this link:\n${OLD}\n\nOr ${OLD}\n\nThank you.`
    const out = rewriteEstimateAcceptUrl(body, NEW)
    expect(out).not.toContain(OLD)
    expect(out.split(NEW).length - 1).toBe(2)
    expect(out.startsWith('Please review and accept your estimate.')).toBe(true)
    expect(out.endsWith('Thank you.')).toBe(true)
  })

  it('handles a different origin, an encoded token and a URL glued to punctuation', () => {
    const body = `See (http://localhost:5173/estimate/accept?t=abc%2Fdef-123_x.y~z) today.`
    expect(rewriteEstimateAcceptUrl(body, NEW)).toBe(`See (${NEW}) today.`)
  })

  it('leaves a body with no accept URL untouched (org template omitted {{accept_url}})', () => {
    const body = 'Thanks for choosing us.\n\nCall with questions.'
    expect(rewriteEstimateAcceptUrl(body, NEW)).toBe(body)
    expect(rewriteEstimateAcceptUrl('', NEW)).toBe('')
  })

  it('does not touch other app links', () => {
    const body = `Terms: https://pipetooling.com/estimate/terms and portal https://my.clickplumbing.com/x?t=1`
    expect(rewriteEstimateAcceptUrl(body, NEW)).toBe(body)
  })
})
