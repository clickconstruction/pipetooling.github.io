import { describe, expect, it, vi } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { buildRowCutSheet, cutSheetFileName, cutSheetPageCount, rowCutSheetPlan, cutSheetSavedLine } from './rowCutSheet'

async function pdfOf(pages: number, label: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 1; i <= pages; i++) doc.addPage([612, 100 + i]).drawText(`${label} page ${i}`, { x: 20, y: 40, size: 12, font })
  return doc.save()
}
const part = (seq: number, sheet_file: number | null, sheet_pages: number[], on_submittal = true) => ({ sequence_order: seq, sheet_file, sheet_pages, on_submittal })

describe('rowCutSheetPlan', () => {
  it('a row with its own pages: those pages, in order, once each', () => {
    expect(rowCutSheetPlan({ sheet_file: 0, sheet_pages: [31, 30, 30, 47] })).toEqual([{ fileIndex: 0, pages: [30, 31, 47] }])
  })

  it('parts that carry their own pages give them part by part, as the package does; an order-only part gives none', () => {
    const plan = rowCutSheetPlan({ sheet_file: 0, sheet_pages: [30, 31, 32, 33] }, [part(2, 1, [4]), part(1, 0, [30, 31]), part(3, 0, [99], false), part(4, null, [])])
    expect(plan).toEqual([{ fileIndex: 0, pages: [30, 31] }, { fileIndex: 1, pages: [4] }])
    expect(cutSheetPageCount(plan)).toBe(3)
  })

  it('no file or no pages: nothing to save', () => {
    expect(rowCutSheetPlan({ sheet_file: null, sheet_pages: [3] })).toEqual([])
    expect(rowCutSheetPlan({ sheet_file: 0, sheet_pages: [] })).toEqual([])
    expect(rowCutSheetPlan({ sheet_file: 0, sheet_pages: null as unknown as number[] }, [part(1, 0, [])])).toEqual([])
  })
})

describe('cutSheetFileName', () => {
  it('names the file by the tag, without what a file name cannot hold', () => {
    expect(cutSheetFileName('LAV-1')).toBe('LAV-1 cut sheet.pdf')
    expect(cutSheetFileName('WC-1, WC-2')).toBe('WC-1, WC-2 cut sheet.pdf')
    expect(cutSheetFileName('12" DEEP MOP SINK')).toBe('12 DEEP MOP SINK cut sheet.pdf')
    expect(cutSheetFileName('  ')).toBe('Accessory cut sheet.pdf')
  })
})

describe('buildRowCutSheet', () => {
  it('cuts the row’s pages out of the vendor file, in order, and reads the file once', async () => {
    const house = await pdfOf(6, 'house')
    const readFile = vi.fn(async () => house)
    const out = await buildRowCutSheet([{ fileIndex: 0, pages: [2, 3] }, { fileIndex: 0, pages: [5] }], readFile)
    expect(out.pages).toBe(3)
    expect(readFile).toHaveBeenCalledTimes(1)
    const doc = await PDFDocument.load(out.bytes)
    // Each test page is its own height, so the heights say which pages came through.
    expect(doc.getPages().map((p) => p.getHeight())).toEqual([102, 103, 105])
  })

  it('joins pages from two vendor files, and skips a page a file no longer has', async () => {
    const files = [await pdfOf(3, 'a'), await pdfOf(2, 'b')]
    const out = await buildRowCutSheet([{ fileIndex: 0, pages: [3, 9] }, { fileIndex: 1, pages: [1] }], async (i) => files[i]!)
    expect((await PDFDocument.load(out.bytes)).getPages().map((p) => p.getHeight())).toEqual([103, 101])
  })

  it('a row with no cut sheet, or pages that are all gone, says so', async () => {
    await expect(buildRowCutSheet([], async () => new Uint8Array())).rejects.toThrow('This row has no cut sheet yet.')
    const house = await pdfOf(2, 'house')
    await expect(buildRowCutSheet([{ fileIndex: 0, pages: [7] }], async () => house)).rejects.toThrow('Those pages are not in the vendor file any more.')
  })
})

describe('cutSheetSavedLine (v2.5027)', () => {
  it('says what was saved and what it is for, never to email it', () => {
    expect(cutSheetSavedLine('LAV-1 cut sheet.pdf', 3)).toBe('Saved LAV-1 cut sheet.pdf · 3 pages, to read or to file in the GC’s own system.')
    expect(cutSheetSavedLine('FV-1 cut sheet.pdf', 1)).toBe('Saved FV-1 cut sheet.pdf · 1 page, to read or to file in the GC’s own system.')
    expect(cutSheetSavedLine('x', 2)).not.toMatch(/email|text/i)
  })
})
