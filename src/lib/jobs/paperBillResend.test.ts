import { describe, expect, it } from 'vitest'
import { paperBillNoAddressWords, paperBillResendRecipient } from './paperBillResend'

const job = { bill_to_party: 'customer', customer_id: 'cust-1', gc_customer_id: 'gc-1', customer_email: ' pat@example.com ' }
const gc = { billing_email: ' ap@acme.example ', contact_info: { email: 'office@acme.example' } }

describe('paperBillResendRecipient: where a paper bill emailed again goes (v2.7959)', () => {
  it("a customer's bill goes to the job's customer email, as before", () => {
    expect(paperBillResendRecipient(job, {}, gc)).toEqual({ party: 'customer', email: 'pat@example.com' })
    expect(paperBillResendRecipient({ ...job, gc_customer_id: null }, null, null)).toEqual({ party: 'customer', email: 'pat@example.com' })
  })

  it("a bill to the GC goes to the GC's billing email, never the customer's", () => {
    expect(paperBillResendRecipient({ ...job, bill_to_party: 'gc' }, {}, gc)).toEqual({ party: 'gc', email: 'ap@acme.example' })
    // The invoice's own pick on a split job.
    expect(paperBillResendRecipient({ ...job, bill_to_party: 'split' }, { bill_to_party: 'gc' }, gc).email).toBe('ap@acme.example')
    // A GC job with no customer, and no customer email at all.
    expect(paperBillResendRecipient({ bill_to_party: 'gc', customer_id: null, gc_customer_id: 'gc-1', customer_email: null }, {}, gc)).toEqual({ party: 'gc', email: 'ap@acme.example' })
  })

  it("the GC's contact email stands in when it has no billing email, and none at all reads as none", () => {
    const gcJob = { ...job, bill_to_party: 'gc' }
    expect(paperBillResendRecipient(gcJob, {}, { billing_email: '', contact_info: { email: 'office@acme.example' } }).email).toBe('office@acme.example')
    expect(paperBillResendRecipient(gcJob, {}, { billing_email: null, contact_info: null })).toEqual({ party: 'gc', email: '' })
    // The GC's row did not load: no address, never the customer's.
    expect(paperBillResendRecipient(gcJob, {}, null)).toEqual({ party: 'gc', email: '' })
  })

  it('a bill typed to someone else goes to that address, over the GC and the customer', () => {
    expect(paperBillResendRecipient({ ...job, bill_to_party: 'gc' }, { bill_to_email: ' jo@example.com ' }, gc)).toEqual({ party: 'other', email: 'jo@example.com' })
  })

  it('a job with no customer email has no address', () => {
    expect(paperBillResendRecipient({ ...job, customer_email: '  ' }, {}, null)).toEqual({ party: 'customer', email: '' })
  })

  it('says where to add a missing address', () => {
    expect(paperBillNoAddressWords('gc')).toBe('The GC on this job has no billing email. Add it on Edit Job → GC/Builder → Billing email.')
    expect(paperBillNoAddressWords('customer')).toBe('Job has no customer email; add it on Edit Job.')
  })
})
