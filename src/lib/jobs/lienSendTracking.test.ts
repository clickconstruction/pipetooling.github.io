import { describe, expect, it } from 'vitest'
import { parseLienSends, sendNeedsTracking, sendsTrackingOwed, withTracking } from './lienSendTracking'

describe('lien send tracking (v2.4119)', () => {
  const sends = [
    { recipient: 'owner', method: 'certified_mail', tracking: '', sent_on: '2026-09-29' },
    { recipient: 'original_contractor', method: 'certified_mail', tracking: '9407 1118 9876 5432 1098', sent_on: '2026-09-29' },
    { recipient: 'owner', method: 'email', tracking: 'resend:abc → x@y.test' },
    { recipient: 'owner', method: 'hand', tracking: '' },
    'junk',
    { recipient: 7 },
  ]
  it('a certified or courier send with a blank number owes one; email and hand never do', () => {
    expect(sendNeedsTracking({ method: 'certified_mail', tracking: '' })).toBe(true)
    expect(sendNeedsTracking({ method: 'traceable_courier', tracking: '  ' })).toBe(true)
    expect(sendNeedsTracking({ method: 'certified_mail', tracking: '9407' })).toBe(false)
    expect(sendNeedsTracking({ method: 'email', tracking: '' })).toBe(false)
    expect(sendNeedsTracking({ method: 'hand', tracking: '' })).toBe(false)
  })
  it('parses the filing JSON, skipping what is not a send', () => {
    expect(parseLienSends(sends)).toHaveLength(4)
    expect(parseLienSends(null)).toEqual([])
    expect(sendsTrackingOwed(sends).map((s) => s.recipient)).toEqual(['owner'])
  })
  it('withTracking fills one recipient and leaves the rest', () => {
    const next = withTracking(sends, 'owner', ' 9407 1118 0000 0000 0000 ')
    expect(next[0]).toMatchObject({ recipient: 'owner', tracking: '9407 1118 0000 0000 0000' })
    expect(next[1]!.tracking).toBe('9407 1118 9876 5432 1098')
    expect(sendsTrackingOwed(next)).toEqual([])
  })
})
