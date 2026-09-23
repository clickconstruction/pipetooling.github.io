import { describe, expect, it, vi } from 'vitest'
import { filingDocPdfBlob } from './lienFilingDocuments'

/**
 * The PDF side of the pay page's two blocks (v2.3758): a recording stand-in for jsPDF, as
 * `physicalInvoicePdf.test.ts` does — what is drawn, not the bytes. The code is the first
 * image a filing document draws since the release's signature.
 */
class FakeJsPDF {
  static last: FakeJsPDF | null = null
  images: Array<{ data: string; type: string; x: number; y: number; w: number; h: number }> = []
  rects: Array<{ x: number; y: number; w: number; h: number; style?: string }> = []
  texts: string[] = []
  pages = 1
  constructor() {
    FakeJsPDF.last = this
  }
  setFont() {}
  setFontSize() {}
  setTextColor() {}
  setDrawColor() {}
  setFillColor() {}
  setLineWidth() {}
  setPage() {}
  addPage() {
    this.pages += 1
  }
  getNumberOfPages() {
    return this.pages
  }
  splitTextToSize(t: string) {
    return [t]
  }
  text(t: string | string[]) {
    this.texts.push(Array.isArray(t) ? t.join('\n') : t)
  }
  line() {}
  rect(x: number, y: number, w: number, h: number, style?: string) {
    this.rects.push({ x, y, w, h, style })
  }
  addImage(data: string, type: string, x: number, y: number, w: number, h: number) {
    this.images.push({ data, type, x, y, w, h })
  }
  output() {
    return new Blob(['pdf'])
  }
}
vi.mock('../loadJsPDF', () => ({ loadJsPDF: async () => FakeJsPDF }))

describe('the pay page in PDF', () => {
  it('draws the callout as a filled box and each code as a 32 mm image at the margin; a bill with no code gets an empty box', async () => {
    await filingDocPdfBlob([
      { kind: 'callout', text: 'Please pay these only if the GC says so.' },
      { kind: 'payRow', label: 'Invoice #273-1, May 5, 2026', description: 'Trim.', amountLine: 'Still owed: $13,420.00', address: 'clicktooling.com/pay/inv-1', note: '', svg: null, png: 'data:image/png;base64,AAA' },
      { kind: 'payRow', label: 'Invoice #273-3, July 3, 2026', description: '', amountLine: 'Still owed: $3,500.00', address: '', note: 'No online payment page for this bill — pay by check to the address above.', svg: null, png: null },
    ])
    const pdf = FakeJsPDF.last!
    expect(pdf.rects.filter((r) => r.style === 'FD')).toHaveLength(1)
    expect(pdf.images).toEqual([{ data: 'data:image/png;base64,AAA', type: 'PNG', x: 22, y: expect.any(Number), w: 32, h: 32 }])
    expect(pdf.rects.filter((r) => r.style === undefined && r.w === 32 && r.h === 32)).toHaveLength(1)
    expect(pdf.texts).toContain('INVOICE #273-1, MAY 5, 2026')
    expect(pdf.texts).toContain('Still owed: $13,420.00')
    expect(pdf.texts).toContain('clicktooling.com/pay/inv-1')
    expect(pdf.texts.some((t) => t.includes('pay by check'))).toBe(true)
    expect(pdf.texts).toContain('Please pay these only if the GC says so.')
  })
})
