import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { pageCount, trimPdf } from './trimPdf'

async function fivePagePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 1; i <= 5; i++) {
    const page = doc.addPage([612, 792])
    page.drawText(`Cut sheet page ${i}`, { x: 72, y: 700, size: 18, font })
  }
  return doc.save()
}

describe('trimPdf', () => {
  it('keeps the listed pages in original order, ignoring order, duplicates and out-of-range', async () => {
    const src = await fivePagePdf()
    const result = await trimPdf(src, [4, 2, 2, 9])
    expect(result.kept).toBe(2)
    expect(result.dropped).toBe(3)
    expect(result.map).toEqual({ 2: 1, 4: 2 })
    const out = await PDFDocument.load(result.bytes)
    expect(out.getPageCount()).toBe(2)
  })

  it('accepts an ArrayBuffer and keeps everything when every page is listed', async () => {
    const src = await fivePagePdf()
    const buf = src.buffer.slice(src.byteOffset, src.byteOffset + src.byteLength) as ArrayBuffer
    const result = await trimPdf(buf, [5, 4, 3, 2, 1])
    expect(result.kept).toBe(5)
    expect(result.dropped).toBe(0)
    expect(result.map).toEqual({ 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 })
  })

  it('rejects an empty keep list and a list with nothing in range', async () => {
    const src = await fivePagePdf()
    await expect(trimPdf(src, [])).rejects.toThrow('nothing to keep')
    await expect(trimPdf(src, [0, 6, 2.5])).rejects.toThrow('nothing to keep')
  })

  it('pageCount reads the page count', async () => {
    expect(await pageCount(await fivePagePdf())).toBe(5)
  })

  it('uses the injected loader', async () => {
    let calls = 0
    const load = async () => {
      calls += 1
      return import('pdf-lib')
    }
    const result = await trimPdf(await fivePagePdf(), [1], load)
    expect(calls).toBe(1)
    expect(result.kept).toBe(1)
  })
})
