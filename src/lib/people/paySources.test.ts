import { describe, expect, it } from 'vitest'

import { cashAppPaymentMemo } from '../cashapp/cashAppDecisions'
import {
  PAY_SEND_AUTOCORRECT_USD,
  PAY_SOURCE_KINDS,
  isPaySourceKind,
  parsePaySendPart,
  paySendMemo,
  paySendPartMemo,
  paySourceLabel,
  stripPaySendPart,
  withinPaySendAutocorrect,
} from './paySources'

describe('paySources (v2.3578 · Apple Pay and the part memo v2.3580)', () => {
  it('names the five kinds and recognises them', () => {
    expect(PAY_SOURCE_KINDS).toEqual(['cashapp', 'mercury', 'apple_pay', 'client_direct', 'other'])
    expect(isPaySourceKind('apple_pay')).toBe(true)
    expect(isPaySourceKind('venmo')).toBe(false)
    expect(isPaySourceKind(null)).toBe(false)
    expect(paySourceLabel('apple_pay')).toBe('Apple Pay')
    expect(paySourceLabel('client_direct')).toBe('Client direct')
    expect(paySourceLabel(null)).toBe('')
  })

  it('writes the Cash App memo the reconcile matcher already reads (rule a)', () => {
    expect(paySendMemo('cashapp', '#D-E5D2547JO', 'Advance')).toBe(cashAppPaymentMemo('#D-E5D2547JO', 'Advance'))
    expect(paySendMemo('cashapp', '#D-E5D2547JO', '  ')).toBe(cashAppPaymentMemo('#D-E5D2547JO', ''))
    expect(paySendMemo('cashapp', '#D-E5D2547JO', 'Advance')).toBe('Cash App #D-E5D2547JO "Advance"')
  })

  it('names the channel for the other kinds and drops an empty note', () => {
    expect(paySendMemo('mercury', 'a1b2', 'Week')).toBe('Mercury "Week"')
    expect(paySendMemo('mercury', 'a1b2', null)).toBe('Mercury')
    expect(paySendMemo('apple_pay', 'a1b2', 'Tristen')).toBe('Apple Pay "Tristen"')
    expect(paySendMemo('client_direct', null, 'Paid via Client Mehow')).toBe('Client direct "Paid via Client Mehow"')
    expect(paySendMemo('other', null, 'cash')).toBe('Payment "cash"')
  })

  it('the part memo: the same string SQL writes, parsed back, stripped, and never doubled', () => {
    const one = paySendPartMemo('Apple Pay "Tristen"', 1, 2, 1067.23)
    expect(one).toBe('Apple Pay "Tristen" · 1 of 2 from $1,067.23')
    expect(paySendPartMemo('Cash App #D-E5D2547JO "Advance"', 2, 2, 700)).toBe('Cash App #D-E5D2547JO "Advance" · 2 of 2 from $700.00')
    expect(parsePaySendPart(one)).toEqual({ part: 1, of: 2, total: 1067.23 })
    expect(parsePaySendPart('Apple Pay "Tristen"')).toBeNull()
    expect(stripPaySendPart(one)).toBe('Apple Pay "Tristen"')
    expect(stripPaySendPart(null)).toBe('')
    // restamping replaces a stale suffix instead of appending a second one
    expect(paySendPartMemo(one, 1, 3, 1500)).toBe('Apple Pay "Tristen" · 1 of 3 from $1,500.00')
  })

  it('auto-corrects within five dollars, inclusive, and not beyond', () => {
    expect(PAY_SEND_AUTOCORRECT_USD).toBe(5)
    expect(withinPaySendAutocorrect(394.63, 349.63)).toBe(false) // the $45 short one goes to Review
    expect(withinPaySendAutocorrect(535.22, 532.22)).toBe(true) // the $3 one corrects
    expect(withinPaySendAutocorrect(505, 500)).toBe(true)
    expect(withinPaySendAutocorrect(505.01, 500)).toBe(false)
    expect(withinPaySendAutocorrect(537.99, 538)).toBe(true)
  })
})
