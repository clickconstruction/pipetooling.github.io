/**
 * Who a paper bill would be emailed again to, as the confirm window reads it (v2.7959): the three small reads,
 * and the GC's row asked for only when the bill went to the GC.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rows: Record<string, { data: unknown; error: unknown }> = {}
const asked: string[] = []
vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => {
      asked.push(table)
      const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => rows[table] ?? { data: null, error: null } }
      return chain
    },
  },
}))
vi.mock('./fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: vi.fn() }))

import { readPaperBillResendRecipient } from './resendPhysicalInvoiceEmail'

const ref = { id: 'inv-1', job_id: 'job-1' }
const set = (inv: unknown, job: unknown, gc?: unknown) => {
  rows.jobs_ledger_invoices = { data: inv, error: null }
  rows.jobs_ledger = { data: job, error: null }
  rows.customers = { data: gc ?? null, error: null }
}

describe('readPaperBillResendRecipient', () => {
  beforeEach(() => {
    asked.length = 0
    for (const k of Object.keys(rows)) delete rows[k]
  })

  it("a bill to the GC reads the GC's row and answers its billing email", async () => {
    set({ id: 'inv-1', bill_to_email: null, bill_to_party: null }, { id: 'job-1', customer_id: 'cust-1', gc_customer_id: 'gc-1', bill_to_party: 'gc', customer_email: 'pat@example.com' }, { id: 'gc-1', billing_email: 'ap@acme.example', contact_info: null })
    expect(await readPaperBillResendRecipient(ref)).toEqual({ ok: true, recipient: { party: 'gc', email: 'ap@acme.example' } })
    expect(asked).toEqual(['jobs_ledger_invoices', 'jobs_ledger', 'customers'])
  })

  it("a customer's bill never asks for the GC's row", async () => {
    set({ id: 'inv-1', bill_to_email: null, bill_to_party: null }, { id: 'job-1', customer_id: 'cust-1', gc_customer_id: 'gc-1', bill_to_party: 'customer', customer_email: 'pat@example.com' })
    expect(await readPaperBillResendRecipient(ref)).toEqual({ ok: true, recipient: { party: 'customer', email: 'pat@example.com' } })
    expect(asked).toEqual(['jobs_ledger_invoices', 'jobs_ledger'])
  })

  it('a GC with no address answers the reason and where to add it', async () => {
    set({ id: 'inv-1', bill_to_email: null, bill_to_party: null }, { id: 'job-1', customer_id: null, gc_customer_id: 'gc-1', bill_to_party: 'gc', customer_email: null }, { id: 'gc-1', billing_email: null, contact_info: {} })
    expect(await readPaperBillResendRecipient(ref)).toEqual({ ok: false, message: 'The GC on this job has no billing email. Add it on Edit Job → GC/Builder → Billing email.' })
  })

  it('a read that is refused answers its reason, and a missing bill says so', async () => {
    rows.jobs_ledger_invoices = { data: null, error: { message: 'permission denied for table jobs_ledger_invoices' } }
    const refused = await readPaperBillResendRecipient(ref)
    expect(refused.ok).toBe(false)
    expect(refused.ok ? '' : refused.message).toContain('permission denied')
    rows.jobs_ledger_invoices = { data: null, error: null }
    expect(await readPaperBillResendRecipient(ref)).toEqual({ ok: false, message: 'Invoice not found on this job.' })
  })
})
