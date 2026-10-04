import { describe, expect, it } from 'vitest'
import { jobDocumentBillRows, jobDocumentFolderLinks } from './jobDocumentsTab'

describe('jobDocumentFolderLinks', () => {
  it('lists the folder links that are set, as web addresses only', () => {
    expect(
      jobDocumentFolderLinks({
        google_drive_link: ' https://drive.google.com/drive/folders/abc ',
        job_plans_link: '',
        job_pictures_link: 'https://photos.app.goo.gl/xyz',
      }),
    ).toEqual([
      { label: 'Job folder', url: 'https://drive.google.com/drive/folders/abc' },
      { label: 'Pictures', url: 'https://photos.app.goo.gl/xyz' },
    ])
  })

  it('leaves out anything that is not a web address', () => {
    expect(jobDocumentFolderLinks({ google_drive_link: 'javascript:alert(1)', job_plans_link: 'in the truck', job_pictures_link: null })).toEqual([])
    expect(jobDocumentFolderLinks({})).toEqual([])
  })
})

describe('jobDocumentBillRows', () => {
  const dayOf = (iso: string) => iso.slice(0, 10)
  const inv = (p: Partial<Parameters<typeof jobDocumentBillRows>[0][number]>) => ({
    id: 'i',
    status: 'billed',
    amount: 1000,
    sequence_order: 1,
    sent_to_customer_at: null,
    billed_at: null,
    hosted_invoice_url: null,
    ...p,
  })

  it('lists the bills that went out, in order, and never a draft', () => {
    const rows = jobDocumentBillRows(
      [
        inv({ id: 'c', sequence_order: 3, status: 'ready_to_bill' }),
        inv({ id: 'b', sequence_order: 2, amount: '17460.00', sent_to_customer_at: '2026-10-02T15:00:00Z', hosted_invoice_url: 'https://invoice.stripe.com/i/abc' }),
        inv({ id: 'a', sequence_order: 1, status: 'paid', sent_to_customer_at: '2026-09-02T15:00:00Z' }),
      ],
      dayOf,
    )
    expect(rows).toEqual([
      { id: 'a', title: 'Bill 1', amount: 1000, words: 'Paid', paid: true, hostedUrl: '' },
      { id: 'b', title: 'Bill 2', amount: 17460, words: 'Sent 10/02/2026', paid: false, hostedUrl: 'https://invoice.stripe.com/i/abc' },
    ])
  })

  it('numbers from 1 by place, whatever the stored order starts at, and a draft keeps its place', () => {
    const rows = jobDocumentBillRows(
      [inv({ id: 'a', sequence_order: 0 }), inv({ id: 'b', sequence_order: 1, status: 'ready_to_bill' }), inv({ id: 'c', sequence_order: 2 })],
      dayOf,
    )
    expect(rows.map((r) => r.title)).toEqual(['Bill 1', 'Bill 3'])
  })

  it('falls back to the billed day, then to the word alone', () => {
    expect(jobDocumentBillRows([inv({ billed_at: '2026-09-30T05:00:00Z' })], dayOf)[0]!.words).toBe('Billed 09/30/2026')
    expect(jobDocumentBillRows([inv({})], dayOf)[0]!.words).toBe('Billed')
  })
})
