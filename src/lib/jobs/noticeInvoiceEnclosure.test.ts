import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { noticeEnclosureRefItem, noticeInvoiceDocs, noticeInvoicePrintSections, payPageDescription, unpaidBilledInvoices, type NoticeInvoiceDoc } from './noticeInvoiceEnclosure'
import type { PhysicalInvoiceDocument } from '../physicalInvoiceDocument'

const inv = (id: string, amount: number, seq: number, status = 'billed') =>
  ({ id, amount, sequence_order: seq, status, billed_at: '2026-08-18T14:28:00Z', created_at: '2026-08-18T14:27:00Z', sent_to_customer_at: null, estimated_bill_date: '2026-09-05', stripe_invoice_memo: 'Gas install', external_send_note: '', stripe_invoice_footer: null }) as unknown as JobWithDetails['invoices'][number]

const job = {
  id: 'j867',
  hcp_number: '867',
  job_name: 'Service Visit — 628 Terrell Rd',
  job_address: '628 Terrell Rd, San Antonio, TX 78209',
  customer_name: 'RMC- Dudley Mason',
  customer_email: '',
  customer_id: 'c1',
  gc_customer_id: null,
  bill_to_party: 'customer',
  fixtures: [],
  materials: [],
  payments: [{ invoice_id: 'paid', amount: 500 }],
  invoices: [inv('paid', 500, 1), inv('open', 1710, 2), inv('rtb', 300, 3, 'ready_to_bill'), inv('primary', 900, 0)],
} as unknown as JobWithDetails

describe('the invoice behind the notice (v2.3437)', () => {
  it('claims only billed invoices with money open, oldest first', () => {
    expect(unpaidBilledInvoices(job).map((i) => i.id)).toEqual(['primary', 'open'])
  })

  it('renders each unpaid bill as the app\'s own document, titled by the number the bill shows', () => {
    const docs = noticeInvoiceDocs(job)
    expect(docs.map((d) => d.invoiceId)).toEqual(['primary', 'open'])
    // The primary bill (sequence 0) reads by the job number, never "#0"; the date is the day it went out.
    expect(docs[0]?.title).toBe('Invoice #867, August 18, 2026')
    expect(docs[1]?.title).toBe('Invoice #2, August 18, 2026')
    expect(noticeEnclosureRefItem([docs[1]!])).toBe('Invoice #2, August 18, 2026 enclosed')
    expect(noticeEnclosureRefItem([])).toBe('')
    expect(noticeEnclosureRefItem(docs)).toBe('2 invoices enclosed')
  })

  it('carries what the pay page needs (v2.3758): the balance still owed and whether the bill has a payment page', () => {
    const docs = noticeInvoiceDocs(job)
    expect(docs.map((d) => [d.openAmount, d.stripeInvoiceId])).toEqual([
      [900, null],
      [1710, null],
    ])
    expect(typeof docs[0]?.description).toBe('string')
  })

  it('print sections stamp each enclosed invoice and cite § 53.056(a-3)', () => {
    const d: NoticeInvoiceDoc = { invoiceId: 'x', title: 'Invoice #2', doc: noticeInvoiceDocs(job)[1]!.doc as PhysicalInvoiceDocument, stripeInvoiceId: null, openAmount: 1710, description: '' }
    const [html] = noticeInvoicePrintSections([d])
    expect(html).toContain('§ 53.056(a-3)')
    expect(html).toContain('INVOICE')
    expect(html).toContain('$1,710.00')
  })
})

describe("the pay page's description of a bill (v2.3758)", () => {
  const line = (description: string) => ({ description }) as PhysicalInvoiceDocument['serviceLines'][number]
  it('one service line is the line itself, whatever the memo says', () => {
    expect(payPageDescription({ serviceLines: [line('Trip charge to pick up a reissued check.')], narrativeTitle: 'Paper checks can be sent to: Click Plumbing', lineDescription: 'Paper checks can be sent to: Click Plumbing' })).toBe('Trip charge to pick up a reissued check.')
  })
  it('many lines read the scope when there is one, else the first line and how many more', () => {
    expect(payPageDescription({ serviceLines: [line('Kitchen sink'), line('Lavatory'), line('Toilet')], narrativeTitle: 'Install and finish plumbing fixture trim.', lineDescription: '' })).toBe('Install and finish plumbing fixture trim.')
    expect(payPageDescription({ serviceLines: [line('Kitchen sink'), line('Lavatory'), line('Toilet')], narrativeTitle: '', lineDescription: '' })).toBe('Kitchen sink + 2 more')
    expect(payPageDescription({ serviceLines: [], narrativeTitle: '', lineDescription: '' })).toBe('')
  })
  it('never runs past a row', () => {
    const long = 'x'.repeat(200)
    expect(payPageDescription({ serviceLines: [line(long)], narrativeTitle: '', lineDescription: '' })).toHaveLength(140)
  })
})
