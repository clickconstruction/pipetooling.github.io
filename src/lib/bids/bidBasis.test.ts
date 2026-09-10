import { describe, expect, it } from 'vitest'
import {
  bidBasisClause,
  bidBasisExportUrl,
  bidBasisInsertFromMessage,
  bidBasisRefForBid,
  bidBasisSearchTerm,
  bidBasisTakeoffMovedSince,
  countToolingViewToken,
  currentBidBasisExport,
  expectedBidBasisFilename,
  isCountToolingMessageOrigin,
  parseBidBasisExportMessage,
  parseBidBasisLoadedMessage,
  sanitizeBidBasisRef,
  shortSheetLabels,
  sortBidBasisExports,
} from './bidBasis'

const TOKEN = '8f3a1c2e-1111-4222-8333-444455556666'

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    type: 'counttooling:bid-basis-export',
    version: 1,
    ref: 'b409',
    filename: 'bid-basis_b409_livingston-steel-office-ti_2026-09-09_1432.pdf',
    saveMethod: 'intended',
    fileSizeBytes: 18400000,
    sheets: ['P-101', 'P-201'],
    sheetCount: 2,
    pageIndices: [2, 4],
    markTotals: { counters: 14, runs: 6 },
    notesCount: 3,
    includeReport: true,
    projectName: 'Livingston Steel Office TI',
    projectId: 'proj-1',
    viewToken: TOKEN,
    pdfHash: 'hash-1',
    ctUpdatedAt: '2026-09-09T18:58:00Z',
    exportedAt: '2026-09-09T19:32:00Z',
    canvasSnapshot: { version: 1, pages: [] },
    ...overrides,
  }
}

describe('origins', () => {
  it('accepts CountTooling, and localhost only when allowed', () => {
    expect(isCountToolingMessageOrigin('https://counttooling.com')).toBe(true)
    expect(isCountToolingMessageOrigin('https://www.counttooling.com')).toBe(true)
    expect(isCountToolingMessageOrigin('https://evil.com')).toBe(false)
    expect(isCountToolingMessageOrigin('http://localhost:3456')).toBe(false)
    expect(isCountToolingMessageOrigin('http://localhost:3456', { allowLocal: true })).toBe(true)
    expect(isCountToolingMessageOrigin('http://localhost.evil.com', { allowLocal: true })).toBe(false)
  })
})

describe('parseBidBasisExportMessage', () => {
  it('accepts the manifest and normalises it', () => {
    const m = parseBidBasisExportMessage(manifest())
    expect(m).not.toBeNull()
    expect(m!.ref).toBe('b409')
    expect(m!.sheets).toEqual(['P-101', 'P-201'])
    expect(m!.markTotals).toEqual({ counters: 14, runs: 6 })
    expect(m!.canvasSnapshot).toEqual({ version: 1, pages: [] })
    expect(m!.saveMethod).toBe('intended')
  })
  it('rejects other messages, other versions, and bad file names', () => {
    expect(parseBidBasisExportMessage(null)).toBeNull()
    expect(parseBidBasisExportMessage('hi')).toBeNull()
    expect(parseBidBasisExportMessage({ type: 'other' })).toBeNull()
    expect(parseBidBasisExportMessage(manifest({ version: 2 }))).toBeNull()
    expect(parseBidBasisExportMessage(manifest({ filename: '' }))).toBeNull()
    expect(parseBidBasisExportMessage(manifest({ filename: '../etc/passwd' }))).toBeNull()
    expect(parseBidBasisExportMessage(manifest({ filename: 'x'.repeat(250) }))).toBeNull()
  })
  it('tolerates missing optional fields', () => {
    const m = parseBidBasisExportMessage({ type: 'counttooling:bid-basis-export', version: 1, filename: 'a.pdf' })
    expect(m).not.toBeNull()
    expect(m!.sheets).toEqual([])
    expect(m!.sheetCount).toBe(0)
    expect(m!.markTotals).toEqual({ counters: 0, runs: 0 })
    expect(m!.fileSizeBytes).toBeNull()
    expect(m!.canvasSnapshot).toBeNull()
    expect(m!.exportedAt).toMatch(/^\d{4}-/)
  })
  it('drops non-integer page indexes and non-string sheets', () => {
    const m = parseBidBasisExportMessage(manifest({ pageIndices: [1, 'x', -1, 2.5, 3], sheets: ['a', 1, null] }))
    expect(m!.pageIndices).toEqual([1, 3])
    expect(m!.sheets).toEqual(['a'])
  })
})

