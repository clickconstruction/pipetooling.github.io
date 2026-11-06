/**
 * A filed stage checklist as a PDF (punch list #237, PR 3), on node_modules' pdf-lib: the sweep's builder draws from the
 * record's snapshot, embeds a drawn mark's PNG where one is given and prints the name in italic where none is, and the
 * words it stamps match the paper's kernel. A made-up record.
 */
import { describe, expect, it } from 'vitest'
import * as pdfLib from 'pdf-lib'
import type { PdfLibLike } from '../../../supabase/functions/_shared/jobContractPdf'
import { buildStageChecklistPdf, pdfFootWords, pdfStampWhen, pdfStampWords, recordPdfFileName, type RecordPdfInput } from '../../../supabase/functions/_shared/stageChecklistPdf'
import { filedFootWords, filedWhenWords } from './stageChecklistRecord'

// A 2×2 white PNG, so the builder has a mark to embed.
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAD0lEQVR42mP8z8DwnwEIAAr8Av7p0J9xAAAAAElFTkSuQmCC'), (c) => c.charCodeAt(0))

const INPUT: RecordPdfInput = {
  recordId: 'CL-1042-1',
  version: 1,
  stageName: 'Trim Set',
  filedAtIso: '2026-11-01T15:25:00.000Z',
  job: { number: '1042', name: 'Harbor Lane Offices', customer: 'Pruett & Vance', address: '12 Harbor Lane' },
  rows: [
    { words: 'Did the final water test hold?', pick: 'yes', by: 'Luis Ortega', at: '2026-11-01T15:14:00.000Z', signature: { mode: 'draw', printedName: 'Luis Ortega', signedAt: '2026-11-01T15:14:00.000Z', storagePath: 'job-1/sig/a1.png' } },
    { words: 'Are the cleanouts capped?', pick: 'no', note: 'Roofer not here until Mon', by: 'Luis Ortega', at: '2026-11-01T15:20:00.000Z', photo: { fileName: 'x.jpg', driveFileId: 'd1' } },
    { words: 'Are the carriers set?', sheet: 'P-201 detail 4', pick: 'not_here', by: 'Luis Ortega', at: '2026-11-01T15:25:00.000Z', signature: { mode: 'type', printedName: 'Luis Ortega', signedAt: '2026-11-01T15:25:00.000Z', storagePath: null } },
  ],
  skipped: [{ words: 'Is the grease interceptor set?', by: 'Pat Sample', why: 'the owner took it out' }],
  answerCount: 3,
  signedCount: 2,
  noCount: 1,
  inks: new Map([['job-1/sig/a1.png', PNG]]),
}

describe('buildStageChecklistPdf', () => {
  it('draws a Letter PDF from the snapshot, embedding the drawn mark and printing the typed name', async () => {
    const bytes = await buildStageChecklistPdf(pdfLib as unknown as PdfLibLike, INPUT)
    expect(bytes.byteLength).toBeGreaterThan(1500)
    const doc = await pdfLib.PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
    expect(doc.getTitle()).toBe('CL-1042-1 · Trim Set checklist')
    const page = doc.getPage(0)
    expect(page.getWidth()).toBe(612)
    expect(page.getHeight()).toBe(792)
    // The embedded PNG is an XObject on the page; a typed signature embeds nothing.
    const xobjects = page.node.Resources()?.lookup(pdfLib.PDFName.of('XObject'))
    expect(xobjects?.toString()).toContain('Image')
  })
  it('a record with no rows and no inks still draws', async () => {
    const bytes = await buildStageChecklistPdf(pdfLib as unknown as PdfLibLike, { ...INPUT, rows: [], skipped: [], inks: new Map(), answerCount: 0, signedCount: 0, noCount: 0 })
    expect((await pdfLib.PDFDocument.load(bytes)).getPageCount()).toBe(1)
  })
  it('stamps and foots the paper with the kernel’s own words', () => {
    expect(pdfStampWhen('2026-11-01T15:25:00.000Z')).toBe(filedWhenWords('2026-11-01T15:25:00.000Z'))
    expect(pdfStampWords('Luis Ortega', '2026-11-01T15:14:00.000Z')).toBe('Luis Ortega · Nov 1 · 9:14 am')
    expect(pdfStampWords('', null)).toBe('someone')
    expect(pdfFootWords('Trim Set', 1)).toBe(filedFootWords('Trim Set', 1))
    expect(pdfFootWords('Trim Set', 0)).toBe(filedFootWords('Trim Set', 0))
    expect(recordPdfFileName('CL-1042-1', 'Trim Set')).toBe('CL-1042-1 Trim Set checklist.pdf')
    expect(recordPdfFileName('CL-1042-1', 'Rough: in/out')).toBe('CL-1042-1 Rough in out checklist.pdf')
  })
})
