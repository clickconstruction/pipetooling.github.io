import { describe, expect, it } from 'vitest'

import { cashAppPaymentMemo } from '../cashapp/cashAppDecisions'
import {
  PAY_SEND_AUTOCORRECT_USD,
  PAY_SOURCE_KINDS,
  isPaySourceDuplicateError,
  isPaySourceKind,
  normalizeCashAppId,
  PAY_SOURCE_DUPLICATE_MESSAGE,
  paySourceKindFromMemo,
  paySourceWrite,
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

describe('the Record payment doors (v2.3717)', () => {
  it('normalises a typed Cash App id to the shape the matcher reads', () => {
    expect(normalizeCashAppId(' d-3v3mvpkvp ')).toBe('#D-3V3MVPKVP')
    expect(normalizeCashAppId('#D-3V3MVPKVP')).toBe('#D-3V3MVPKVP')
    expect(normalizeCashAppId('   ')).toBeNull()
    expect(normalizeCashAppId(null)).toBeNull()
  })

  it('writes the columns and the memo for a chosen method, and nothing but the note without one', () => {
    expect(paySourceWrite('cashapp', 'd-3v3mvpkvp', 'Week')).toEqual({ source_kind: 'cashapp', source_id: '#D-3V3MVPKVP', memo: 'Cash App #D-3V3MVPKVP "Week"' })
    expect(paySourceWrite('cashapp', '', '')).toEqual({ source_kind: 'cashapp', source_id: null, memo: 'Cash App' })
    expect(paySourceWrite('mercury', '#D-IGNORED', 'Week')).toEqual({ source_kind: 'mercury', source_id: null, memo: 'Mercury "Week"' })
    expect(paySourceWrite('other', null, 'check 1044')).toEqual({ source_kind: 'other', source_id: null, memo: 'Payment "check 1044"' })
    expect(paySourceWrite(null, '#D-3V3MVPKVP', ' cash off a job ')).toEqual({ source_kind: null, source_id: null, memo: 'cash off a job' })
    expect(paySourceWrite(null, null, '')).toEqual({ source_kind: null, source_id: null, memo: null })
  })

  it('recognises the per-report unique index in any error shape', () => {
    expect(isPaySourceDuplicateError(new Error('duplicate key value violates unique constraint "pay_stub_payments_source_per_report_uidx"'))).toBe(true)
    expect(isPaySourceDuplicateError({ message: 'pay_stub_payments_source_per_report_uidx' })).toBe(true)
    expect(isPaySourceDuplicateError(new Error('payment exceeds net'))).toBe(false)
    expect(isPaySourceDuplicateError(null)).toBe(false)
    expect(PAY_SOURCE_DUPLICATE_MESSAGE).toMatch(/already recorded/)
  })

  it('reads a method off a memo written before the column, in the five kinds\' vocabulary', () => {
    expect(paySourceKindFromMemo('Cash App #D-P7PRK45K6')).toBe('cashapp')
    expect(paySourceKindFromMemo('CashApp')).toBe('cashapp')
    expect(paySourceKindFromMemo('cashapp advance')).toBe('cashapp')
    expect(paySourceKindFromMemo('Mercury')).toBe('mercury')
    expect(paySourceKindFromMemo('Apple Pay "Tristen" · 2 of 2 from $1,067.23')).toBe('apple_pay')
    expect(paySourceKindFromMemo('apple cash')).toBe('apple_pay')
    expect(paySourceKindFromMemo('Paid via Client Mehow')).toBe('client_direct')
    expect(paySourceKindFromMemo('Check 1044')).toBeNull()
    expect(paySourceKindFromMemo('1190-781.91=408.09 remaining from client to be applied')).toBeNull()
    expect(paySourceKindFromMemo(null)).toBeNull()
  })
})
