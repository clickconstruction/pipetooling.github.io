import { describe, expect, it } from 'vitest'
import { billedInvoiceBillTo } from './billedInvoiceBillTo'

const gcJob = { bill_to_party: 'gc', gc_customer_id: 'gc-1', customer_id: 'cust-1' }
const customerJob = { bill_to_party: 'customer', gc_customer_id: 'gc-1', customer_id: 'cust-1' }
const splitJob = { bill_to_party: 'split', gc_customer_id: 'gc-1', customer_id: 'cust-1' }

describe('billedInvoiceBillTo: who a billed invoice\'s paper names (v2.7956)', () => {
  const face = { customer_name: 'Pat Example', customer_email: 'pat@example.com', customer_phone: '512-555-0101' }
  const gc = { id: 'gc-1', name: 'Acme Builders' }

  it('a bill to the customer keeps the job\'s customer, as before', () => {
    expect(billedInvoiceBillTo(face, { ...customerJob, gcCustomer: gc }, {})).toBe(face)
    expect(billedInvoiceBillTo(face, { bill_to_party: 'customer', customer_id: 'cust-1' }, null)).toBe(face)
  })

  it('a GC job with no customer names the GC, never nobody', () => {
    const gcOnly = { bill_to_party: 'gc', gc_customer_id: 'gc-1', customer_id: null, gcCustomer: gc }
    const blank = { customer_name: null, customer_email: 'ap@acme.example', customer_phone: null }
    // The job has no other party, so its own email and phone stay.
    expect(billedInvoiceBillTo(blank, gcOnly, {})).toEqual({ customer_name: 'Acme Builders', customer_email: 'ap@acme.example', customer_phone: null })
  })

  it('a GC-billed job with its own customer names the GC and drops the customer\'s email and phone', () => {
    expect(billedInvoiceBillTo(face, { ...gcJob, gcCustomer: gc }, {})).toEqual({ customer_name: 'Acme Builders', customer_email: '', customer_phone: '' })
    // The invoice's own pick decides on a split job.
    expect(billedInvoiceBillTo(face, { ...splitJob, gcCustomer: gc }, { bill_to_party: 'gc' }).customer_name).toBe('Acme Builders')
    expect(billedInvoiceBillTo(face, { ...gcJob, gcCustomer: gc }, { bill_to_party: 'customer' })).toBe(face)
  })

  it('the GC entered as the customer keeps the job\'s email and phone', () => {
    const same = { bill_to_party: 'gc', gc_customer_id: 'gc-1', customer_id: 'gc-1', gcCustomer: gc }
    expect(billedInvoiceBillTo(face, same, {})).toEqual({ ...face, customer_name: 'Acme Builders' })
  })

  it('a bill typed to someone else names that person first, over the GC and the customer', () => {
    const tenant = { bill_to_name: 'Jo Tenant', bill_to_email: 'jo@example.com', bill_to_phone: null }
    expect(billedInvoiceBillTo(face, { ...gcJob, gcCustomer: gc }, tenant)).toEqual({ customer_name: 'Jo Tenant', customer_email: 'jo@example.com', customer_phone: '512-555-0101' })
    // A typed name with no email is not an active override: the job's rule stands.
    expect(billedInvoiceBillTo(face, { ...gcJob, gcCustomer: gc }, { bill_to_name: 'Jo Tenant', bill_to_email: '' }).customer_name).toBe('Acme Builders')
  })

  it('a GC whose name the job did not load changes nothing', () => {
    expect(billedInvoiceBillTo(face, gcJob, {})).toBe(face)
    expect(billedInvoiceBillTo(face, { ...gcJob, gcCustomer: { name: '  ' } }, {})).toBe(face)
  })
})
