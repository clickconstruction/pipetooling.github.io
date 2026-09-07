import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PhysicalInvoiceDocument } from './physicalInvoiceDocument'

/**
 * A recording stand-in for jsPDF. The renderer is a sequence of draw calls, so
 * the contract worth pinning is WHAT is drawn, on WHICH page, and roughly WHERE
 * — not the bytes. Text wrapping is a deterministic approximation (0.19 mm per
 * character at the current font size), which is enough for pagination tests.
 */
type TextCall = { page: number; text: string; x: number; y: number; align?: string; size: number; font: string }

class FakeJsPDF {
  static last: FakeJsPDF | null = null
  calls: TextCall[] = []
  pages = 1
  page = 1
  fontSize = 16
  fontStyle = 'normal'
  lines: Array<{ page: number; x1: number; y1: number; x2: number; y2: number }> = []
  rects: Array<{ page: number; x: number; y: number; w: number; h: number }> = []
  internal = { pageSize: { getWidth: () => 215.9, getHeight: () => 279.4 } }
  constructor() {
    FakeJsPDF.last = this
  }
  setFontSize(n: number) { this.fontSize = n }
  setFont(_name: string, style?: string) { this.fontStyle = style ?? 'normal' }
  setTextColor() {}
  setDrawColor() {}
  setLineWidth() {}
  addPage() { this.pages += 1; this.page = this.pages }
  setPage(n: number) { this.page = n }
  getNumberOfPages() { return this.pages }
  getTextWidth(s: string) { return s.length * this.fontSize * 0.19 }
  splitTextToSize(text: string, width: number): string[] {
    const perLine = Math.max(1, Math.floor(width / (this.fontSize * 0.19)))
    const out: string[] = []
    for (const para of String(text).split('\n')) {
      if (para.length <= perLine) { out.push(para); continue }
      const words = para.split(' ')
      let cur = ''
      for (const w of words) {
        const next = cur ? `${cur} ${w}` : w
        if (next.length > perLine && cur) { out.push(cur); cur = w } else cur = next
      }
      if (cur) out.push(cur)
    }
    return out
  }
  text(t: string | string[], x: number, y: number, opts?: { align?: string }) {
    const arr = Array.isArray(t) ? t : [t]
    arr.forEach((line, i) => this.calls.push({ page: this.page, text: line, x, y: y + i * 4, align: opts?.align, size: this.fontSize, font: this.fontStyle }))
  }
  line(x1: number, y1: number, x2: number, y2: number) { this.lines.push({ page: this.page, x1, y1, x2, y2 }) }
  roundedRect(x: number, y: number, w: number, h: number) { this.rects.push({ page: this.page, x, y, w, h }) }
  output(_kind: 'blob') { return new Blob([`fake-pdf pages=${this.pages}`], { type: 'application/pdf' }) }
}

vi.mock('./loadJsPDF', () => ({ loadJsPDF: async () => FakeJsPDF }))

import { buildPhysicalInvoicePdfBlob, physicalInvoicePdfFilename, physicalInvoicePdfToBase64 } from './physicalInvoicePdf'

function docModel(over: Partial<PhysicalInvoiceDocument> = {}): PhysicalInvoiceDocument {
  return {
    layout: 'detailed',
    breakdownMatches: true,
    issuer: { companyName: 'Click Plumbing', addressText: '12925 FM 20\nKingsbury TX 78638', phone: '801-252-5155', email: 'office@example.com', tagline: '', licenseLine: 'M-12345' },
    customerName: 'Pat Customer',
    customerEmail: 'pat@example.com',
    customerPhone: '',
    jobName: 'Smith residence',
    hcpLabel: 'J878',
    serviceAddress: '1 Main St, Kingsbury TX',
    invoiceNumberDisplay: 'INV-0042',
    paymentTerms: 'Net 15',
    serviceDateDisplay: 'Sep 1, 2026',
    narrativeTitle: 'Water heater replacement',
    amountFormatted: '$1,000.00',
    subtotalFormatted: '$1,000.00',
    lineDescription: 'Water heater replacement',
    serviceLines: [{ description: 'Labor', qty: 1, unitPrice: 600, amount: 600 }],
    materialLines: [{ description: '50 gal water heater', qty: 1, unitPrice: 400, amount: 400 }],
    paymentHistory: [],
    paymentTotals: null,
    memo: '',
    footer: 'Thank you for your business.',
    invoiceDateDisplay: 'Sep 1, 2026',
    dueDateDisplay: 'Sep 16, 2026',
    ...over,
  }
}

async function render(over: Partial<PhysicalInvoiceDocument> = {}) {
  const blob = await buildPhysicalInvoicePdfBlob(docModel(over))
  const doc = FakeJsPDF.last!
  const texts = doc.calls.map((c) => c.text)
  const has = (s: string) => texts.includes(s)
  const find = (s: string) => doc.calls.find((c) => c.text === s)
  return { blob, doc, texts, has, find }
}

beforeEach(() => { FakeJsPDF.last = null })

