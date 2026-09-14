import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { buildDemandLetterPacket, enclosuresLine, exhibitsSentence } from './demandLetterPacket'

async function pdfWithPages(n: number): Promise<Blob> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < n; i++) doc.addPage([612, 792])
  return new Blob([(await doc.save()) as BlobPart], { type: 'application/pdf' })
}

describe('demand letter packet (v2.3429)', () => {
  it('merges the letter and the exhibits in order and counts their pages', async () => {
    const packet = await buildDemandLetterPacket(await pdfWithPages(2), [
      { label: 'A', title: 'Invoice #867-2608180928, as sent August 18, 2026', blob: await pdfWithPages(1) },
      { label: 'C', title: 'Delivery record', blob: await pdfWithPages(1) },
    ])
    expect(packet.letterPages).toBe(2)
    expect(packet.exhibits).toEqual([
      { label: 'A', title: 'Invoice #867-2608180928, as sent August 18, 2026', pages: 1 },
      { label: 'C', title: 'Delivery record', pages: 1 },
    ])
    expect(packet.totalPages).toBe(4)
    const merged = await PDFDocument.load(await packet.blob.arrayBuffer())
    expect(merged.getPageCount()).toBe(4)
    expect(packet.blob.type).toBe('application/pdf')
  })

  it('a letter with no exhibits is just the letter', async () => {
    const packet = await buildDemandLetterPacket(await pdfWithPages(1), [])
    expect(packet.totalPages).toBe(1)
    expect(packet.exhibits).toEqual([])
  })

  it('names the enclosures the way a letter does', () => {
    expect(enclosuresLine([])).toBe('')
    expect(enclosuresLine([{ label: 'A', title: 'Invoice #1', pages: 1 }])).toBe('Enclosure: Exhibit A — Invoice #1 (1 page)')
    expect(enclosuresLine([{ label: 'A', title: 'Invoice #1', pages: 2 }, { label: 'C', title: 'Delivery record', pages: 1 }])).toBe(
      'Enclosures: Exhibit A — Invoice #1 (2 pages) · Exhibit C — Delivery record (1 page)',
    )
    expect(exhibitsSentence([{ label: 'A', title: '' }])).toBe('The invoice is enclosed as Exhibit A.')
    expect(exhibitsSentence([{ label: 'A', title: '' }, { label: 'B', title: '' }, { label: 'C', title: '' }])).toBe(
      'The invoice is enclosed as Exhibit A, the signed agreement as Exhibit B and the delivery record as Exhibit C.',
    )
    expect(exhibitsSentence([{ label: 'C', title: '' }])).toBe('The delivery record as Exhibit C.')
  })
})
