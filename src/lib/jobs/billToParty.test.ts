import { describe, expect, it } from 'vitest'
import {
  applyPayerToJobBillingContext,
  billPartyLabel,
  customerBillingEmail,
  effectiveInvoiceParty,
  jobBillToPartyOptions,
  parseJobBillToParty,
  payerCustomerId,
  payerRecipientFromCustomer,
  shouldDefaultBillsToGc,
} from './billToParty'

const gcJob = { bill_to_party: 'gc', gc_customer_id: 'gc-1', customer_id: 'cust-1' }
const customerJob = { bill_to_party: 'customer', gc_customer_id: 'gc-1', customer_id: 'cust-1' }
const splitJob = { bill_to_party: 'split', gc_customer_id: 'gc-1', customer_id: 'cust-1' }

describe('parseJobBillToParty', () => {
  it('defaults anything unknown to customer', () => {
    expect(parseJobBillToParty(null)).toBe('customer')
    expect(parseJobBillToParty('bogus')).toBe('customer')
    expect(parseJobBillToParty('gc')).toBe('gc')
    expect(parseJobBillToParty('split')).toBe('split')
  })
})

describe('effectiveInvoiceParty', () => {
  it('follows the job rule when the invoice has no pick', () => {
    expect(effectiveInvoiceParty(gcJob, {})).toBe('gc')
    expect(effectiveInvoiceParty(customerJob, {})).toBe('customer')
    expect(effectiveInvoiceParty(splitJob, {})).toBe('customer')
    expect(effectiveInvoiceParty(null, null)).toBe('customer')
  })

  it('lets the invoice pick override the job rule', () => {
    expect(effectiveInvoiceParty(customerJob, { bill_to_party: 'gc' })).toBe('gc')
    expect(effectiveInvoiceParty(gcJob, { bill_to_party: 'customer' })).toBe('customer')
    expect(effectiveInvoiceParty(splitJob, { bill_to_party: 'gc' })).toBe('gc')
  })

  it('a typed bill-to email wins over every party pick', () => {
    expect(effectiveInvoiceParty(gcJob, { bill_to_party: 'gc', bill_to_email: 'tenant@x.com' })).toBe('other')
    expect(effectiveInvoiceParty(gcJob, { bill_to_email: '   ' })).toBe('gc')
  })

  it('a GC pick on a job with no GC falls back to the customer', () => {
    const noGc = { bill_to_party: 'gc', gc_customer_id: null, customer_id: 'cust-1' }
    expect(effectiveInvoiceParty(noGc, {})).toBe('customer')
    expect(effectiveInvoiceParty(noGc, { bill_to_party: 'gc' })).toBe('customer')
  })
})

describe('payerCustomerId', () => {
  it('names the customers row that pays, or null for someone else', () => {
    expect(payerCustomerId(gcJob, 'gc')).toBe('gc-1')
    expect(payerCustomerId(gcJob, 'customer')).toBe('cust-1')
    expect(payerCustomerId(gcJob, 'other')).toBeNull()
    expect(payerCustomerId({ customer_id: null }, 'customer')).toBeNull()
  })
})

describe('customerBillingEmail', () => {
  it('prefers billing_email and falls back to the contact email', () => {
    expect(customerBillingEmail({ billing_email: ' ap@gc.com ', contact_info: { email: 'est@gc.com' } })).toBe('ap@gc.com')
    expect(customerBillingEmail({ billing_email: '', contact_info: { email: 'est@gc.com' } })).toBe('est@gc.com')
    expect(customerBillingEmail({ contact_info: 'not an object' })).toBe('')
    expect(customerBillingEmail(null)).toBe('')
  })
})