describe('physicalInvoicePdfFilename', () => {
  it('sanitises the job number and date, with fallbacks', () => {
    expect(physicalInvoicePdfFilename('878', '2026-09-01')).toBe('Invoice-878-2026-09-01.pdf')
    expect(physicalInvoicePdfFilename('J 878/2', ' 2026-09-01 ')).toBe('Invoice-J-878-2-2026-09-01.pdf')
    expect(physicalInvoicePdfFilename(null, '')).toBe('Invoice-job-invoice.pdf')
    expect(physicalInvoicePdfFilename('', '09/01/2026')).toBe('Invoice-job-09012026.pdf')
    expect(physicalInvoicePdfFilename('x'.repeat(60), '2026-09-01')).toBe(`Invoice-${'x'.repeat(40)}-2026-09-01.pdf`)
  })
})

describe('physicalInvoicePdfToBase64', () => {
  it('base64-encodes the blob bytes', async () => {
    const b64 = await physicalInvoicePdfToBase64(new Blob(['%PDF-1.4 hi']))
    expect(Buffer.from(b64, 'base64').toString()).toBe('%PDF-1.4 hi')
  })
})

describe('buildPhysicalInvoicePdfBlob — detailed layout', () => {
  it('draws the header, meta block, both left-column blocks, the issuer block, both tables, totals, footer and the brand line', async () => {
    const r = await render()
    expect(r.blob.type).toBe('application/pdf')
    expect(r.has('INVOICE')).toBe(true)
    expect(r.has('Water heater replacement')).toBe(true) // narrative
    for (const label of ['INVOICE', 'SERVICE DATE', 'PAYMENT TERMS', 'DUE DATE', 'AMOUNT DUE']) expect(r.has(label)).toBe(true)
    expect(r.find('NET 15')).toBeUndefined() // values keep their case; only labels are uppercased
    expect(r.has('Net 15')).toBe(true)
    expect(r.has('SERVICE ADDRESS')).toBe(true)
    expect(r.has('1 Main St, Kingsbury TX')).toBe(true)
    expect(r.has('CONTACT')).toBe(true)
    expect(r.has('Pat Customer')).toBe(true)
    expect(r.has('pat@example.com')).toBe(true)
    // top-left name + issuer block + the tail, which shows the name when there is no tagline
    expect(r.texts.filter((t) => t === 'Click Plumbing')).toHaveLength(3)
    expect(r.has('12925 FM 20')).toBe(true)
    expect(r.has('801-252-5155')).toBe(true)
    expect(r.has('Services')).toBe(true)
    expect(r.has('Materials')).toBe(true)
    expect(r.has('Labor')).toBe(true)
    expect(r.has('50 gal water heater')).toBe(true)
    expect(r.has('$600.00')).toBe(true)
    expect(r.has('$400.00')).toBe(true)
    expect(r.has('Subtotal')).toBe(true)
    expect(r.has('Amount due')).toBe(true)
    expect(r.has('M-12345')).toBe(true)
    expect(r.has('Thank you for your business.')).toBe(true)
    expect(r.has('-- 1 of 1 --')).toBe(true)
    expect(r.find('ClickTooling')).toMatchObject({ y: 280, page: 1 })
    expect(r.doc.pages).toBe(1)
  })

  it('the Services table merges its title into the column header; Materials gets a Description header', async () => {
    const r = await render()
    expect(r.texts.filter((t) => t === 'Description')).toHaveLength(1)
    const services = r.find('Services')!
    const qtyHeaders = r.doc.calls.filter((c) => c.text === 'Qty')
    expect(qtyHeaders).toHaveLength(2)
    expect(Math.abs(qtyHeaders[0]!.y - services.y)).toBeLessThan(1) // same header row
  })

  it('omits the blocks whose data is empty', async () => {
    const r = await render({ serviceAddress: '', customerName: '', customerEmail: '', customerPhone: '', materialLines: [], memo: '', footer: '', issuer: { companyName: '', addressText: '', phone: '', email: '', tagline: '', licenseLine: '' } })
    expect(r.has('SERVICE ADDRESS')).toBe(false)
    expect(r.has('CONTACT')).toBe(false)
    expect(r.has('Materials')).toBe(false)
    expect(r.has('Memo')).toBe(false)
    expect(r.has('Description')).toBe(false) // only the merged Services header remains
    expect(r.has('Services')).toBe(true)
    expect(r.has('AMOUNT DUE')).toBe(true)
  })

  it('draws the memo when present, and the tagline in place of the company name in the tail', async () => {
    const r = await render({ memo: 'Gate code 1234', issuer: { ...docModel().issuer, tagline: 'Plumbing done right' } })
    expect(r.has('Memo')).toBe(true)
    expect(r.has('Gate code 1234')).toBe(true)
    const tail = r.doc.calls.filter((c) => c.text === 'Plumbing done right')
    expect(tail).toHaveLength(1)
    expect(tail[0]!.font).toBe('bold')
    expect(r.texts.filter((t) => t === 'Click Plumbing')).toHaveLength(2) // the tagline took the tail's slot
  })

  it('payment history: nothing without rows; a card with rows; "Paid in full" vs "Balance due"', async () => {
    const none = await render()
    expect(none.has('Payment history')).toBe(false)
    expect(none.doc.rects).toHaveLength(0)

    const rows = [{ label: 'Paid Sep 2, 2026 · card', amountFormatted: '$400.00' }]
    const due = await render({ paymentHistory: rows, paymentTotals: { billedFormatted: '$1,000.00', totalPaidFormatted: '$400.00', balanceDueFormatted: '$600.00', paidInFull: false } })
    expect(due.has('Payment history')).toBe(true)
    expect(due.has('- $400.00')).toBe(true)
    expect(due.has('Balance due')).toBe(true)
    expect(due.find('$600.00')?.align).toBe('right')
    expect(due.has('Paid in full')).toBe(false)
    expect(due.doc.rects).toHaveLength(1)
    expect(due.doc.rects[0]!.w).toBe(88)

    const paid = await render({ paymentHistory: [{ label: 'Paid Sep 2, 2026', amountFormatted: '$1,000.00' }], paymentTotals: { billedFormatted: '$1,000.00', totalPaidFormatted: '$1,000.00', balanceDueFormatted: '$0.00', paidInFull: true } })
    expect(paid.has('Paid in full')).toBe(true)
    expect(paid.has('Balance due')).toBe(false)
  })

  it('paginates a long materials list and stamps every page with "-- k of n --"', async () => {
    const materialLines = Array.from({ length: 80 }, (_, i) => ({ description: `Part ${i + 1}`, qty: 1, unitPrice: 5, amount: 5 }))
    const r = await render({ materialLines })
    expect(r.doc.pages).toBeGreaterThan(1)
    const n = r.doc.pages
    for (let k = 1; k <= n; k++) {
      const stamp = r.find(`-- ${k} of ${n} --`)
      expect(stamp?.page).toBe(k)
      expect(stamp?.align).toBe('center')
    }
    expect(r.has('Part 80')).toBe(true)
    expect(r.find('ClickTooling')?.page).toBe(n) // brand line only on the last page
    // rows never overflow the content area
    for (const c of r.doc.calls.filter((c) => /^Part \d+$/.test(c.text))) expect(c.y).toBeLessThan(275)
  })

  it('wraps a long description onto several lines inside one row', async () => {
    const long = 'Replace the existing fifty gallon natural gas water heater with a new unit including expansion tank, drip pan, and haul away of the old heater'
    const r = await render({ materialLines: [{ description: long, qty: 1, unitPrice: 400, amount: 400 }] })
    const pieces = r.doc.calls.filter((c) => long.startsWith(c.text) || long.includes(c.text)).filter((c) => c.text.length > 10)
    expect(pieces.length).toBeGreaterThan(1)
    expect(pieces.map((p) => p.text).join(' ')).toBe(long)
  })
})