describe('parseBidBasisLoadedMessage', () => {
  it('parses the loaded notice and nothing else', () => {
    const n = parseBidBasisLoadedMessage({ type: 'counttooling:bid-basis-loaded', version: 1, ref: 'B409', ctUpdatedAt: '2026-09-11T14:14:00Z', projectName: 'X' })
    expect(n).toEqual({ type: 'counttooling:bid-basis-loaded', version: 1, ref: 'b409', projectId: null, projectName: 'X', viewToken: null, pdfHash: null, ctUpdatedAt: '2026-09-11T14:14:00Z' })
    expect(parseBidBasisLoadedMessage(manifest())).toBeNull()
  })
})

describe('refs, links and file names', () => {
  it('bidBasisRefForBid / sanitizeBidBasisRef', () => {
    expect(bidBasisRefForBid({ bid_number: '409' })).toBe('b409')
    expect(bidBasisRefForBid({ bid_number: 409 })).toBe('b409')
    expect(bidBasisRefForBid({ bid_number: 'BP 12' })).toBe('bp-12')
    expect(bidBasisRefForBid({ bid_number: null })).toBe('bid')
    expect(bidBasisRefForBid({ bid_number: '' })).toBe('bid')
    expect(sanitizeBidBasisRef(' BP 12 ')).toBe('bp-12')
    expect(sanitizeBidBasisRef('')).toBeNull()
  })
  it('countToolingViewToken only for CountTooling hosts with ?t=', () => {
    expect(countToolingViewToken(`https://counttooling.com/app/?t=${TOKEN}`)).toBe(TOKEN)
    expect(countToolingViewToken(`https://www.counttooling.com/?t=${TOKEN}`)).toBe(TOKEN)
    expect(countToolingViewToken('https://drive.google.com/file/d/abc')).toBeNull()
    expect(countToolingViewToken('https://counttooling.com/app/')).toBeNull()
    expect(countToolingViewToken('not a url')).toBeNull()
    expect(countToolingViewToken(null)).toBeNull()
  })
  it('bidBasisExportUrl appends the flag and ref, keeps the token', () => {
    const u = bidBasisExportUrl(`https://counttooling.com/app/?t=${TOKEN}`, 'b409')
    expect(u).toBe(`https://counttooling.com/app/?t=${TOKEN}&export=bid-basis&ref=b409`)
    expect(bidBasisExportUrl(`https://counttooling.com/app/?t=${TOKEN}`, 'b409', 'http://localhost:4571')).toBe(`http://localhost:4571/app/?t=${TOKEN}&export=bid-basis&ref=b409`)
    expect(bidBasisExportUrl(`https://counttooling.com/app/?t=${TOKEN}`, 'b409', 'not a url')).toBeNull()
    expect(bidBasisExportUrl('https://drive.google.com/x', 'b409')).toBeNull()
    expect(bidBasisExportUrl(null, 'b409')).toBeNull()
  })
  it('expectedBidBasisFilename mirrors CountTooling', () => {
    const at = new Date(2026, 8, 9, 14, 32)
    expect(expectedBidBasisFilename('b409', 'Livingston Steel Office TI', at)).toBe('bid-basis_b409_livingston-steel-office-ti_2026-09-09_1432.pdf')
    expect(expectedBidBasisFilename('', '', at)).toBe('bid-basis_bid_plans_2026-09-09_1432.pdf')
  })
  it('bidBasisSearchTerm pulls the bid number out of the file name', () => {
    expect(bidBasisSearchTerm('bid-basis_b409_x_2026-09-09_1432.pdf')).toBe('b409')
    expect(bidBasisSearchTerm('something-else.pdf')).toBe('bid-basis')
  })
  it('shortSheetLabels strips the default project prefix', () => {
    expect(shortSheetLabels(['Livingston — p1', 'P-201', 'Livingston — '], 'Livingston')).toEqual(['p1', 'P-201', 'Livingston —'])
    expect(shortSheetLabels(['A — p1'], null)).toEqual(['A — p1'])
  })
})

