import { describe, expect, it } from 'vitest'
import { PDFDocument, PDFName } from 'pdf-lib'
import { buildLienServeJobPdf, buildLienServeStackPdf, drawLienMailSheet, inspectLienCopy, type LienServePdfJob } from './lienServePdf'
import type { LienServeSheet } from './lienServePackets'

/** A real PDF of `n` pages. Each page's width is `base + its number`, so a page can be told from every other in a print. */
async function pdf(n: number, base: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 1; i <= n; i += 1) doc.addPage([base + i, 700])
  return doc.save()
}
const blob = (bytes: Uint8Array) => new Blob([bytes as BlobPart], { type: 'application/pdf' })
const widths = async (file: Blob | Uint8Array) => (await PDFDocument.load(file instanceof Blob ? await file.arrayBuffer() : file)).getPages().map((p) => Math.round(p.getWidth()))

/** A one-pixel PNG. */
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))

// Every name and address here is made up.
const sheet = (rows: number, held = 0): LienServeSheet => ({
  tag: 'Mail sheet · keep this page in the office',
  title: `Copies of filed lien affidavits: ${rows} envelopes`,
  printed: 'Printed November 19, 2026',
  statute: 'Texas Property Code § 53.055',
  stepsHead: 'From the printer to the mail',
  steps: ['Each envelope takes its letter and the clerk’s stamped copy behind it. They come off the printer in the order below.', 'Mail each envelope by certified mail. Write its number in the last column.', 'In the app, open the Lien desk.'],
  columns: ['#', 'Job', 'Copy to', 'Name and address on the envelope', 'Pages', 'Mail by', 'Certified mail number'],
  rows: Array.from({ length: rows }, (_, i) => ({ n: i + 1, job: `22${i} · Sample Job with a long name that wraps`, to: i % 2 ? 'Original contractor' : 'Owner', name: 'Hollow Creek Holdings LLC — Peña & Søn', address: '88 Sample Ridge Rd, Suite 400, Austin, TX 78700', pages: '3', mailBy: i === 0 ? 'Nov 11 · late' : 'Nov 23' })),
  heldHead: 'Not in this print',
  held: Array.from({ length: held }, (_, i) => ({ job: `23${i} · Held Job`, words: 'Not printed: no stamped copy saved.', act: 'Add the clerk’s stamped scan on the job’s Lien window.' })),
  foot: ['Mail sheet printed November 19, 2026', 'The first letter is the next page'],
})

