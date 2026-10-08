import { describe, expect, it, vi } from 'vitest'

/** Recording jsPDF stand-in (the testReportPdf test's pattern): what is drawn, on which page, how low. */
type TextCall = { page: number; text: string; x: number; y: number; align?: string; size: number; font: string }

class FakeJsPDF {
  static last: FakeJsPDF | null = null
  calls: TextCall[] = []
  rects: Array<{ page: number; y: number; h: number }> = []
  pages = 1
  page = 1
  fontSize = 16
  fontStyle = 'normal'
  constructor() {
    FakeJsPDF.last = this
  }
  setFontSize(n: number) { this.fontSize = n }
  setFont(_name: string, style?: string) { this.fontStyle = style ?? 'normal' }
  setTextColor() {}
  setDrawColor() {}
  setFillColor() {}
  setLineWidth() {}
  addPage() { this.pages += 1; this.page = this.pages }
  setPage(n: number) { this.page = n }
  getNumberOfPages() { return this.pages }
  getTextWidth(s: string) { return s.length * this.fontSize * 0.19 }
  splitTextToSize(text: string) { return [text] }
  text(t: string, x: number, y: number, opts?: { align?: string }) { this.calls.push({ page: this.page, text: t, x, y, align: opts?.align, size: this.fontSize, font: this.fontStyle }) }
  rect(_x: number, y: number, _w: number, h: number) { this.rects.push({ page: this.page, y, h }) }
  line() {}
  output() { return new Blob([`fake-pdf pages=${this.pages}`], { type: 'application/pdf' }) }
}

vi.mock('../loadJsPDF', () => ({ loadJsPDF: async () => FakeJsPDF }))

import { buildGcChecksReport, type ChecksJobIn } from '../jobs/gcChecksApplied'
import { gcChecksSheetPdfBlob } from './gcChecksAppliedPdf'

const PAGE_H = 279.4
const FOOTER_Y = PAGE_H - 8

const job = (n: number, invoices: number, check: string): ChecksJobIn => ({
  id: `j${n}`,
  click_number: String(1000 + n),
  job_name: `Lot ${n}`,
  job_address: `${n} Cedar Ln`,
  customer_id: 'owner',
  gc_customer_id: 'gc-1',
  bill_to_party: 'gc',
  lien_retainage_held: null,
  invoices: Array.from({ length: invoices }, (_, i) => ({ id: `j${n}-${i + 1}`, job_id: `j${n}`, sequence_order: i + 1, amount: 100, status: 'paid', billed_at: '2026-08-01' })),
  payments: Array.from({ length: invoices }, (_, i) => ({ id: `p${n}-${i + 1}`, job_id: `j${n}`, invoice_id: `j${n}-${i + 1}`, amount: 100, paid_on: '2026-09-10', payment_type: 'check', reference_number: check })),
})

const textOn = (doc: FakeJsPDF, text: string) => doc.calls.filter((c) => c.text === text)

describe('gcChecksSheetPdfBlob', () => {
  it('draws the title, the period, the summary, both sections and the foot, with the page count on every page', async () => {
    const report = buildGcChecksReport({ gcId: 'gc-1', jobs: [job(1, 1, '48211')], sinceYmd: '2026-06-01' })
    const blob = await gcChecksSheetPdfBlob('Structura Builders', report, { asOfYmd: '2026-09-28' })
    const doc = FakeJsPDF.last!
    expect(blob.type).toBe('application/pdf')
    const drawn = doc.calls.map((c) => c.text).join(' ')
    expect(drawn).toContain('Structura Builders — where your checks were applied')
    expect(drawn).toContain('Since Jun 1, 2026 · as of Sep 28, 2026')
    expect(drawn).toContain('1 payment')
    expect(drawn).toContain('Each payment, and where it sits now')
    expect(drawn).toContain('Where each job stands')
    expect(drawn).toContain('Paid in full')
    expect(drawn).toContain('Questions about a check?')
    expect(textOn(doc, '#48211')[0]!.font).toBe('bold')
    // The amount on a bill's line sits at the cell's right edge.
    expect(textOn(doc, '$100.00').some((c) => c.align === 'right')).toBe(true)
    expect(textOn(doc, 'Page 1 of 1')).toHaveLength(1)
    expect(textOn(doc, 'Page 1 of 1')[0]!.y).toBe(FOOTER_Y)
  })

  it('keeps every row whole on one page and draws the header row again on each page the table runs onto', async () => {
    const jobs = Array.from({ length: 80 }, (_, i) => job(i + 1, 1, String(50000 + i)))
    const report = buildGcChecksReport({ gcId: 'gc-1', jobs })
    await gcChecksSheetPdfBlob('Structura Builders', report, { asOfYmd: '2026-09-28' })
    const doc = FakeJsPDF.last!
    expect(doc.pages).toBeGreaterThan(2)
    for (let i = 0; i < 80; i++) {
      const label = textOn(doc, `#${50000 + i}`)[0]!
      const line = doc.calls.find((c) => c.text === `${i + 1} Cedar Ln · ${1001 + i} Lot ${i + 1}` && c.font === 'bold')!
      expect(line.page, `check #${50000 + i}`).toBe(label.page)
    }
    const checkPages = new Set(Array.from({ length: 80 }, (_, i) => textOn(doc, `#${50000 + i}`)[0]!.page))
    const headerPages = new Set(textOn(doc, 'Applied now to').map((c) => c.page))
    for (const p of checkPages) expect(headerPages.has(p), `header on page ${p}`).toBe(true)
    // Nothing but the page footer is drawn below the body's last line.
    expect(doc.calls.filter((c) => c.y > PAGE_H - 16 && c.y !== FOOTER_Y)).toEqual([])
    expect(textOn(doc, `Page ${doc.pages} of ${doc.pages}`)).toHaveLength(1)
  })

  it('runs a check that paid more bills than a page holds onto the next page, under its header row again', async () => {
    const report = buildGcChecksReport({ gcId: 'gc-1', jobs: [job(1, 120, '9999')] })
    await gcChecksSheetPdfBlob('Structura Builders', report, { asOfYmd: '2026-09-28' })
    const doc = FakeJsPDF.last!
    const pages = new Set(doc.calls.filter((c) => / of 120$/.test(c.text)).map((c) => c.page))
    expect(pages.size).toBeGreaterThan(1)
    const headerPages = textOn(doc, 'Applied now to').map((c) => c.page)
    for (const p of pages) expect(headerPages, `header on page ${p}`).toContain(p)
    expect(doc.calls.filter((c) => c.y > PAGE_H - 16 && c.y !== FOOTER_Y)).toEqual([])
    // Every one of the 120 lines is drawn once.
    for (let i = 1; i <= 120; i++) expect(textOn(doc, `Invoice ${i} of 120`), `Invoice ${i}`).toHaveLength(1)
  })
})
