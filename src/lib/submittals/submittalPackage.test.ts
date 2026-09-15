import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'

import { buildCoverModel, buildSubmittalPackage, packageFileName, planPackage, type PackageRowInput } from './submittalPackage'

const row = (o: Partial<PackageRowInput>): PackageRowInput => ({ tag: 'X-1', status: 'as_specified', specified: 'TOTO CT708UVG', submitted: 'TOTO CT708UVG#01', house: 'NWS', reason: '', leadTime: 'in stock', sheetFile: null, sheetPages: [], ...o })

const rows: PackageRowInput[] = [
  row({ tag: 'DWH-1', status: 'alternate', specified: 'Rheem RH375', submitted: 'BW RE2HP50', reason: 'Long lead time · spec 3–4 wk out', leadTime: '1 wk', sheetFile: 0, sheetPages: [5] }),
  row({ tag: 'PRV-1', status: 'missing', specified: 'Watts LF223', submitted: '', house: null, leadTime: '' }),
  row({ tag: 'WC-1', status: 'as_specified', sheetFile: 0, sheetPages: [1, 2] }),
  row({ tag: 'RPZ-1', status: 'alternate', specified: 'Zurn 375', submitted: 'Watts 957', reason: '', leadTime: '' }),
  row({ tag: '', status: 'accessory', specified: '', submitted: 'Josam 12704 carrier', sheetFile: 1, sheetPages: [3] }),
]

describe('planPackage', () => {
  it('lays the sheets out behind the cover in row order and names the rows still owing one', () => {
    const plan = planPackage(rows, 1)
    expect(plan.rows.map((r) => [r.tag, r.startPage])).toEqual([
      ['DWH-1', 2],
      ['PRV-1', null],
      ['WC-1', 3],
      ['RPZ-1', null],
      ['', 5],
    ])
    expect(plan).toMatchObject({ coverPages: 1, sheetPages: 4, totalPages: 5, rowsWithSheet: 3, rowsWithoutSheet: ['RPZ-1'] })
    expect(planPackage(rows, 2).rows[0]?.startPage).toBe(3)
  })
})

describe('buildCoverModel', () => {
  it('writes the title, the meta line, the counts, one table row per row with its package page, and the notes', () => {
    const model = buildCoverModel(
      { companyName: 'Click Plumbing', companyTagline: 'Plumbing', officePhone: '(512) 555-0100', bidLabel: 'B398 · ZZ Test', projectAddress: '1 Test Ln, Austin', gcName: 'Structura', revNumber: 3, dateLabel: 'September 15, 2026', note: 'Rev 3 replaces Rev 2.' },
      planPackage(rows, 1),
    )
    expect(model.title).toBe('SUBMITTAL · Rev 3')
    expect(model.meta).toEqual(['B398 · ZZ Test', '1 Test Ln, Austin', 'To: Structura', 'September 15, 2026'])
    expect(model.countsLine).toBe('5 rows · 1 as specified · 2 alternates · 1 missing · 1 accessory · 3 cut sheets attached')
    expect(model.rows).toEqual([
      ['DWH-1', 'Rheem RH375', 'BW RE2HP50 · NWS', 'Alternate', 'Long lead time · spec 3–4 wk out', '1 wk', 'p. 2'],
      ['PRV-1', 'Watts LF223', '—', 'Missing', '—', '—', '—'],
      ['WC-1', 'TOTO CT708UVG', 'TOTO CT708UVG#01 · NWS', 'As specified', '—', 'in stock', 'p. 3–4'],
      ['RPZ-1', 'Zurn 375', 'Watts 957 · NWS', 'Alternate', '—', '—', 'to follow'],
      ['—', 'not on the schedule', 'Josam 12704 carrier · NWS', 'Accessory', '—', 'in stock', 'p. 5'],
    ])
    expect(model.notes).toEqual(['Cut sheets to follow for: RPZ-1.', 'Accessories are required by the fixtures and left to the contractor by the schedule; they are listed for the record.', 'Rev 3 replaces Rev 2.'])
  })
})

async function pdfWithPages(n: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < n; i++) doc.addPage([612, 792])
  return doc.save()
}

describe('buildSubmittalPackage', () => {
  it('copies the cover, then each sheet\'s pages in order, and records where they landed', async () => {
    const cover = new Blob([(await pdfWithPages(1)) as BlobPart], { type: 'application/pdf' })
    const files = [await pdfWithPages(6), await pdfWithPages(3)]
    const result = await buildSubmittalPackage(cover, files, [
      { tag: 'DWH-1', status: 'alternate', title: 'BW RE2HP50', fileIndex: 0, pages: [5] },
      { tag: 'WC-1', status: 'as_specified', title: 'TOTO CT708UVG#01', fileIndex: 0, pages: [2, 1] },
      { tag: '', status: 'accessory', title: 'Josam 12704 carrier', fileIndex: 1, pages: [3] },
    ])
    expect(result.coverPages).toBe(1)
    expect(result.sheetPages).toBe(4)
    expect(result.totalPages).toBe(5)
    expect(result.manifest).toEqual([
      { tag: 'DWH-1', status: 'alternate', pages: [2] },
      { tag: 'WC-1', status: 'as_specified', pages: [3, 4] },
      { tag: '', status: 'accessory', pages: [5] },
    ])
    expect(result.skipped).toEqual([])
    const merged = await PDFDocument.load(await result.blob.arrayBuffer())
    expect(merged.getPageCount()).toBe(5)
  })

  it('skips a sheet whose file is missing or whose pages are out of range, and names it', async () => {
    const cover = new Blob([(await pdfWithPages(2)) as BlobPart], { type: 'application/pdf' })
    const result = await buildSubmittalPackage(cover, [await pdfWithPages(2)], [
      { tag: 'A-1', status: 'as_specified', title: 'a', fileIndex: 0, pages: [9] },
      { tag: 'B-1', status: 'equal', title: 'b', fileIndex: 3, pages: [1] },
      { tag: 'C-1', status: 'superseded', title: 'c', fileIndex: 0, pages: [2] },
    ])
    expect(result.skipped).toEqual(['A-1', 'B-1'])
    expect(result.manifest).toEqual([{ tag: 'C-1', status: 'superseded', pages: [3] }])
    expect(result.totalPages).toBe(3)
  })
})

describe('packageFileName', () => {
  it('is safe for a download', () => {
    expect(packageFileName(3, 'B398 · ZZ Test: "phase 2"')).toBe('Submittal Rev 3 - B398 · ZZ Test phase 2.pdf')
  })
})