describe('payerRecipientFromCustomer', () => {
  it('builds the recipient a customer row is billed as', () => {
    expect(
      payerRecipientFromCustomer({
        id: 'gc-1',
        name: ' Loberg Contracting ',
        billing_email: 'invoices@loberg.com',
        contact_info: { email: 'estimating@loberg.com', phone: '847-392-4300' },
      }),
    ).toEqual({ customerId: 'gc-1', name: 'Loberg Contracting', email: 'invoices@loberg.com', phone: '847-392-4300' })
  })
  it('returns null without a row', () => {
    expect(payerRecipientFromCustomer(null)).toBeNull()
  })
})

describe('applyPayerToJobBillingContext', () => {
  const job = {
    customer_id: 'cust-1',
    customer_name: 'ATI Schertz',
    customer_email: 'invoices@loberg.com',
    customer_phone: null as string | null,
  }
  it('overlays the payer so every downstream consumer bills them', () => {
    expect(
      applyPayerToJobBillingContext(job, {
        customerId: 'gc-1',
        name: 'Loberg Contracting',
        email: 'invoices@loberg.com',
        phone: '847-392-4300',
      }),
    ).toEqual({
      customer_id: 'gc-1',
      customer_name: 'Loberg Contracting',
      customer_email: 'invoices@loberg.com',
      customer_phone: '847-392-4300',
    })
  })
  it('keeps the job context when no payer is given, and keeps the job phone when the payer has none', () => {
    expect(applyPayerToJobBillingContext(job, null)).toBe(job)
    expect(
      applyPayerToJobBillingContext({ ...job, customer_phone: '555' }, { customerId: 'gc-1', name: 'GC', email: 'a@b.c', phone: '' })
        .customer_phone,
    ).toBe('555')
  })
})

describe('jobBillToPartyOptions', () => {
  it('offers the GC only when the job has one that differs from the customer', () => {
    expect(jobBillToPartyOptions({ gcCustomerId: 'gc-1', customerId: 'cust-1', gcName: 'Loberg' }).map((o) => o.value)).toEqual([
      'customer',
      'gc',
      'split',
    ])
    expect(jobBillToPartyOptions({ gcCustomerId: null, customerId: 'cust-1', gcName: null }).map((o) => o.value)).toEqual([
      'customer',
      'split',
    ])
    expect(jobBillToPartyOptions({ gcCustomerId: 'cust-1', customerId: 'cust-1', gcName: 'Same' }).map((o) => o.value)).toEqual([
      'customer',
      'split',
    ])
  })
  it('names the GC on its option', () => {
    const gc = jobBillToPartyOptions({ gcCustomerId: 'gc-1', customerId: 'cust-1', gcName: 'Loberg' }).find((o) => o.value === 'gc')
    expect(gc?.label).toBe('GC · Loberg')
  })
})

describe('billPartyLabel', () => {
  it('has a short word for every party', () => {
    expect(billPartyLabel('customer')).toBe('Customer')
    expect(billPartyLabel('gc')).toBe('GC')
    expect(billPartyLabel('other')).toBe('Someone else')
    expect(billPartyLabel('split')).toBe('Split by line')
  })
})

describe('shouldDefaultBillsToGc', () => {
  const dr = { id: 'gc-dr', gc_pays_by_default: true }
  it('flips a default-rule job to GC pays when the GC carries the standing rule', () => {
    expect(shouldDefaultBillsToGc({ gc: dr, customerId: 'owner', current: 'customer' })).toBe(true)
  })
  it('never overrides a deliberate choice, a GC without the rule, or a GC that is the customer row', () => {
    expect(shouldDefaultBillsToGc({ gc: dr, customerId: 'owner', current: 'split' })).toBe(false)
    expect(shouldDefaultBillsToGc({ gc: dr, customerId: 'owner', current: 'gc' })).toBe(false)
    expect(shouldDefaultBillsToGc({ gc: { id: 'gc-x', gc_pays_by_default: false }, customerId: 'owner', current: 'customer' })).toBe(false)
    expect(shouldDefaultBillsToGc({ gc: dr, customerId: 'gc-dr', current: 'customer' })).toBe(false)
    expect(shouldDefaultBillsToGc({ gc: null, customerId: 'owner', current: 'customer' })).toBe(false)
  })
})
