import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import type { JobWithDetails } from '../../types/jobWithDetails'

const jobs = new Map<string, JobWithDetails>()
const fetched: string[] = []
vi.mock('../fetchJobWithDetailsById', () => ({
  fetchJobWithDetailsById: async (id: string) => {
    fetched.push(id)
    return jobs.get(id) ?? null
  },
}))

// The invoice renderer has its own tests (physicalInvoicePdf.test.ts); here each invoice is a real one-page PDF, so the join is the real join.
const rendered: string[] = []
vi.mock('../physicalInvoicePdf', () => ({
  buildPhysicalInvoicePdfBlob: async (doc: { amountFormatted: string }) => {
    rendered.push(doc.amountFormatted)
    const pdf = await PDFDocument.create()
    pdf.addPage()
    return new Blob([(await pdf.save()) as BlobPart], { type: 'application/pdf' })
  },
}))

import { openGcUnpaidInvoicesPdfInNewTab } from './gcUnpaidInvoicePrintIo'

type Inv = JobWithDetails['invoices'][number]

const inv = (id: string, jobId: string, amount: number) =>
  ({ id, job_id: jobId, amount, sequence_order: 1, status: 'billed', billed_at: '2026-08-18T14:28:00Z', sent_to_customer_at: null, estimated_bill_date: null, stripe_invoice_memo: 'Gas install', external_send_note: '', stripe_invoice_footer: null }) as unknown as Inv

const job = (id: string, over: Partial<JobWithDetails> = {}) =>
  ({
    id,
    status: 'billed',
    hcp_number: id.replace('j', ''),
    click_number: '',
    job_name: 'Dudley Mason',
    job_address: '628 Terrell Rd, San Antonio, TX 78209',
    customer_name: 'Bobby Urrabazo',
    customer_email: '',
    customer_id: 'c1',
    gc_customer_id: null,
    bill_to_party: 'customer',
    revenue: 1000,
    payments_made: 0,
    invoices: [],
    payments: [],
    materials: [],
    fixtures: [],
    team_members: [],
    ...over,
  }) as unknown as JobWithDetails

/** The tab the app opens: what was written into it, where it was sent, whether it was closed. */
function fakeTab() {
  return { written: '', closed: false, location: { href: '' }, document: { write(this: void, _s: string) {}, close() {} }, close() {} }
}

describe('openGcUnpaidInvoicesPdfInNewTab', () => {
  let tab: ReturnType<typeof fakeTab> | null
  let blobs: Blob[]
  const done = vi.fn()
  const blocked = vi.fn()
  const failed = vi.fn()
  const cb = { onDone: done, onBlocked: blocked, onError: failed }

  beforeEach(() => {
    jobs.clear()
    fetched.length = 0
    rendered.length = 0
    blobs = []
    done.mockReset()
    blocked.mockReset()
    failed.mockReset()
    tab = fakeTab()
    tab.document.write = (s: string) => {
      tab!.written += s
    }
    tab.close = () => {
      tab!.closed = true
    }
    vi.stubGlobal('window', { open: vi.fn(() => tab), setTimeout: () => 0 })
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      blobs.push(b as Blob)
      return `blob:invoices-${blobs.length}`
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("opens one PDF holding every unpaid invoice, in the statement's order", async () => {
    jobs.set('j867', job('j867', { invoices: [inv('i-a', 'j867', 1710)] }))
    jobs.set('j890', job('j890', { invoices: [inv('i-b', 'j890', 285)] }))
    jobs.set('j790', job('j790', { invoices: [inv('i-c', 'j790', 1712.5)] }))
    await openGcUnpaidInvoicesPdfInNewTab(
      'RMC- Dudley Mason',
      {
        targets: [
          { jobId: 'j867', invoiceId: 'i-a' },
          { jobId: 'j890', invoiceId: 'i-b' },
          { jobId: 'j790', invoiceId: 'i-c' },
        ],
        rowsWithoutBill: 0,
      },
      cb,
    )
    expect(failed).not.toHaveBeenCalled()
    expect(tab!.written).toContain('Building 3 unpaid invoices for RMC- Dudley Mason')
    expect(tab!.location.href).toBe('blob:invoices-1')
    expect(blobs).toHaveLength(1)
    const merged = await PDFDocument.load(await blobs[0]!.arrayBuffer())
    expect(merged.getPageCount()).toBe(3)
    expect(rendered).toEqual(['$1,710.00', '$285.00', '$1,712.50'])
    expect(done).toHaveBeenCalledWith({ message: '3 unpaid invoices for RMC- Dudley Mason.', complete: true, printed: 3 })
  })

  it('reads each job once however many of its bills are on the statement', async () => {
    jobs.set('j1', job('j1', { invoices: [inv('i-1', 'j1', 100), inv('i-2', 'j1', 200)] }))
    await openGcUnpaidInvoicesPdfInNewTab(
      'Knight',
      {
        targets: [
          { jobId: 'j1', invoiceId: 'i-1' },
          { jobId: 'j1', invoiceId: 'i-2' },
        ],
        rowsWithoutBill: 0,
      },
      cb,
    )
    expect(fetched).toEqual(['j1'])
    expect(done.mock.calls[0]![0].printed).toBe(2)
  })

  it('says what it left out, and still opens the rest', async () => {
    jobs.set('j1', job('j1', { invoices: [inv('i-1', 'j1', 100)] }))
    jobs.set('j2', job('j2', { invoices: [inv('i-2', 'j2', 200)], payments: [{ invoice_id: 'i-2', amount: 200 }] as never }))
    await openGcUnpaidInvoicesPdfInNewTab(
      'Knight',
      {
        targets: [
          { jobId: 'j1', invoiceId: 'i-1' },
          { jobId: 'j2', invoiceId: 'i-2' },
          { jobId: 'gone', invoiceId: 'i-3' },
        ],
        rowsWithoutBill: 1,
      },
      cb,
    )
    expect(tab!.location.href).toBe('blob:invoices-1')
    expect(done).toHaveBeenCalledWith({
      message: '1 unpaid invoice for Knight — left out: 1 row is a job balance with no invoice; 1 bill is no longer unpaid; 1 bill could not be built.',
      complete: false,
      printed: 1,
    })
  })

  it('opens no tab when the statement has no bill to print', async () => {
    await openGcUnpaidInvoicesPdfInNewTab('Knight', { targets: [], rowsWithoutBill: 2 }, cb)
    expect((window.open as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)
    expect(done.mock.calls[0]![0].printed).toBe(0)
  })

  it('closes the tab when every bill turned out paid', async () => {
    jobs.set('j2', job('j2', { invoices: [inv('i-2', 'j2', 200)], payments: [{ invoice_id: 'i-2', amount: 200 }] as never }))
    await openGcUnpaidInvoicesPdfInNewTab('Knight', { targets: [{ jobId: 'j2', invoiceId: 'i-2' }], rowsWithoutBill: 0 }, cb)
    expect(tab!.closed).toBe(true)
    expect(blobs).toHaveLength(0)
    expect(done.mock.calls[0]![0]).toMatchObject({ printed: 0, complete: false })
  })

  it('reports a blocked pop-up and reads nothing', async () => {
    tab = null
    await openGcUnpaidInvoicesPdfInNewTab('Knight', { targets: [{ jobId: 'j1', invoiceId: 'i-1' }], rowsWithoutBill: 0 }, cb)
    expect(blocked).toHaveBeenCalledTimes(1)
    expect(fetched).toEqual([])
    expect(done).not.toHaveBeenCalled()
  })
})