describe('inspectLienCopy', () => {
  it('counts a PDF’s pages and takes its size and its SHA-256', async () => {
    const bytes = await pdf(2, 500)
    const read = await inspectLienCopy(bytes)
    expect(read).toMatchObject({ state: 'ok', file: { kind: 'pdf', pages: 2, bytes: bytes.length } })
    expect(read.state === 'ok' && read.file.sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('takes a picture as one page', async () => {
    expect(await inspectLienCopy(PNG)).toMatchObject({ state: 'ok', file: { kind: 'png', pages: 1 } })
  })

  it('holds a file that is not a PDF or a picture, and a PDF that does not open', async () => {
    expect(await inspectLienCopy(new TextEncoder().encode('<html>Sign in</html>'))).toMatchObject({ state: 'held', hold: { key: 'copy_not_printable' } })
    expect(await inspectLienCopy(new TextEncoder().encode('%PDF-1.7 and then nothing a reader can use'))).toMatchObject({ state: 'held', hold: { key: 'copy_broken' } })
  })
})

describe('one lien’s papers', () => {
  it('puts each envelope’s letter in front of every page of the stamped copy, the pages as they are', async () => {
    const scan = await pdf(2, 500)
    const job: LienServePdfJob = { key: 'f1', title: 'Copy of lien affidavit — Job 2291', envelopes: [{ letter: blob(await pdf(1, 100)) }, { letter: blob(await pdf(1, 200)) }], copy: { kind: 'pdf', bytes: scan } }
    const out = await buildLienServeJobPdf(job)
    // Owner's letter, the scan's two pages, the contractor's letter, the scan's two pages again.
    expect(await widths(out)).toEqual([101, 501, 502, 201, 501, 502])
    expect((await PDFDocument.load(out)).getTitle()).toBe('Copy of lien affidavit — Job 2291')
  })

  it('prints the stamped copy alone when there is no letter, and never anything in its place', async () => {
    const out = await buildLienServeJobPdf({ key: 'f1', title: 't', envelopes: [{ letter: null }], copy: { kind: 'pdf', bytes: await pdf(3, 500) } })
    expect(await widths(out)).toEqual([501, 502, 503])
  })

  it('puts a picture on a letter page of its own', async () => {
    const out = await buildLienServeJobPdf({ key: 'f1', title: 't', envelopes: [{ letter: blob(await pdf(1, 100)) }], copy: { kind: 'png', bytes: PNG } })
    expect(await widths(out)).toEqual([101, 612])
  })

  it('throws on a stamped copy it cannot open, so the run can name it', async () => {
    await expect(buildLienServeJobPdf({ key: 'f1', title: 't', envelopes: [{ letter: null }], copy: { kind: 'pdf', bytes: new TextEncoder().encode('%PDF-1.7 broken') } })).rejects.toThrow()
  })
})

describe('the run', () => {
  const job = async (key: string, base: number, pages = 2, envelopes = 2): Promise<LienServePdfJob> => ({ key, title: `Job ${key}`, envelopes: await Promise.all(Array.from({ length: envelopes }, async (_, i) => ({ letter: blob(await pdf(1, base - 100 + i * 10)) }))), copy: { kind: 'pdf', bytes: await pdf(pages, base) } })

  it('is the mail sheet, then every lien’s papers in order, and each lien’s own file is what the stack holds', async () => {
    const out = await buildLienServeStackPdf({ jobs: [await job('a', 300), await job('b', 500, 3, 1)], sheet: () => sheet(3), title: 'Copies of 2 filed lien affidavits' })
    expect(out.failed).toEqual([])
    expect(out.jobs.map((j) => [j.key, j.pages])).toEqual([['a', 6], ['b', 4]])
    const a = await widths(out.jobs[0]!.blob)
    const b = await widths(out.jobs[1]!.blob)
    expect(a).toEqual([201, 301, 302, 211, 301, 302])
    expect(b).toEqual([401, 501, 502, 503])
    // The sheet is one letter page in front. Behind it, page for page, are the files kept on the jobs.
    expect(await widths(out.stack!)).toEqual([612, ...a, ...b])
  })

  it('goes on past a lien whose papers cannot be put together, and tells the sheet which', async () => {
    const broken: LienServePdfJob = { key: 'bad', title: 'x', envelopes: [{ letter: null }], copy: { kind: 'pdf', bytes: new TextEncoder().encode('%PDF-1.7 broken') } }
    let told: ReadonlyArray<{ key: string; reason: string }> = []
    const out = await buildLienServeStackPdf({ jobs: [await job('a', 300), broken], sheet: (failed) => ((told = failed), sheet(2, 1)), title: 't' })
    expect(out.jobs.map((j) => j.key)).toEqual(['a'])
    expect(out.failed.map((f) => f.key)).toEqual(['bad'])
    expect(told.map((f) => f.key)).toEqual(['bad'])
    expect((await widths(out.stack!)).length).toBe(1 + 6)
  })

  it('makes no stack when no lien’s papers could be built', async () => {
    const broken: LienServePdfJob = { key: 'bad', title: 'x', envelopes: [{ letter: null }], copy: { kind: 'pdf', bytes: new TextEncoder().encode('%PDF-1.7 broken') } }
    const out = await buildLienServeStackPdf({ jobs: [broken], sheet: () => sheet(0), title: 't' })
    expect(out.stack).toBeNull()
    expect(out.failed).toHaveLength(1)
  })

  it('asks for the print window when it opens, the kept files never', async () => {
    const out = await buildLienServeStackPdf({ jobs: [await job('a', 300)], sheet: () => sheet(2), title: 't', autoPrint: true })
    const opens = async (b: Blob) => (await PDFDocument.load(await b.arrayBuffer())).catalog.has(PDFName.of('OpenAction'))
    expect(await opens(out.stack!)).toBe(true)
    expect(await opens(out.jobs[0]!.blob)).toBe(false)
    // Both ask for one side of the paper and each page at its own size: an envelope is three pages on a usual lien.
    for (const file of [out.stack!, out.jobs[0]!.blob]) {
      const prefs = (await PDFDocument.load(await file.arrayBuffer())).catalog.getOrCreateViewerPreferences()
      expect(prefs.getDuplex()).toBe('Simplex')
      expect(prefs.getPrintScaling()).toBe('None')
    }
  })
})

describe('the mail sheet, drawn', () => {
  it('draws on letter pages, runs to a second page for a long run, and takes a name the font cannot spell', async () => {
    const one = await PDFDocument.create()
    await drawLienMailSheet(one, sheet(4, 1))
    expect(one.getPages().map((p) => [p.getWidth(), p.getHeight()])).toEqual([[612, 792]])
    const many = await PDFDocument.create()
    // Forty envelopes, with a name carrying letters outside the standard fonts: the sheet still draws.
    const long = sheet(40, 3)
    long.rows[0]!.name = 'Zażółć Ğęślą Holdings 株式会社'
    await drawLienMailSheet(many, long)
    expect(many.getPageCount()).toBeGreaterThan(1)
  })
})
