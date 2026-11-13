import { describe, expect, it, vi } from 'vitest'
import { FILING_BODY_SET, FILING_FIT_ONE_PAGE_STEPS, filingDocPdfBlob } from './lienFilingDocuments'

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
  /** The page each text was drawn on, beside `texts` (v2.6810: the keep-together passes). */
  textPages: number[] = []
  /** How many papers were drawn since a test last set it to 0: one, or one more per run moved to a new page. */
  static made = 0
  pages = 1
  constructor() {
    FakeJsPDF.last = this
    FakeJsPDF.made += 1
  }
  setFont() {}
  /** The type size in force, and the size and left edge each text was drawn at, beside `texts` (v2.7071: the bullet and the one-page fit). */
  size = 0
  textSizes: number[] = []
  textXs: number[] = []
  setFontSize(n: number) {
    this.size = n
  }
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
  text(t: string | string[], x?: number) {
    this.texts.push(Array.isArray(t) ? t.join('\n') : t)
    this.textPages.push(this.pages)
    this.textSizes.push(this.size)
    this.textXs.push(x ?? 0)
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
  /** The blob names the drawing it came from, so a test can tell which of several drawings was kept. */
  output() {
    const body = this.textSizes[this.texts.findIndex((t) => t.startsWith('Paragraph 1.'))] ?? 0
    return new Blob([`pdf pages=${this.pages} body=${body}`])
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
      { kind: 'windowAddress', lines: ['AXO Schertz Holdings LLC', '17300 IH 35 N', 'Schertz, TX 78154'] },
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

describe('a signature travels with its statement and the notary’s block (v2.6810)', () => {
  // The office's printed affidavit put item 10 at the foot of page 1 and the signature alone at the head of page 2.
  const pageOf = (pdf: FakeJsPDF, text: string) => pdf.textPages[pdf.texts.findIndex((t) => t.startsWith(text))]
  const paper = (fillers: number): Parameters<typeof filingDocPdfBlob>[0] => [
    ...Array.from({ length: fillers }, (_, i) => ({ kind: 'numbered' as const, n: i + 1, text: `Filler statement ${i + 1}.` })),
    { kind: 'numbered', n: 99, text: 'Claimant claims a lien.' },
    { kind: 'signature', lines: ['Rey Master, Master Plumber', 'Sample Plumbing'] },
    { kind: 'notarial', who: 'Rey Master, Master Plumber' },
  ]

  it('at every length the last item, the signature and the notary’s line are on one page, and some lengths needed the run moved', async () => {
    let moved = 0
    for (let fillers = 20; fillers <= 45; fillers++) {
      FakeJsPDF.made = 0
      await filingDocPdfBlob(paper(fillers))
      const pdf = FakeJsPDF.last!
      const page = pageOf(pdf, '99. Claimant claims a lien.')
      expect(page, `${fillers} fillers`).toBeGreaterThanOrEqual(1)
      expect(pageOf(pdf, 'Rey Master, Master Plumber'), `${fillers} fillers: the signature`).toBe(page)
      expect(pageOf(pdf, 'Notary Public, State of Texas'), `${fillers} fillers: the notary`).toBe(page)
      if (FakeJsPDF.made > 1) moved += 1
    }
    // The sweep crosses the foot of page 1: without the passes some of these split.
    expect(moved).toBeGreaterThan(0)
  })

  it('a paper whose closing already fits is drawn once', async () => {
    FakeJsPDF.made = 0
    await filingDocPdfBlob(paper(3))
    expect(FakeJsPDF.made).toBe(1)
    expect(FakeJsPDF.last!.pages).toBe(1)
  })
})

describe('the short lien affidavit in PDF (punch list #305)', () => {
  it('draws the notary’s printed-name line and no commission line, with nothing above the title, on one page', async () => {
    const { buildLienAffidavitBlocks } = await import('./lienFilingDocuments')
    const blocks = buildLienAffidavitBlocks(
      { county: 'Bexar', claimantPersonName: 'Rey Master', claimantCompany: 'Sample Plumbing LLC', claimantAddress: '1 Shop Rd, San Antonio, TX 78201', legalDescription: 'CB 1 BLK B LOT 7', propertyAddress: '12 Sample Rd, San Antonio, TX 78209', contractedWithName: 'Harborline Builders', workDescription: 'Plumbing labor and materials', workStart: '', workEnd: '', ownerName: 'Pat Owner', ownerAddress: '4 Owner Ct, San Antonio, TX 78209', originalContractorName: 'Harborline Builders', originalContractorAddress: '9 Yard St, Devine TX 78016', contractAmount: '5000.00', paidAmount: '0.00', unpaidAmount: '2000.00', includeNoticesSworn: true, form: 'short', isSub: true, workMonthsWords: 'July and August 2026', noticesSentWords: 'certified mail on September 14, 2026' },
      { letterhead: { company: 'Sample Plumbing LLC', licenseLine: '', contactLines: ['(210) 555-0100'] }, refItems: ['Job #700', 'Work month 2026-08'] },
    )
    FakeJsPDF.made = 0
    await filingDocPdfBlob(blocks)
    const pdf = FakeJsPDF.last!
    expect(pdf.texts[0]).toBe("MECHANIC'S AND MATERIALMAN'S LIEN AFFIDAVIT")
    // Both county blanks are plain: the top one and the notary's own.
    expect(pdf.texts.filter((t) => t === 'COUNTY OF ___________')).toHaveLength(2)
    expect(pdf.texts.join(' ')).not.toContain('where signed')
    expect(pdf.texts).not.toContain('COUNTY OF BEXAR')
    expect(pdf.texts.some((t) => t.includes('Job #700') || t.includes('JOB #700') || t.includes('(210) 555-0100'))).toBe(false)
    expect(pdf.texts).toContain('Printed name: ______________________________')
    expect(pdf.texts.some((t) => t.includes('My commission expires'))).toBe(false)
    expect(pdf.texts.some((t) => t.includes('7. The amount of the claim is $2,000.00.'))).toBe(true)
    expect(pdf.pages).toBe(1)
  })
})

describe('the short lien affidavit on a homestead in PDF (punch list #305)', () => {
  it('draws the § 53.254(f) notice first, bold at 12 point, then the title, still on one page', async () => {
    const { buildLienAffidavitBlocks, HOMESTEAD_AFFIDAVIT_NOTICE } = await import('./lienFilingDocuments')
    const blocks = buildLienAffidavitBlocks({ ...{ county: 'Bexar', claimantPersonName: 'Rey Master', claimantCompany: 'Sample Plumbing LLC', claimantAddress: '1 Shop Rd, San Antonio, TX 78201', legalDescription: 'CB 1 BLK B LOT 7', propertyAddress: '12 Sample Rd, San Antonio, TX 78209', contractedWithName: 'Harborline Builders', workDescription: 'Plumbing labor and materials', workStart: '', workEnd: '', ownerName: 'Pat Owner', ownerAddress: '4 Owner Ct, San Antonio, TX 78209', originalContractorName: 'Harborline Builders', originalContractorAddress: '9 Yard St, Devine TX 78016', contractAmount: '5000.00', paidAmount: '0.00', unpaidAmount: '2000.00', includeNoticesSworn: true, form: 'short', isSub: true, workMonthsWords: 'July and August 2026', noticesSentWords: 'certified mail on September 14, 2026' }, homestead: true })
    FakeJsPDF.made = 0
    await filingDocPdfBlob(blocks)
    const pdf = FakeJsPDF.last!
    expect(pdf.texts[0]).toBe(HOMESTEAD_AFFIDAVIT_NOTICE)
    expect(pdf.texts[1]).toBe("MECHANIC'S AND MATERIALMAN'S LIEN AFFIDAVIT")
    expect(pdf.pages).toBe(1)
  })
})

describe('a bullet in PDF (v2.7071)', () => {
  it('draws the mark in from the margin and the words further in, as two texts, and leaves any other paragraph at the margin', async () => {
    await filingDocPdfBlob([
      { kind: 'paragraph', text: 'Any one of these works.' },
      { kind: 'paragraph', text: '• Have the builder pay us this week.' },
      { kind: 'paragraph', text: 'Call our office.' },
    ])
    const pdf = FakeJsPDF.last!
    expect(pdf.texts).toEqual(['Any one of these works.', '•', 'Have the builder pay us this week.', 'Call our office.', 'Page 1 of 1'])
    const [body, mark, words, after] = pdf.textXs
    expect(mark!).toBeGreaterThan(body!)
    expect(words!).toBeGreaterThan(mark!)
    expect(after).toBe(body)
  })
})

describe('a letter asked to fit one page in PDF (v2.7071)', () => {
  const letter = (paragraphs: number): Parameters<typeof filingDocPdfBlob>[0] => Array.from({ length: paragraphs }, (_, i) => ({ kind: 'paragraph' as const, text: `Paragraph ${i + 1}.` }))
  const kept = async (blob: Blob) => {
    const [, pages, body] = /pages=(\d+) body=([\d.]+)/.exec(await blob.text())!
    return { pages: Number(pages), body: Number(body) }
  }

  it('a letter that fits is drawn once, as every paper is', async () => {
    FakeJsPDF.made = 0
    expect(await kept(await filingDocPdfBlob(letter(10), { fit: 'one-page' }))).toEqual({ pages: 1, body: FILING_BODY_SET.size })
    expect(FakeJsPDF.made).toBe(1)
  })

  it('a letter a few lines over is drawn again with the lines closer and the same type, and that drawing is kept', async () => {
    // 29 one-line paragraphs run a line past the page at the usual setting.
    expect(await kept(await filingDocPdfBlob(letter(29)))).toEqual({ pages: 2, body: FILING_BODY_SET.size })
    expect(await kept(await filingDocPdfBlob(letter(29), { fit: 'one-page' }))).toEqual({ pages: 1, body: 11.5 })
    expect(FILING_FIT_ONE_PAGE_STEPS[0]!.size).toBe(FILING_BODY_SET.size)
  })

  it('a longer one steps the type down, never under 10 point', async () => {
    const got = await kept(await filingDocPdfBlob(letter(36), { fit: 'one-page' }))
    expect(got.pages).toBe(1)
    expect(got.body).toBeLessThan(FILING_BODY_SET.size)
    expect(got.body).toBeGreaterThanOrEqual(10)
    expect(Math.min(...FILING_FIT_ONE_PAGE_STEPS.map((s) => s.size))).toBe(10)
  })

  it('a letter no step brings to one page keeps the usual setting, and a paper not asked to fit is never touched', async () => {
    expect(await kept(await filingDocPdfBlob(letter(60), { fit: 'one-page' }))).toEqual({ pages: 3, body: FILING_BODY_SET.size })
    expect(await kept(await filingDocPdfBlob(letter(36)))).toEqual({ pages: 2, body: FILING_BODY_SET.size })
  })
})
