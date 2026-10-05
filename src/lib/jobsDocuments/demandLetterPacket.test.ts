import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { buildDemandLetterPacket, enclosureItems, enclosuresLine, exhibitKind, exhibitLabels, exhibitsSentence } from './demandLetterPacket'

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

  it('a custom stamp (the notice\'s INVOICE) replaces EXHIBIT and keeps the page count (v2.3437)', async () => {
    const packet = await buildDemandLetterPacket(await pdfWithPages(1), [{ label: 'A', stamp: 'INVOICE', title: 'Invoice #2, August 18, 2026', blob: await pdfWithPages(2) }])
    expect(packet.exhibits).toEqual([{ label: 'A', title: 'Invoice #2, August 18, 2026', pages: 2 }])
    expect(packet.totalPages).toBe(3)
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

  it('labels run in order with no gap: several invoices are A-1 … A-n, the next paper takes the next letter', () => {
    expect(exhibitLabels({ invoices: 1, agreement: true, delivery: true })).toEqual({ invoices: ['A'], agreement: 'B', delivery: 'C' })
    expect(exhibitLabels({ invoices: 4, agreement: false, delivery: true })).toEqual({ invoices: ['A-1', 'A-2', 'A-3', 'A-4'], agreement: '', delivery: 'B' })
    expect(exhibitLabels({ invoices: 0, agreement: false, delivery: true })).toEqual({ invoices: [], agreement: '', delivery: 'A' })
    expect(exhibitLabels({ invoices: 2, agreement: true, delivery: false })).toEqual({ invoices: ['A-1', 'A-2'], agreement: 'B', delivery: '' })
  })

  it('an exhibit is read by its kind, and a letter recorded before kinds by its old letter', () => {
    expect(exhibitKind({ label: 'B', kind: 'delivery' })).toBe('delivery')
    expect(exhibitKind({ label: 'A' })).toBe('invoice')
    expect(exhibitKind({ label: 'B' })).toBe('agreement')
    expect(exhibitKind({ label: 'C' })).toBe('delivery')
  })

  it('the sentence names several invoices as a range and the delivery record by the letter it wears', () => {
    const four = ['A-1', 'A-2', 'A-3', 'A-4'].map((label) => ({ label, kind: 'invoice' as const, title: '' }))
    expect(exhibitsSentence([...four, { label: 'B', kind: 'delivery', title: '' }])).toBe('The invoices are enclosed as Exhibits A-1 to A-4 and the delivery record as Exhibit B.')
    expect(exhibitsSentence(four.slice(0, 2))).toBe('The invoices are enclosed as Exhibits A-1 and A-2.')
    expect(enclosureItems([{ label: 'A-1', title: 'Invoice #1', pages: 1 }, { label: 'B', title: 'Delivery record', pages: 0 }])).toEqual(['Exhibit A-1 — Invoice #1 (1 page)', 'Exhibit B — Delivery record'])
  })
})
