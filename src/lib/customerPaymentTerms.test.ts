import { describe, expect, it } from 'vitest'
import type { CustomerPromiseRecord } from './jobs/paymentPromises'
import { customerTermsWarning, isCustomerPaymentTerms, parseCustomerTerms, paymentTermsLabel } from './customerPaymentTerms'

const record = (over: Partial<CustomerPromiseRecord> = {}): CustomerPromiseRecord => ({
  customerId: 'c', decided: 5, kept: 1, late: 2, broken: 2, open: 0, keptRate: 0.2, usualSlipDays: 23, rePromised: 1, openBroken: 1, lastPromisedYmd: '2026-09-05', ...over,
})

describe('parseCustomerTerms', () => {
  it('reads the columns and defaults a missing or unknown value to standard', () => {
    expect(parseCustomerTerms({ payment_terms: 'deposit_required', payment_terms_note: ' ask Malachi ', payment_terms_set_at: '2026-09-11T00:00:00Z' }, 'Robert')).toEqual({
      terms: 'deposit_required', note: 'ask Malachi', setByName: 'Robert', setAt: '2026-09-11T00:00:00Z',
    })
    expect(parseCustomerTerms({ payment_terms: 'sideways' })).toMatchObject({ terms: 'standard', note: null })
    expect(parseCustomerTerms(null)).toMatchObject({ terms: 'standard' })
    expect(isCustomerPaymentTerms('winding_down')).toBe(true)
    expect(isCustomerPaymentTerms('closed')).toBe(false)
    expect(paymentTermsLabel('no_new_work_past_promise')).toBe('No new work past an unpaid promise')
  })
})

describe('customerTermsWarning', () => {
  it('is silent for standard terms with nothing broken', () => {
    expect(customerTermsWarning({ terms: 'standard', note: null, setByName: null, setAt: null }, null)).toBeNull()
    expect(customerTermsWarning(null, record({ openBroken: 0 }))).toBeNull()
  })
  it('warns on standard terms when a promise is broken right now', () => {
    const w = customerTermsWarning(null, record())!
    expect(w.severity).toBe('warn')
    expect(w.headline).toMatch(/promise is broken/)
    expect(w.detail).toBe('keeps 1 of 5 · slips ~23d · 1 bill open past promise')
  })
  it('deposit required is a warning; winding down is a stop', () => {
    expect(customerTermsWarning({ terms: 'deposit_required', note: 'half up front', setByName: null, setAt: null }, null)).toMatchObject({ severity: 'warn', headline: 'Deposit required before work starts', detail: '', note: 'half up front' })
    expect(customerTermsWarning({ terms: 'winding_down', note: null, setByName: null, setAt: null }, null)!.severity).toBe('stop')
  })
  it('no-new-work escalates to a stop only while a promise is broken', () => {
    const terms = { terms: 'no_new_work_past_promise' as const, note: null, setByName: null, setAt: null }
    expect(customerTermsWarning(terms, record({ openBroken: 0 }))!.severity).toBe('warn')
    const stop = customerTermsWarning(terms, record({ openBroken: 2 }))!
    expect(stop.severity).toBe('stop')
    expect(stop.detail).toMatch(/2 bills open past promise/)
  })
})
