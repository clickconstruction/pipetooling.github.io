import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { noticeEnclosureRefItem, noticeInvoiceDocs, noticeInvoicePrintSections, unpaidBilledInvoices, type NoticeInvoiceDoc } from './noticeInvoiceEnclosure'
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
  invoices: [inv('paid', 500, 1), inv('open', 1710, 2), inv('rtb', 300, 3, 'ready_to_bill')],
} as unknown as JobWithDetails

describe('the invoice behind the notice (v2.3437)', () => {
  it('claims only billed invoices with money open, oldest first', () => {
    expect(unpaidBilledInvoices(job).map((i) => i.id)).toEqual(['open'])
  })

  it('renders each unpaid bill as the app\'s own document, titled by the number the bill shows', () => {
    const docs = noticeInvoiceDocs(job)
    expect(docs.map((d) => d.invoiceId)).toEqual(['open'])
    expect(docs[0]?.title).toMatch(/^Invoice #2, /)
    expect(noticeEnclosureRefItem(docs)).toMatch(/^Invoice #2, .* enclosed$/)
    expect(noticeEnclosureRefItem([])).toBe('')
    expect(noticeEnclosureRefItem([docs[0]!, docs[0]!])).toBe('2 invoices enclosed')
  })

  it('print sections stamp each enclosed invoice and cite § 53.056(a-3)', () => {
    const d: NoticeInvoiceDoc = { invoiceId: 'x', title: 'Invoice #2', doc: noticeInvoiceDocs(job)[0]!.doc as PhysicalInvoiceDocument }
    const [html] = noticeInvoicePrintSections([d])
    expect(html).toContain('§ 53.056(a-3)')
    expect(html).toContain('INVOICE')
    expect(html).toContain('$1,710.00')
  })
})
