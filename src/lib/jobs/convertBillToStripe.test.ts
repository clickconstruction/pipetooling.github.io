import { describe, it, expect } from 'vitest'
import {
  convertDueDateYmd,
  convertMemoLine,
  convertToStripeEligibility,
  formatConvertLongDate,
} from './convertBillToStripe'

const inv = (over: Partial<Parameters<typeof convertToStripeEligibility>[0]> = {}) => ({
  id: 'inv1',
  status: 'billed',
  stripe_invoice_id: null,
  external_send_channel: 'housecallpro',
  amount: 3840,
  ...over,
})

const job = (over: Partial<Parameters<typeof convertToStripeEligibility>[2]> = {}) => ({
  customer_id: 'c1',
  customer_email: 'billing@knight.com',
  ...over,
})

describe('convertToStripeEligibility', () => {
  it('allows a billed non-Stripe line with no payments and a billable customer', () => {
    expect(convertToStripeEligibility(inv(), [], job())).toEqual({ ok: true })
    expect(convertToStripeEligibility(inv({ external_send_channel: null }), [], job())).toEqual({ ok: true })
    expect(convertToStripeEligibility(inv({ external_send_channel: 'physical' }), [], job())).toEqual({ ok: true })
  })

  it('rejects drafts, paid lines, and existing Stripe bills', () => {
    expect(convertToStripeEligibility(inv({ status: 'ready_to_bill' }), [], job()).ok).toBe(false)
    expect(convertToStripeEligibility(inv({ status: 'paid' }), [], job()).ok).toBe(false)
    expect(convertToStripeEligibility(inv({ stripe_invoice_id: 'in_x' }), [], job()).ok).toBe(false)
    expect(convertToStripeEligibility(inv({ external_send_channel: 'stripe' }), [], job()).ok).toBe(false)
  })

  it('blocks when payments target this invoice (other invoices do not block)', () => {
    const r = convertToStripeEligibility(inv(), [{ invoice_id: 'inv1' }], job())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/unlink/i)
    expect(convertToStripeEligibility(inv(), [{ invoice_id: 'other' }, { invoice_id: null }], job()).ok).toBe(true)
  })

  it('requires a linked customer with an email', () => {
    expect(convertToStripeEligibility(inv(), [], job({ customer_id: null })).ok).toBe(false)
    expect(convertToStripeEligibility(inv(), [], job({ customer_email: '  ' })).ok).toBe(false)
  })

  it('requires a positive amount', () => {
    expect(convertToStripeEligibility(inv({ amount: 0 }), [], job()).ok).toBe(false)
    expect(convertToStripeEligibility(inv({ amount: null }), [], job()).ok).toBe(false)
  })
})

describe('due date + memo carry the original billed date', () => {
  it('uses the billed date as the Stripe due-date input, today as fallback', () => {
    expect(convertDueDateYmd('2026-07-06T14:03:00Z', '2026-08-21')).toBe('2026-07-06')
    expect(convertDueDateYmd(null, '2026-08-21')).toBe('2026-08-21')
    expect(convertDueDateYmd('garbage', '2026-08-21')).toBe('2026-08-21')
  })

  it('formats the long date TZ-safely and writes the memo line', () => {
    expect(formatConvertLongDate('2026-07-06T23:59:00Z')).toBe('July 6, 2026')
    expect(formatConvertLongDate(null)).toBeNull()
    expect(convertMemoLine('2026-07-06')).toBe('Originally billed July 6, 2026 — payment due on receipt.')
    expect(convertMemoLine(null)).toBe('Payment due on receipt.')
  })
})
