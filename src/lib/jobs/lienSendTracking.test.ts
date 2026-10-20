import { describe, expect, it } from 'vitest'
import { parseLienSends, sendNeedsTracking, sendTrackingComing, sendsTrackingComing, sendsTrackingOwed, withTracking } from './lienSendTracking'

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

  it('a blank number on a send a provider carries is coming, not owed; once the number lands it is neither (the Docsmit train, PR 1)', () => {
    const viaDocsmit = { recipient: 'owner', method: 'certified_mail', tracking: '', via: 'docsmit', piece_id: 'p1' }
    expect(sendTrackingComing(viaDocsmit)).toBe(true)
    expect(sendNeedsTracking(viaDocsmit)).toBe(false)
    expect(sendTrackingComing({ ...viaDocsmit, tracking: '9407' })).toBe(false)
    expect(sendTrackingComing({ ...viaDocsmit, piece_id: '' })).toBe(false)
    expect(sendNeedsTracking({ ...viaDocsmit, piece_id: '' })).toBe(true)
    expect(sendTrackingComing({ ...viaDocsmit, method: 'email' })).toBe(false)
    const raw = [...sends, viaDocsmit, { recipient: 'original_contractor', method: 'certified_mail', tracking: '', via: 7, piece_id: 'p2' }]
    expect(parseLienSends(raw)[4]).toEqual(viaDocsmit)
    expect(parseLienSends(raw)[5]).toEqual({ recipient: 'original_contractor', method: 'certified_mail', tracking: '', sent_on: undefined, piece_id: 'p2' })
    expect(sendsTrackingComing(raw).map((s) => s.piece_id)).toEqual(['p1'])
    expect(sendsTrackingOwed(raw).map((s) => s.recipient)).toEqual(['owner', 'original_contractor'])
    expect(withTracking(raw, 'owner', '9407 1118 2222 3333 4444')[4]).toEqual({ ...viaDocsmit, tracking: '9407 1118 2222 3333 4444' })
  })
})