describe('buildPhysicalInvoicePdfBlob — simple layout', () => {
  it('draws the label/value card, the description, memo, footer and page stamp', async () => {
    const r = await render({ layout: 'simple', memo: 'Leave at gate' })
    expect(r.has('Invoice')).toBe(true)
    expect(r.has('INVOICE')).toBe(false)
    expect(r.has('Amount due: $1,000.00')).toBe(true)
    for (const label of ['Bill to', 'Email', 'Job', 'Job #', 'Invoice date', 'Due date']) expect(r.has(label)).toBe(true)
    expect(r.has('Pat Customer')).toBe(true)
    expect(r.has('J878')).toBe(true)
    expect(r.has('Description')).toBe(true)
    expect(r.has('Water heater replacement')).toBe(true)
    expect(r.has('Memo')).toBe(true)
    expect(r.has('Leave at gate')).toBe(true)
    expect(r.has('Thank you for your business.')).toBe(true)
    expect(r.has('Services')).toBe(false) // no tables in the simple layout
    expect(r.has('-- 1 of 1 --')).toBe(true)
    expect(r.find('ClickTooling')?.y).toBe(280)
  })

  it('prints an em dash for a missing email and skips an empty description', async () => {
    const r = await render({ layout: 'simple', customerEmail: '', lineDescription: '   ' })
    expect(r.has('—')).toBe(true)
    expect(r.has('Description')).toBe(false)
  })

  it('shares the payment-history card with the detailed layout', async () => {
    const r = await render({ layout: 'simple', paymentHistory: [{ label: 'Paid Sep 2, 2026', amountFormatted: '$1,000.00' }], paymentTotals: { billedFormatted: '$1,000.00', totalPaidFormatted: '$1,000.00', balanceDueFormatted: '$0.00', paidInFull: true } })
    expect(r.has('Payment history')).toBe(true)
    expect(r.has('Paid in full')).toBe(true)
    expect(r.doc.rects).toHaveLength(1)
  })
})
