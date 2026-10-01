import { describe, expect, it, vi } from 'vitest'
import { buildLienWaiverPdfBlob, lienWaiverInkBox, type LienWaiverFields } from './lienWaiverRelease'

/**
 * The drawn signature on the waiver's PDF (v2.4335): a recording stand-in for jsPDF, as
 * `lienFilingDocuments.pdf.test.ts` does — what is drawn, not the bytes. The ink prints at its own
 * proportions, 17 mm tall, sitting on the signature rule (it was the whole pad box squeezed into
 * 62×24 mm, the strokes small and off to one side).
 */
class FakeJsPDF {
  static last: FakeJsPDF | null = null
  static imageSize: { width: number; height: number } | null = { width: 300, height: 100 }
  images: Array<{ data: string; type: string; x: number; y: number; w: number; h: number; compression?: string }> = []
  lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
  texts: string[] = []
  fonts: string[] = []
  pages = 1
  constructor() {
    FakeJsPDF.last = this
  }
  setFont(_family: string, style: string) {
    this.fonts.push(style)
  }
  setFontSize() {}
  setTextColor() {}
  setDrawColor() {}
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
  getTextWidth(t: string) {
    return t.length * 2
  }
  text(t: string | string[]) {
    this.texts.push(Array.isArray(t) ? t.join('\n') : t)
  }
  line(x1: number, y1: number, x2: number, y2: number) {
    this.lines.push({ x1, y1, x2, y2 })
  }
  getImageProperties() {
    if (!FakeJsPDF.imageSize) throw new Error('bad image data')
    return FakeJsPDF.imageSize
  }
  addImage(data: string, type: string, x: number, y: number, w: number, h: number, _alias?: string, compression?: string) {
    this.images.push({ data, type, x, y, w, h, compression })
  }
  output() {
    return new Blob(['pdf'])
  }
}
vi.mock('../loadJsPDF', () => ({ loadJsPDF: async () => FakeJsPDF }))

const FIELDS: LienWaiverFields = {
  companyName: 'Click Plumbing and Electrical',
  checkFrom: '',
  amount: '17777.51',
  projectDescription: 'ATI Schertz',
  throughDate: '2026-09-10',
  signedDate: '2026-10-01',
  signerName: 'Malachi Whites',
  signerTitle: '',
}
const DRAWN = {
  mode: 'draw' as const,
  printedName: 'Malachi Whites',
  auditLine: 'Drawn by Malachi Whites on Robert’s screen in ClickTooling on Oct 1, 2026 at 4:23 PM CT, consent recorded.',
  signedYmd: '2026-10-01',
  pngDataUrl: 'data:image/png;base64,INK',
}
/** The signature rule: the one 110 mm line. */
const rule = (pdf: FakeJsPDF) => pdf.lines.find((l) => l.x2 - l.x1 === 110)!

describe('lienWaiverInkBox (v2.4335)', () => {
  it('a signature trimmed to its strokes prints 17 mm tall at its own proportions', () => {
    expect(lienWaiverInkBox(300, 100)).toEqual({ w: 51, h: 17 })
  })
  it('a very wide one narrows to 80 mm and keeps its proportions', () => {
    expect(lienWaiverInkBox(1000, 100)).toEqual({ w: 80, h: 8 })
  })
  it('no size to read: the old box width at the new height', () => {
    expect(lienWaiverInkBox(0, 0)).toEqual({ w: 62, h: 17 })
    expect(lienWaiverInkBox(Number.NaN, 40)).toEqual({ w: 62, h: 17 })
  })
})

describe('the drawn signature on the PDF (v2.4335)', () => {
  it('prints the ink at its own size with its bottom just above the rule, the name under the rule', async () => {
    FakeJsPDF.imageSize = { width: 300, height: 100 }
    await buildLienWaiverPdfBlob('unconditional_progress', FIELDS, DRAWN)
    const pdf = FakeJsPDF.last!
    expect(pdf.images).toHaveLength(1)
    const ink = pdf.images[0]!
    // Compressed: raw, the picture alone made the PDF ~300 KB.
    expect(ink).toMatchObject({ data: 'data:image/png;base64,INK', type: 'PNG', x: 23, w: 51, h: 17, compression: 'FAST' })
    expect(rule(pdf).y1 - (ink.y + ink.h)).toBeCloseTo(1, 5)
    expect(pdf.texts).toContain('Malachi Whites')
    expect(pdf.texts).toContain(', Click Plumbing and Electrical')
    // No name in italic type over the line when the ink is there.
    expect(pdf.fonts).not.toContain('italic')
  })

  it('a picture the PDF cannot read falls back to the name in italic type, as before', async () => {
    FakeJsPDF.imageSize = null
    await buildLienWaiverPdfBlob('unconditional_progress', FIELDS, DRAWN)
    const pdf = FakeJsPDF.last!
    expect(pdf.images).toHaveLength(0)
    expect(pdf.fonts).toContain('italic')
    FakeJsPDF.imageSize = { width: 300, height: 100 }
  })

  it('a typed signature draws no picture', async () => {
    await buildLienWaiverPdfBlob('unconditional_progress', FIELDS, { ...DRAWN, mode: 'type', pngDataUrl: null })
    expect(FakeJsPDF.last!.images).toHaveLength(0)
  })
})