describe('bidBasisClause', () => {
  it('names the date and the sheets', () => {
    expect(bidBasisClause({ planDateFormatted: '8/14/26', sheets: ['P-101', 'P-201'] })).toBe(
      'This proposal is based on our marked-up copy of the plans dated 8/14/26, which accompanies this letter (2 sheets: P-101, P-201). Where our marks and the issued drawings differ, our marks govern.'
    )
  })
  it('works without a date and without sheets (by-hand stamp)', () => {
    expect(bidBasisClause({ planDateFormatted: null, sheets: [] })).toBe(
      'This proposal is based on our marked-up copy of the plans, which accompanies this letter. Where our marks and the issued drawings differ, our marks govern.'
    )
    expect(bidBasisClause({ planDateFormatted: null, sheets: ['P-101'] })).toContain('(1 sheet: P-101)')
  })
})

describe('rows', () => {
  const row = (id: string, exported_at: string, superseded_at: string | null = null, ct_updated_at: string | null = null) => ({
    id, exported_at, filename: `${id}.pdf`, save_method: 'reported', sheet_labels: [], sheet_count: 0, ct_updated_at, superseded_at,
  })
  it('sorts newest first and picks the current export', () => {
    const rows = [row('a', '2026-09-09T19:32:00Z', '2026-09-11T14:40:00Z'), row('b', '2026-09-11T14:40:00Z')]
    expect(sortBidBasisExports(rows).map((r) => r.id)).toEqual(['b', 'a'])
    expect(currentBidBasisExport(rows)?.id).toBe('b')
    expect(currentBidBasisExport([])).toBeNull()
    // Every row superseded (defensive): newest wins.
    expect(currentBidBasisExport([row('a', '2026-09-09T19:32:00Z', '2026-09-10T00:00:00Z')])?.id).toBe('a')
  })
  it('bidBasisTakeoffMovedSince compares last-saved times with a 1 s tolerance', () => {
    const r = row('a', '2026-09-09T19:32:00Z', null, '2026-09-09T18:58:00Z')
    expect(bidBasisTakeoffMovedSince(r, '2026-09-11T14:14:00Z')).toBe(true)
    expect(bidBasisTakeoffMovedSince(r, '2026-09-09T18:58:00.500Z')).toBe(false)
    expect(bidBasisTakeoffMovedSince(r, '2026-09-09T18:00:00Z')).toBe(false)
    expect(bidBasisTakeoffMovedSince(r, null)).toBe(false)
    expect(bidBasisTakeoffMovedSince(null, '2026-09-11T14:14:00Z')).toBe(false)
    expect(bidBasisTakeoffMovedSince(row('a', '2026-09-09T19:32:00Z'), '2026-09-11T14:14:00Z')).toBe(false)
  })
  it('bidBasisInsertFromMessage maps the manifest onto the row', () => {
    const m = parseBidBasisExportMessage(manifest())!
    const ins = bidBasisInsertFromMessage(m)
    expect(ins.filename).toBe(m.filename)
    expect(ins.save_method).toBe('reported')
    expect(bidBasisInsertFromMessage(parseBidBasisExportMessage(manifest({ saveMethod: 'confirmed' }))!).save_method).toBe('confirmed')
    expect(ins.sheet_labels).toEqual(['P-101', 'P-201'])
    expect(ins.ct_view_token).toBe(TOKEN)
    expect(ins.canvas_snapshot).toEqual({ version: 1, pages: [] })
    expect(ins.exported_at).toBe('2026-09-09T19:32:00Z')
  })
})
