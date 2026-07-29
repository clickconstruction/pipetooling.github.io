import { describe, expect, it } from 'vitest'
import {
  applyBillToToJobBillingContext,
  billToDisplayLabel,
  billToUpdatePayload,
  invoiceBillToFromRow,
  validateBillToDraft,
} from './invoiceBillTo'

describe('invoiceBillToFromRow', () => {
  it('returns null when there is no email (name/phone alone never activate the override)', () => {
    expect(invoiceBillToFromRow(null)).toBeNull()
    expect(invoiceBillToFromRow({})).toBeNull()
    expect(invoiceBillToFromRow({ bill_to_email: '   ' })).toBeNull()
    expect(invoiceBillToFromRow({ bill_to_name: 'Jane Tenant', bill_to_phone: '555-1234' })).toBeNull()
  })

  it('trims fields and nulls blank name/phone', () => {
    expect(
      invoiceBillToFromRow({ bill_to_name: ' Jane Tenant ', bill_to_email: ' jane@x.com ', bill_to_phone: '' }),
    ).toEqual({ name: 'Jane Tenant', email: 'jane@x.com', phone: null })
  })
})

describe('billToDisplayLabel', () => {
  it('shows name with email, or email alone', () => {
    expect(billToDisplayLabel({ name: 'Jane Tenant', email: 'jane@x.com', phone: null })).toBe(
      'Jane Tenant (jane@x.com)',
    )
    expect(billToDisplayLabel({ name: null, email: 'jane@x.com', phone: null })).toBe('jane@x.com')
  })
})

describe('applyBillToToJobBillingContext', () => {
  const job = {
    id: 'j1',
    customer_name: 'GC Builder',
    customer_email: 'gc@x.com',
    customer_phone: '555-0000',
  }

  it('returns the job unchanged with no override', () => {
    expect(applyBillToToJobBillingContext(job, null)).toBe(job)
  })

  it('overlays name/email and falls back to the job values for missing fields', () => {
    expect(applyBillToToJobBillingContext(job, { name: 'Jane Tenant', email: 'jane@x.com', phone: null })).toEqual({
      id: 'j1',
      customer_name: 'Jane Tenant',
      customer_email: 'jane@x.com',
      customer_phone: '555-0000',
    })
    expect(applyBillToToJobBillingContext(job, { name: null, email: 'jane@x.com', phone: '555-9999' })).toEqual({
      id: 'j1',
      customer_name: 'GC Builder',
      customer_email: 'jane@x.com',
      customer_phone: '555-9999',
    })
  })
})

describe('validateBillToDraft', () => {
  it('accepts an all-blank draft (clears the override)', () => {
    expect(validateBillToDraft({ name: '', email: '  ', phone: '' })).toBeNull()
  })

  it('requires an email once anything is filled', () => {
    expect(validateBillToDraft({ name: 'Jane', email: '', phone: '' })).toMatch(/email is required/i)
    expect(validateBillToDraft({ name: '', email: '', phone: '555' })).toMatch(/email is required/i)
  })

  it('rejects malformed emails and accepts valid ones', () => {
    expect(validateBillToDraft({ name: '', email: 'not-an-email', phone: '' })).toMatch(/valid email/i)
    expect(validateBillToDraft({ name: 'Jane', email: 'jane@x.com', phone: '' })).toBeNull()
  })
})

describe('billToUpdatePayload', () => {
  it('clears everything (incl. the per-invoice Stripe customer) when the email is blank', () => {
    expect(billToUpdatePayload({ name: 'Jane', email: '', phone: '555' })).toEqual({
      bill_to_name: null,
      bill_to_email: null,
      bill_to_phone: null,
      bill_to_stripe_customer_id: null,
    })
  })

  it('trims and nulls blanks; never touches the Stripe customer on a plain edit', () => {
    const p = billToUpdatePayload({ name: ' Jane Tenant ', email: ' jane@x.com ', phone: ' ' })
    expect(p).toEqual({ bill_to_name: 'Jane Tenant', bill_to_email: 'jane@x.com', bill_to_phone: null })
    expect('bill_to_stripe_customer_id' in p).toBe(false)
  })
})
