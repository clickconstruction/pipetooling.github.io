/**
 * The sample a GC downloads (punch list #389, step 5). The shared file takes pdf-lib as a parameter, so here it runs
 * on node_modules' copy, as the person paper's does. Every name and word is made up.
 */
import { describe, expect, it } from 'vitest'
import * as pdfLib from 'pdf-lib'
import { buildJobPaperSamplePdf, JOB_PAPER_SAMPLE_MARK, JOB_PAPER_SAMPLE_PARTY, SAMPLE_REFUSALS, sampleRefusal, samplePdfFacts, samplePdfFilename, samplePdfLevelLine, samplePdfParagraphs, samplePdfSafe, samplePdfStamp, type SamplePdfLib } from '../../../supabase/functions/_shared/jobPaperSamplePdf'
import { SAMPLE_MARK, SAMPLE_PARTY, sampleStamp } from './paperSummary'
import { parseSettingsDef } from './paperSettings'

const lib = pdfLib as unknown as SamplePdfLib
const input = (paragraphs: string[]) => ({
  title: 'Sample paper',
  company: 'Made-up Plumbing',
  facts: samplePdfFacts(),
  paragraphs,
  stamp: samplePdfStamp({ label: 'Standard', alignedWith: 'Aligned with a placeholder place' }, 3),
  mark: JOB_PAPER_SAMPLE_MARK,
})

describe('the sample’s words', () => {
  it('names the same made-up party and mark as the Contract Book’s own sample', () => {
    expect(JOB_PAPER_SAMPLE_PARTY).toEqual(SAMPLE_PARTY)
    expect(JOB_PAPER_SAMPLE_MARK).toBe(SAMPLE_MARK.en)
  })

  it('stamps it as the Contract Book’s sample does, for a level and for a mix', () => {
    const def = parseSettingsDef({
      settings: [{ key: 'photos', label: 'Photos', choices: [{ key: 'off', label: 'Off', says: 'x', out: true }, { key: 'standard', label: 'Standard', says: 'y' }] }],
      fields: [],
      levels: [{ key: 'standard', label: 'Standard', alignedWith: 'Aligned with a placeholder place', picks: { photos: 'standard' } }],
    })!
    expect(samplePdfStamp({ label: 'Standard', alignedWith: 'Aligned with a placeholder place' }, 3)).toBe(sampleStamp(def, { photos: 'standard' }, 3))
    expect(samplePdfStamp(null, 2)).toBe(sampleStamp(def, { photos: 'off' }, 2))
    expect(samplePdfLevelLine({ label: 'Standard', alignedWith: '' })).toBe('Standard')
  })

  it('names a made-up job and signer, never a real one', () => {
    expect(samplePdfFacts()).toEqual([
      ['The job', 'Job J0000, a sample'],
      ['Signer', 'Jordan Sample, Sample Sub LLC'],
    ])
  })

  it('reads the assembled paper as numbered paragraphs, the exhibit after the base', () => {
    expect(samplePdfParagraphs({ clauses: [{ n: 1, text: ' First placeholder. ' }, { n: 2, text: 'Second placeholder.' }, { n: 3, text: '' }], exhibit: [{ n: 4, text: 'Exhibit placeholder.' }] })).toEqual([
      '1. First placeholder.',
      '2. Second placeholder.',
      '4. Exhibit placeholder.',
    ])
    expect(samplePdfParagraphs(null)).toEqual([])
    expect(samplePdfParagraphs({ clauses: 'x' })).toEqual([])
  })

  it('names the file after the paper, with nothing a file system refuses', () => {
    expect(samplePdfFilename('Site rules: photos / phones')).toBe('Sample - Site rules photos phones.pdf')
    expect(samplePdfFilename('  ')).toBe('Sample - paper.pdf')
  })

  it('drops what the standard fonts cannot draw', () => {
    expect(samplePdfSafe('Línea — “uno”\n✓ dos')).toBe('Línea — “uno”  dos')
  })
})

describe('who may download a job’s sample', () => {
  const link = { customer_id: 'gc-1', audience: 'gc', revoked_at: null }
  const row = { removed_at: null, settings: { photos: 'standard' }, book_document_id: 'book-1' }
  const job = { gc_customer_id: 'gc-1' }

  it('the GC on the job, through a link that shows their GC jobs', () => {
    expect(sampleRefusal(link, row, job)).toBeNull()
    expect(sampleRefusal({ ...link, audience: 'all' }, row, job)).toBeNull()
  })

  it('never a link that is gone, or one that shows only the jobs they pay for', () => {
    expect(sampleRefusal(null, row, job)).toBe(SAMPLE_REFUSALS.inactive)
    expect(sampleRefusal({ ...link, revoked_at: '2026-11-24T00:00:00Z' }, row, job)).toBe(SAMPLE_REFUSALS.inactive)
    expect(sampleRefusal({ ...link, audience: 'customer' }, row, job)).toBe(SAMPLE_REFUSALS.none)
  })

  it('never another customer’s job, a job with no GC, or a job that is gone', () => {
    expect(sampleRefusal(link, row, { gc_customer_id: 'gc-2' })).toBe(SAMPLE_REFUSALS.none)
    expect(sampleRefusal(link, row, { gc_customer_id: null })).toBe(SAMPLE_REFUSALS.none)
    expect(sampleRefusal(link, row, null)).toBe(SAMPLE_REFUSALS.none)
  })

  it('never a paper taken off, a paper in prose, or one whose Book entry is gone', () => {
    expect(sampleRefusal(link, { ...row, removed_at: '2026-11-24T00:00:00Z' }, job)).toBe(SAMPLE_REFUSALS.none)
    expect(sampleRefusal(link, { ...row, settings: null }, job)).toBe(SAMPLE_REFUSALS.none)
    expect(sampleRefusal(link, { ...row, book_document_id: null }, job)).toBe(SAMPLE_REFUSALS.none)
    expect(sampleRefusal(link, null, job)).toBe(SAMPLE_REFUSALS.none)
  })
})

describe('the sample PDF', () => {
  it('draws one page for a short paper, titled as a sample', async () => {
    const bytes = await buildJobPaperSamplePdf(lib, input(['1. First placeholder.', '2. Second placeholder.']))
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    const doc = await pdfLib.PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
    expect(doc.getTitle()).toBe('SAMPLE Sample paper')
    expect(doc.getPage(0).getSize()).toEqual({ width: 612, height: 792 })
  })

  it('runs a long paper onto more pages', async () => {
    const long = Array.from({ length: 90 }, (_, i) => `${i + 1}. Placeholder clause ${i + 1}, with enough made-up words to run past the end of one line of the page and onto a second.`)
    const doc = await pdfLib.PDFDocument.load(await buildJobPaperSamplePdf(lib, input(long)))
    expect(doc.getPageCount()).toBeGreaterThan(2)
  })

  it('draws a paper with no words, and one with words the fonts cannot hold', async () => {
    expect((await pdfLib.PDFDocument.load(await buildJobPaperSamplePdf(lib, input([])))).getPageCount()).toBe(1)
    expect((await pdfLib.PDFDocument.load(await buildJobPaperSamplePdf(lib, { ...input(['1. 写 ✓ Placeholder.']), title: '', company: '' }))).getPageCount()).toBe(1)
  })
})
