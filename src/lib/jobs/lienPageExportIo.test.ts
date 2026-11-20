import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import type { FilingDocBlock } from '../jobsDocuments/lienFilingDocuments'

const filingDocPdfBlob = vi.fn()
const buildLienWaiverPdfBlob = vi.fn()
vi.mock('../jobsDocuments/lienFilingDocuments', () => ({
  filingDocPdfBlob: (...a: unknown[]) => filingDocPdfBlob(...a),
  filingDocFooter: (kind: string) => `citation:${kind}`,
}))
vi.mock('../jobsDocuments/lienWaiverRelease', () => ({ buildLienWaiverPdfBlob: (...a: unknown[]) => buildLienWaiverPdfBlob(...a) }))

import { buildLienPagePdf, finishLienPagePdf, lienPageExportBlob, type FinishPdfLib, type LienExportParts } from './lienPageExportIo'

const block = (text: string) => ({ kind: 'paragraph', text }) as unknown as FilingDocBlock

/** A real two-page letter-size PDF, as a builder would hand one back. */
async function madePdf(pages = 2): Promise<Blob> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([612, 792])
  return new Blob([(await doc.save()) as BlobPart], { type: 'application/pdf' })
}

const parts = (over: Partial<LienExportParts> = {}): LienExportParts => ({
  coverBlocks: [block('cover')],
  noticeBlocks: () => [block('notice')],
  payBlocks: [block('pay')],
  release: { formType: 'conditional_progress', fields: { companyName: 'ZZ Test Plumbing' }, signature: null } as unknown as LienExportParts['release'],
  ...over,
})

beforeEach(async () => {
  filingDocPdfBlob.mockReset().mockResolvedValue(await madePdf())
  buildLienWaiverPdfBlob.mockReset().mockResolvedValue(await madePdf(1))
})

describe('buildLienPagePdf — each page as the run makes it', () => {
  it('draws the cover held to one page with no citation', async () => {
    await buildLienPagePdf('cover', parts())
    expect(filingDocPdfBlob).toHaveBeenCalledWith([block('cover')], { fit: 'one-page' })
  })
  it('draws the notice and the pay page with the § 53.056 citation', async () => {
    await buildLienPagePdf('notice', parts())
    expect(filingDocPdfBlob).toHaveBeenLastCalledWith([block('notice')], { footer: 'citation:notice_53_056' })
    await buildLienPagePdf('pay', parts())
    expect(filingDocPdfBlob).toHaveBeenLastCalledWith([block('pay')], { footer: 'citation:notice_53_056' })
  })
  it("draws the release with the waiver's own builder", async () => {
    const p = parts()
    await buildLienPagePdf('release', p)
    expect(buildLienWaiverPdfBlob).toHaveBeenCalledWith('conditional_progress', p.release?.fields, null)
    expect(filingDocPdfBlob).not.toHaveBeenCalled()
  })
  it('says why when the pane holds no such page', async () => {
    await expect(buildLienPagePdf('release', parts({ release: null }))).rejects.toThrow('This notice has no conditional release.')
    await expect(buildLienPagePdf('pay', parts({ payBlocks: [] }))).rejects.toThrow('This page has nothing on it yet.')
  })
})

describe('finishLienPagePdf — the title, and the draft line on a draft', () => {
  /** A stand-in for pdf-lib that keeps what was drawn. */
  function fakeLib() {
    const drawn: Array<{ text: string; x: number; y: number; size: number }> = []
    const titles: Array<{ title: string; opts: unknown }> = []
    const page = () => ({ getHeight: () => 792, drawText: (text: string, o: { x: number; y: number; size: number }) => void drawn.push({ text, x: o.x, y: o.y, size: o.size }) })
    const pages = [page(), page()]
    const lib: FinishPdfLib = {
      PDFDocument: {
        load: async () => ({
          setTitle: (title, opts) => void titles.push({ title, opts }),
          embedFont: async () => ({ widthOfTextAtSize: () => 100 }),
          getPages: () => pages,
          save: async () => new Uint8Array([1, 2, 3]),
        }),
      },
      StandardFonts: { HelveticaBold: 'Helvetica-Bold' },
      rgb: (r, g, b) => ({ r, g, b }),
    }
    return { lib, drawn, titles }
  }
  const MM = 72 / 25.4

  it('stamps the draft line on every page at the left of the foot', async () => {
    const f = fakeLib()
    await finishLienPagePdf(await madePdf(), { title: '523 Marsden Hills, cover letter', draftLine: 'Draft, not sent · November 15, 2026', stamp: { align: 'left', xMm: 22, baselineMm: 272 } }, async () => f.lib)
    expect(f.titles).toEqual([{ title: '523 Marsden Hills, cover letter', opts: { showInWindowTitleBar: true } }])
    expect(f.drawn).toHaveLength(2)
    expect(f.drawn[0]).toMatchObject({ text: 'Draft, not sent · November 15, 2026', size: 7 })
    expect(f.drawn[0]!.x).toBeCloseTo(22 * MM, 5)
    expect(f.drawn[0]!.y).toBeCloseTo(792 - 272 * MM, 5)
  })
  it('centres the line on its x where the foot holds words at its left', async () => {
    const f = fakeLib()
    await finishLienPagePdf(await madePdf(), { title: 't', draftLine: 'Draft, not sent · November 15, 2026', stamp: { align: 'center', xMm: 135, baselineMm: 274 } }, async () => f.lib)
    expect(f.drawn[0]!.x).toBeCloseTo(135 * MM - 50, 5)
    expect(f.drawn[0]!.y).toBeCloseTo(792 - 274 * MM, 5)
  })
  it('draws nothing on an approved page, and still titles it', async () => {
    const f = fakeLib()
    await finishLienPagePdf(await madePdf(), { title: '523 Marsden Hills, notice', draftLine: '', stamp: { align: 'left', xMm: 22, baselineMm: 272 } }, async () => f.lib)
    expect(f.drawn).toHaveLength(0)
    expect(f.titles).toHaveLength(1)
  })
  it('with the real library: the file keeps its pages, reads its title, and a draft grows by its line', async () => {
    const stamp = { align: 'left' as const, xMm: 22, baselineMm: 272 }
    const plain = await finishLienPagePdf(await madePdf(), { title: '523 Marsden Hills, cover letter', draftLine: '', stamp })
    const draft = await finishLienPagePdf(await madePdf(), { title: '523 Marsden Hills, cover letter', draftLine: 'Draft, not sent · November 15, 2026', stamp })
    const read = await PDFDocument.load(await draft.arrayBuffer())
    expect(read.getPageCount()).toBe(2)
    expect(read.getTitle()).toBe('523 Marsden Hills, cover letter')
    expect(draft.type).toBe('application/pdf')
    expect(draft.size).toBeGreaterThan(plain.size)
  })
})

describe('lienPageExportBlob — made, then finished', () => {
  it('hands back a titled PDF for the page', async () => {
    const blob = await lienPageExportBlob('notice', parts(), { title: '523 Marsden Hills, notice', draftLine: 'Draft, not sent · November 15, 2026' })
    const read = await PDFDocument.load(await blob.arrayBuffer())
    expect(read.getTitle()).toBe('523 Marsden Hills, notice')
    expect(read.getPageCount()).toBe(2)
  })
})
