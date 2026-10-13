import { describe, expect, it } from 'vitest'
import { docsmitSendType, mailClientMsgId, mailEnvelopeFor, mailSendBy, mailSendIsLate, mailStatusFromProvider, mailStatusOpen, parseMailClientMsgId } from './mailPiece'

describe('a mail piece’s rules (the Docsmit train, PR 1)', () => {
  it('the envelope by sheet count: a #10 to 5, a flat to 47, held past that; double-sided halves the sheets', () => {
    expect(mailEnvelopeFor(3)).toEqual({ envelope: '#10', sheets: 3, problem: null })
    expect(mailEnvelopeFor(5)).toEqual({ envelope: '#10', sheets: 5, problem: null })
    expect(mailEnvelopeFor(14)).toEqual({ envelope: 'Flat', sheets: 14, problem: null })
    expect(mailEnvelopeFor(47)).toEqual({ envelope: 'Flat', sheets: 47, problem: null })
    expect(mailEnvelopeFor(48).problem).toMatch(/48 sheets is more than a flat holds/)
    expect(mailEnvelopeFor(9, 2)).toEqual({ envelope: '#10', sheets: 5, problem: null })
    expect(mailEnvelopeFor(0).problem).toMatch(/no pages/)
  })

  it('the send type the owner chose, and our key on the message', () => {
    expect(docsmitSendType('electronic')).toBe('Certified, Electronic Return Receipt')
    expect(docsmitSendType('card')).toBe('Certified, Return Receipt')
    expect(mailClientMsgId('lien_notice_53_056', 'abc')).toBe('lien_notice_53_056:abc')
    expect(parseMailClientMsgId('lien_notice_53_056:abc')).toEqual({ kind: 'lien_notice_53_056', pieceId: 'abc' })
    expect(parseMailClientMsgId('nope')).toBeNull()
    expect(parseMailClientMsgId(':x')).toBeNull()
  })

  it('folds what the provider says into our statuses, and sends an unknown string to the needs-a-person bucket', () => {
    expect(mailStatusFromProvider({ sent: false, tracking: null, deliveryStatus: null })).toBe('prepared')
    expect(mailStatusFromProvider({ sent: true, tracking: null, deliveryStatus: null })).toBe('sent')
    expect(mailStatusFromProvider({ sent: true, tracking: '9407', deliveryStatus: null })).toBe('mailed')
    expect(mailStatusFromProvider({ sent: true, tracking: '9407', deliveryStatus: 'In Transit to Next Facility' })).toBe('in_transit')
    expect(mailStatusFromProvider({ sent: true, tracking: '9407', deliveryStatus: 'Arrived at Post Office' })).toBe('in_transit')
    expect(mailStatusFromProvider({ sent: true, tracking: '9407', deliveryStatus: 'Notice Left (No Authorized Recipient Available)' })).toBe('notice_left')
    expect(mailStatusFromProvider({ sent: true, tracking: '9407', deliveryStatus: 'Delivered, Left with Individual' })).toBe('delivered')
    expect(mailStatusFromProvider({ sent: true, tracking: '9407', deliveryStatus: 'Unclaimed/Being Returned to Sender' })).toBe('returned')
    expect(mailStatusFromProvider({ sent: true, tracking: '9407', deliveryStatus: 'Something new' })).toBe('unknown')
    expect(mailStatusFromProvider({ sent: true, tracking: '9407', deliveryStatus: 'In Transit', deliveredEvent: true })).toBe('delivered')
    expect(mailStatusOpen('in_transit')).toBe(true)
    expect(mailStatusOpen('delivered')).toBe(false)
    expect(mailStatusOpen('unknown')).toBe(true)
  })

  it('the send-by day is the window’s last day less the buffer in business days, at the cutoff; late past it', () => {
    // 2026-10-15 is a Thursday.
    expect(mailSendBy('2026-10-15', { bufferBusinessDays: 1, cutoffLocal: '15:00' })).toEqual({ ymd: '2026-10-14', cutoffLocal: '15:00', words: 'Send to Docsmit by 2026-10-14 at 3:00 pm' })
    // 2026-10-19 is a Monday: two business days back is Thursday the 15th.
    expect(mailSendBy('2026-10-19', { bufferBusinessDays: 2, cutoffLocal: '15:00' }).ymd).toBe('2026-10-15')
    expect(mailSendBy('2026-10-15', { bufferBusinessDays: 0, cutoffLocal: '09:30' }).words).toBe('Send to Docsmit by 2026-10-15 at 9:30 am')
    const by = { ymd: '2026-10-14', cutoffLocal: '15:00' }
    expect(mailSendIsLate('2026-10-13', '16:10', by)).toBe(false)
    expect(mailSendIsLate('2026-10-14', '14:59', by)).toBe(false)
    expect(mailSendIsLate('2026-10-14', '15:00', by)).toBe(true)
    expect(mailSendIsLate('2026-10-15', '08:00', by)).toBe(true)
  })
})
