import { describe, expect, it, vi } from 'vitest'
import { PDFDocument, PDFName, PDFPage } from 'pdf-lib'
import { qrMatrix } from '../../../supabase/functions/_shared/qrMatrix'
import { buildLienServeJobPdf, buildLienServeStackPdf, drawLienEnvelopeDivider, drawLienMailSheet, inspectLienCopy, type LienServePdfJob } from './lienServePdf'
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
  steps: ['Each envelope takes its letter and the clerk’s stamped copy behind it. They come off the printer in the order below.', 'Mail each envelope by certified mail. Write its number in the boxes under its line.', 'In the app, open the Lien desk.'],
  columns: ['#', 'Job', 'Copy to', 'Pages', 'Mail by', 'Name and address on the envelope'],
  numberLabel: 'Certified mail number',
  from: ['Sample Plumbing LLC', 'PO Box 100', 'Kyle, TX 78640'],
  link: 'https://app.example/lien-desk?copies=1',
  rows: Array.from({ length: rows }, (_, i) => ({ n: i + 1, job: `22${i} · Sample Job with a long name that wraps`, to: i % 2 ? 'Original contractor' : 'Owner', name: 'Hollow Creek Holdings LLC — Peña & Søn', address: '88 Sample Ridge Rd, Suite 400, Austin, TX 78700', addressLines: ['88 Sample Ridge Rd, Suite 400', 'Austin, TX 78700'], link: `https://app.example/lien-desk?copies=99999999-2222-4222-8222-22222222222${i % 10}&to=${i % 2 ? 'contractor' : 'owner'}`, pages: '3', mailBy: i === 0 ? 'Nov 11 · late' : 'Nov 23' })),
  heldHead: 'Not in this print',
  held: Array.from({ length: held }, (_, i) => ({ job: `23${i} · Held Job`, words: 'Not printed: no stamped copy saved.', act: 'Add the clerk’s stamped scan on the job’s Lien window.' })),
  foot: ['Mail sheet printed November 19, 2026', 'The first envelope’s divider is the next page'],
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
    // Each lien's own file is its papers alone. The dividers are counted beside it and are in the stack alone.
    expect(out.jobs.map((j) => [j.key, j.pages, j.dividers])).toEqual([['a', 6, 2], ['b', 4, 1]])
    const a = await widths(out.jobs[0]!.blob)
    const b = await widths(out.jobs[1]!.blob)
    expect(a).toEqual([201, 301, 302, 211, 301, 302])
    expect(b).toEqual([401, 501, 502, 503])
    // The sheet is one letter page in front. Behind it each envelope has a divider, a letter page, and then, page
    // for page, its part of the file kept on the job.
    expect(await widths(out.stack!)).toEqual([612, 612, ...a.slice(0, 3), 612, ...a.slice(3), 612, ...b])
  })

  it('draws each divider from the sheet’s own line for that envelope, in the stack’s order', async () => {
    const words = vi.spyOn(PDFPage.prototype, 'drawText')
    try {
      const s = sheet(3)
      s.rows.forEach((r, i) => { r.name = `Sample Reader ${i + 1}`; r.addressLines = [`${i + 1} Example St`, 'Buda, TX 78610'] })
      const out = await buildLienServeStackPdf({ jobs: [await job('a', 300), await job('b', 500, 3, 1)], sheet: () => s, title: 't' })
      expect(out.failed).toEqual([])
      const drawn = words.mock.calls.map(([t]) => t)
      for (const n of [1, 2, 3]) {
        expect(drawn).toContain(`#${n} on the mail sheet`)
        expect(drawn).toContain(`Envelope ${n} of 3 · ${n % 2 ? 'Owner' : 'Original contractor'}`)
        expect(drawn.filter((t) => t === `${n} Example St`)).toHaveLength(2) // once on the sheet, once on the divider's face
      }
      expect(drawn.filter((t) => t === 'Do not mail this page.')).toHaveLength(3)
      // On a divider the red box's two lines and the pull line are centred on the page.
      const at = words.mock.calls.map(([t, o]) => ({ t, x: Number(o?.x), y: Number(o?.y), size: Number(o?.size), font: o?.font }))
      const centre = (d: { t: string; x: number; size: number; font: unknown }) => d.x + (d.font as { widthOfTextAtSize(t: string, s: number): number }).widthOfTextAtSize(d.t, d.size) / 2
      for (const t of ['Do not mail this page.', 'Mail only the 3 pages behind it. They stop at the next divider, envelope 2.', 'Pull this page out before you seal the envelope. It stays on the desk with the mail sheet.']) {
        expect(centre(at.find((d) => d.t === t)!)).toBeCloseTo(306, 1)
      }
      // The three things to tick are one under the other, in the order they are done.
      const ticks = ['Envelope written as drawn', '3 pages in the envelope', 'Number written at #1 on the mail sheet'].map((t) => at.find((d) => d.t === t)!)
      expect(new Set(ticks.map((d) => d.x)).size).toBe(1)
      expect(ticks[0]!.y).toBeGreaterThan(ticks[1]!.y)
      expect(ticks[1]!.y).toBeGreaterThan(ticks[2]!.y)
      expect(drawn.filter((t) => t === 'DIVIDER · DO NOT MAIL THIS PAGE')).toHaveLength(3)
      expect(drawn).toContain('Mail only the 3 pages behind it. They stop at the next divider, envelope 2.')
      expect(drawn).toContain('Mail only the 3 pages behind it. They are the last pages of this print.')
      // The return address is on each face. The face carries no certified mail line: the label is the post office's,
      // and the number's home is the mail sheet's boxes.
      expect(drawn.filter((t) => t === 'Sample Plumbing LLC')).toHaveLength(3)
      expect(drawn.some((t) => /return receipt|article no/i.test(t))).toBe(false)
    } finally {
      words.mockRestore()
    }
  })

  it('draws each divider’s own code and the mail sheet’s, module for module, and none for an address that cannot be one', async () => {
    const rects = vi.spyOn(PDFPage.prototype, 'drawRectangle')
    const words = vi.spyOn(PDFPage.prototype, 'drawText')
    /** The dark modules the filled runs of one code cover, read back off the drawing: `side` points square from (`x`, `top`). */
    const read = (side: number, n: number, pick: (o: { x?: number; y?: number; width?: number; height?: number }) => boolean) => {
      const runs = rects.mock.calls.map(([o]) => o!).filter((o) => o.borderColor === undefined && pick(o))
      const cell = side / n
      const x0 = Math.min(...runs.map((o) => Number(o.x)))
      const top = Math.max(...runs.map((o) => Number(o.y) + cell))
      const grid = Array.from({ length: n }, () => new Array<boolean>(n).fill(false))
      for (const o of runs) {
        const r = Math.round((top - Number(o.y)) / cell) - 1
        const c = Math.round((Number(o.x) - x0) / cell)
        for (let i = 0; i < Math.round(Number(o.width) / cell); i += 1) grid[r]![c + i] = true
      }
      return grid
    }
    try {
      const s = sheet(2)
      const sheetCode = qrMatrix(s.link)!
      const doc = await PDFDocument.create()
      await drawLienMailSheet(doc, s)
      // The sheet's code is 60 points square in the steps box: its runs are a module high.
      expect(read(60, sheetCode.length, (o) => Math.abs(Number(o.height) - 60 / sheetCode.length - 0.05) < 1e-6)).toEqual(sheetCode)
      expect(words.mock.calls.map(([t]) => t)).toContain('SCAN TO ENTER THE NUMBERS')
      rects.mockClear()
      words.mockClear()
      const row = s.rows[1]!
      const code = qrMatrix(row.link)!
      await drawLienEnvelopeDivider(doc, row, s)
      expect(read(84, code.length, (o) => Math.abs(Number(o.height) - 84 / code.length - 0.05) < 1e-6)).toEqual(code)
      expect(words.mock.calls.map(([t]) => t)).toEqual(expect.arrayContaining(['Scan once this envelope is mailed.', 'It opens this envelope’s number box in the app.']))
      // No address, no code and no words about one.
      rects.mockClear()
      words.mockClear()
      await drawLienEnvelopeDivider(doc, { ...row, link: '' }, s)
      expect(rects.mock.calls.map(([o]) => o!).filter((o) => o.borderColor === undefined && Number(o.height) < 5)).toEqual([])
      expect(words.mock.calls.map(([t]) => t)).not.toContain('Scan once this envelope is mailed.')
    } finally {
      rects.mockRestore()
      words.mockRestore()
    }
  })

  it('draws no divider when the sheet does not list exactly the envelopes behind it', async () => {
    // Two liens of two envelopes are four envelopes; a sheet of three lines cannot say whose each divider is.
    const out = await buildLienServeStackPdf({ jobs: [await job('a', 300), await job('b', 500)], sheet: () => sheet(3), title: 't' })
    expect(out.jobs.map((j) => j.dividers)).toEqual([0, 0])
    expect(await widths(out.stack!)).toEqual([612, ...(await widths(out.jobs[0]!.blob)), ...(await widths(out.jobs[1]!.blob))])
  })

  it('goes on past a lien whose papers cannot be put together, and tells the sheet which', async () => {
    const broken: LienServePdfJob = { key: 'bad', title: 'x', envelopes: [{ letter: null }], copy: { kind: 'pdf', bytes: new TextEncoder().encode('%PDF-1.7 broken') } }
    let told: ReadonlyArray<{ key: string; reason: string }> = []
    const out = await buildLienServeStackPdf({ jobs: [await job('a', 300), broken], sheet: (failed) => ((told = failed), sheet(2, 1)), title: 't' })
    expect(out.jobs.map((j) => j.key)).toEqual(['a'])
    expect(out.failed.map((f) => f.key)).toEqual(['bad'])
    expect(told.map((f) => f.key)).toEqual(['bad'])
    // The sheet, then the one lien that built: two envelopes, each a divider and three pages.
    expect((await widths(out.stack!)).length).toBe(1 + 2 + 6)
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

  it('draws five boxes for the certified mail number under each envelope’s line, and keeps a long name on one line', async () => {
    const rects = vi.spyOn(PDFPage.prototype, 'drawRectangle')
    const words = vi.spyOn(PDFPage.prototype, 'drawText')
    try {
      const doc = await PDFDocument.create()
      const s = sheet(3)
      s.rows[1]!.name = 'SAMPLE PERSON ALEXANDER & SAMPLE PERSON JOSEPHINE R'
      s.rows[2]!.addressLines = []
      await drawLienMailSheet(doc, s)
      // A number box is 54 points wide and 15 high: five under each of the three envelopes.
      const boxes = rects.mock.calls.map(([o]) => o!).filter((o) => o.width === 54 && o.height === 15)
      expect(boxes).toHaveLength(15)
      // The five of one envelope sit on one line, left to right, and end at the page's right margin.
      const first = boxes.slice(0, 5)
      expect(new Set(first.map((o) => o.y)).size).toBe(1)
      expect(first.map((o) => o.x)).toEqual([...first.map((o) => o.x)].sort((x, y) => Number(x) - Number(y)))
      expect(Number(first[4]!.x) + 54).toBe(612 - 36)
      const drawn = words.mock.calls.map(([t, o]) => ({ t, size: o?.size, x: o?.x, y: o?.y }))
      expect(drawn.filter((d) => d.t === 'CERTIFIED MAIL NUMBER')).toHaveLength(3)
      // The long name is drawn once, whole, a little smaller, and not cut into lines.
      const long = drawn.filter((d) => d.t === 'SAMPLE PERSON ALEXANDER & SAMPLE PERSON JOSEPHINE R')
      expect(long).toHaveLength(1)
      expect(long[0]!.size).toBeLessThan(8.5)
      expect(long[0]!.size).toBeGreaterThanOrEqual(7)
      // The street and the city line are two lines of their own, the city under the street.
      const street = drawn.find((d) => d.t === '88 Sample Ridge Rd, Suite 400')!
      const city = drawn.find((d) => d.t === 'Austin, TX 78700')!
      expect(city.x).toBe(street.x)
      expect(Number(city.y)).toBeLessThan(Number(street.y))
      // A row with no split address falls back to the address as typed.
      expect(drawn.some((d) => d.t === '88 Sample Ridge Rd, Suite 400, Austin, TX 78700')).toBe(true)
      // The head names the columns in the new order, the name and address last.
      const head = ['#', 'JOB', 'COPY TO', 'PAGES', 'MAIL BY', 'NAME AND ADDRESS ON THE ENVELOPE'].map((h) => Number(drawn.find((d) => d.t === h)!.x))
      expect(head).toEqual([...head].sort((x, y) => x - y))
    } finally {
      rects.mockRestore()
      words.mockRestore()
    }
  })
})
