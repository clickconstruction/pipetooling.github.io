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
  roundedRect(x: number, y: number, w: number, h: number, _rx: number, _ry: number, style?: string) {
    this.rects.push({ x, y, w, h, style: style ?? 'round' })
  }
  getTextWidth(t: string) {
    return t.length * 1.2
  }
  getImageProperties() {
    return { width: 400, height: 100 }
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

describe('the signed frame in PDF (v2.5077)', () => {
  const signed = { mode: 'type' as const, printedName: 'Robert Douglas', pngDataUrl: null, signedWords: 'Signed October 9, 2026 at 2:14 PM CT', recordId: 'L878-4C2E91', auditLine: 'Placed by Robert Douglas with one press under his own sign-in to ClickTooling on October 9, 2026 at 2:14 PM CT.' }

  it('pressed: the rounded frame, the tag, the name in type, the names and the day, the record ID, the audit line; drawn: the ink as an image inside the frame', async () => {
    await filingDocPdfBlob([{ kind: 'paragraph', text: 'Before.' }, { kind: 'signature', lines: ['Robert Douglas, Owner', 'Click Plumbing'], signed }])
    const pdf = FakeJsPDF.last!
    expect(pdf.rects.filter((r) => r.style === 'round')).toHaveLength(1)
    expect(pdf.texts).toContain('SIGNED ELECTRONICALLY')
    expect(pdf.texts).toContain('Robert Douglas')
    expect(pdf.texts).toContain('Robert Douglas, Owner')
    expect(pdf.texts).toContain('Signed October 9, 2026 at 2:14 PM CT')
    expect(pdf.texts).toContain('L878-4C2E91')
    expect(pdf.texts.some((t) => t.startsWith('Placed by Robert Douglas'))).toBe(true)
    expect(pdf.images).toEqual([])
    await filingDocPdfBlob([{ kind: 'signature', lines: ['Robert Douglas, Owner'], signed: { ...signed, mode: 'draw', pngDataUrl: 'data:image/png;base64,AAAA' } }])
    const drawn = FakeJsPDF.last!
    expect(drawn.images).toHaveLength(1)
    expect(drawn.images[0]!.data).toBe('data:image/png;base64,AAAA')
    expect(drawn.images[0]!.h).toBeCloseTo(14, 6)
    expect(drawn.texts).not.toContain('Robert Douglas')
    // Unsigned stays the rule and the names, no frame.
    await filingDocPdfBlob([{ kind: 'signature', lines: ['Robert Douglas, Owner'] }])
    expect(FakeJsPDF.last!.rects.filter((r) => r.style === 'round')).toHaveLength(0)
  })
})

describe('the window envelope on the PDF (the Docsmit train, PR 4)', () => {
  it('the recipient block is drawn at the window zone, not the cursor, and the code is the next image under it', async () => {
    const { WINDOW_QR_MM, WINDOW_ZONE_MM } = await import('../mail/windowEnvelope')
    await filingDocPdfBlob([
      { kind: 'letterhead', company: 'Click Plumbing', licenseLine: 'M-12345', contactLines: ['(512) 360-0599'] },
      { kind: 'windowAddress', lines: ['ATI Schertz Holdings LLC', '17300 IH 35 N', 'Schertz, TX 78154'] },
      { kind: 'qrLink', png: 'data:image/png;base64,QUJD', svg: null, display: 'clicktooling.com/pay/abc?m=KX7M2QRT', caption: 'Scan to see and pay the bills this notice is about.' },
      { kind: 'paragraph', text: 'Dear owner,' },
    ])
    const pdf = FakeJsPDF.last!
    expect(pdf.texts).toContain('17300 IH 35 N')
    expect(pdf.texts).toContain('clicktooling.com/pay/abc?m=KX7M2QRT')
    expect(pdf.images).toHaveLength(1)
    const img = pdf.images[0]!
    expect(img.w).toBe(WINDOW_QR_MM)
    expect(img.h).toBe(WINDOW_QR_MM)
    // Under the window zone: the code's top is past the zone's bottom.
    expect(img.y).toBeGreaterThanOrEqual(WINDOW_ZONE_MM.top + WINDOW_ZONE_MM.height)
    expect(img.y).toBeLessThan(WINDOW_ZONE_MM.top + WINDOW_ZONE_MM.height + 10)
  })
})

