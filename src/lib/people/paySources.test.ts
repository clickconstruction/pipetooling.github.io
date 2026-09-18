import { describe, expect, it } from 'vitest'

import { cashAppPaymentMemo } from '../cashapp/cashAppDecisions'
import { PAY_SEND_AUTOCORRECT_USD, PAY_SOURCE_KINDS, isPaySourceKind, paySendMemo, paySourceLabel, withinPaySendAutocorrect } from './paySources'

describe('paySources (v2.3578)', () => {
  it('names the four kinds and recognises them', () => {
    expect(PAY_SOURCE_KINDS).toEqual(['cashapp', 'mercury', 'client_direct', 'other'])
    expect(isPaySourceKind('mercury')).toBe(true)
    expect(isPaySourceKind('venmo')).toBe(false)
    expect(isPaySourceKind(null)).toBe(false)
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
    expect(paySendMemo('client_direct', null, 'Paid via Client Mehow')).toBe('Client direct "Paid via Client Mehow"')
    expect(paySendMemo('other', null, 'cash')).toBe('Payment "cash"')
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
