import { describe, expect, it } from 'vitest'
import {
  arCloseOutReady,
  arCloseReasonLabel,
  buildArCloseOutOffer,
  describeArCloseOut,
  suggestArCloseReason,
} from './arCloseOut'

describe('buildArCloseOutOffer', () => {
  it('offers on an untouched deposit with money on it, for the whole remainder', () => {
    const o = buildArCloseOutOffer({ remaining: 312.48, consumed: 0 })
    expect(o).not.toBeNull()
    expect(o!.amount).toBe(312.48)
    expect(o!.buttonLabel).toBe('Close out $312.48')
    expect(o!.headline).toBe('Not a customer’s payment?')
  })

  it('never offers once money from the deposit is on a job — that is the tip strip', () => {
    expect(buildArCloseOutOffer({ remaining: 50, consumed: 1805.7 })).toBeNull()
  })

  it('never offers on a returned, already-closed, or fully applied deposit', () => {
    expect(buildArCloseOutOffer({ remaining: 100, consumed: 0, returned: true })).toBeNull()
    expect(buildArCloseOutOffer({ remaining: 100, consumed: 0, closed: true })).toBeNull()
    expect(buildArCloseOutOffer({ remaining: 0, consumed: 0 })).toBeNull()
    expect(buildArCloseOutOffer({ remaining: 0.0004, consumed: 0 })).toBeNull()
  })

  it('suggests a reason from the bank text', () => {
    expect(buildArCloseOutOffer({ remaining: 3.12, consumed: 0, memo: 'INTEREST PAYMENT' })!.suggestedReason).toBe('bank_interest')
    expect(buildArCloseOutOffer({ remaining: 312.48, consumed: 0, counterpartyName: 'Ferguson Enterprises', memo: 'REFUND INV 8842710 RETURN' })!.suggestedReason).toBe('vendor_refund')
    expect(buildArCloseOutOffer({ remaining: 5000, consumed: 0, counterpartyName: 'Elaine Giesber' })!.suggestedReason).toBeNull()
  })
})

describe('suggestArCloseReason', () => {
  it('reads owner contributions', () => {
    expect(suggestArCloseReason({ note: 'Owner capital contribution' })).toBe('owner_deposit')
  })
  it('does not read "interested" as interest', () => {
    expect(suggestArCloseReason({ note: 'interested party' })).toBeNull()
  })
})

describe('arCloseOutReady', () => {
  it('needs a listed reason, and a note only for Something else', () => {
    expect(arCloseOutReady(null, '')).toBe(false)
    expect(arCloseOutReady('bank_interest', '')).toBe(true)
    expect(arCloseOutReady('other', '')).toBe(false)
    expect(arCloseOutReady('other', 'Insurance payout')).toBe(true)
    expect(arCloseOutReady('bogus', 'x')).toBe(false)
  })
})

describe('describeArCloseOut / arCloseReasonLabel', () => {
  const fmt = () => 'Sep 16, 2026'
  it('names the reason and the day, and carries the note only for Something else', () => {
    expect(describeArCloseOut({ mercury_transaction_id: 'x', reason: 'vendor_refund', note: 'Ferguson', closed_at: '2026-09-16T20:00:00Z', closed_by: null }, fmt)).toBe('Vendor refund · Sep 16, 2026')
    expect(describeArCloseOut({ mercury_transaction_id: 'x', reason: 'other', note: 'Insurance payout', closed_at: '2026-09-16T20:00:00Z', closed_by: null }, fmt)).toBe('Something else — Insurance payout · Sep 16, 2026')
  })
  it('falls back to a plain label for an unknown reason', () => {
    expect(arCloseReasonLabel('mystery')).toBe('Closed out')
  })
})
