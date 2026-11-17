import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { cutLienScanPages, lienScanPageCount } from './lienScanStackIo'

/** A real PDF of `n` pages, each a different width, so a cut page can be told from its neighbours. */
async function stack(n: number): Promise<Blob> {
  const doc = await PDFDocument.create()
  for (let i = 1; i <= n; i += 1) doc.addPage([100 + i, 200])
  return new Blob([(await doc.save()) as BlobPart], { type: 'application/pdf' })
}
const widths = async (file: Blob) => (await PDFDocument.load(await file.arrayBuffer())).getPages().map((p) => p.getWidth())

describe('lienScanPageCount', () => {
  it('counts a PDF’s pages, and answers null for a file that is not one', async () => {
    expect(await lienScanPageCount(await stack(5))).toBe(5)
    expect(await lienScanPageCount(new Blob(['not a pdf'], { type: 'application/pdf' }))).toBeNull()
  })
})

describe('cutLienScanPages', () => {
  it('cuts the named pages into a PDF of their own, in the order given', async () => {
    const piece = await cutLienScanPages(await stack(6), [3, 4], 'stack.pdf, pages 3 and 4')
    expect(piece.type).toBe('application/pdf')
    expect(piece.name).toBe('stack.pdf, pages 3 and 4.pdf')
    expect(await widths(piece)).toEqual([103, 104])
    expect(await widths(await cutLienScanPages(await stack(6), [6, 2], 'x.pdf'))).toEqual([106, 102])
  })

  it('refuses a page the stack does not have, and a lien with no page', async () => {
    await expect(cutLienScanPages(await stack(2), [3], 'x.pdf')).rejects.toThrow('The stack has no page 3. Pick the file again.')
    await expect(cutLienScanPages(await stack(2), [], 'x.pdf')).rejects.toThrow('No page was picked for this lien.')
  })
})
