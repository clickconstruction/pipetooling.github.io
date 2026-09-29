import { describe, expect, it } from 'vitest'
import {
  clearDecision,
  decide,
  decisionsToWrites,
  doneButtonText,
  findPagesForRow,
  initialDecisions,
  nextUndecided,
  normalizeText,
  pagesByItem,
  readPages,
  readsFromGuesses,
  rowColor,
  rowModels,
  runStart,
  suggestFor,
  walkProgressText,
  walkRowsFrom,
  walkSummary,
  type WalkDecisions,
} from './assignPagesWalk'
import type { SubmittalItemRow } from './submittalRevision'

const item = (p: Partial<SubmittalItemRow> & { id: string; tag: string }): SubmittalItemRow =>
  ({ submitted_model: null, submitted_label: null, specified_model: null, sheet_file: null, sheet_pages: [], ...p }) as SubmittalItemRow

const items = [
  item({ id: 'dwh', tag: 'DWH-1', submitted_label: 'DWH1 & ET assembly SPACEX', submitted_model: 'BTH-199' }),
  item({ id: 'fd', tag: 'FD', submitted_model: 'Z415', submitted_label: 'Zurn Z415 floor drain' }),
  item({ id: 'wha200', tag: 'WHA-200', submitted_model: 'Z1700-200-OV' }),
  item({ id: 'wha500', tag: 'WHA-500', submitted_model: 'Z1700-500-OV', submitted_label: 'ZURN Z1700-500-OV HAMMER ARRESTOR' }),
  item({ id: 'wc1', tag: 'WC-1', submitted_model: 'CT708', specified_model: 'CT708UVG' }),
  item({ id: 'util', tag: 'UTILITY SINK' }),
]
const rows = walkRowsFrom(items)

// A vendor PDF: cover, index naming four rows, then runs of sheets, one scan with no text.
const texts = [
  'SPACEX BA-2 CORE & SHELL plumbing submittal rev 3',
  'INDEX  DWH-1 BTH-199 p3 · FD Z415 p7 · WHA-200 Z1700-200-OV p9 · WHA-500 Z1700-500-OV p10 · WC-1 CT708 p12',
  'A.O. SMITH BTH-199 commercial gas water heater specification sheet dimensions',
  'BTH-199 continued: venting table and clearances for the heater',
  '',
  'ZURN Z415 FLOOR DRAIN with type B strainer, cast iron body, submittal sheet',
  'ZURN Z1700-200-OV WATER HAMMER ARRESTOR PDI size A sizing table and dimensions',
  'ZURN Z1700-500-OV WATER HAMMER ARRESTOR PDI size C sizing table and dimensions',
  'TOTO CT708UVG elongated flushometer bowl, ADA height, submittal data sheet',
  'Terms and conditions of sale. Warranty. Freight. Returns are not accepted without authorization.',
]

describe('reading the pages', () => {
  it('normalizes text so a model reads the same on the page and on the row', () => {
    expect(normalizeText(' Zurn  Z1700-500-OV, hammer/arrestor ')).toBe(' ZURN Z1700 500 OV HAMMER ARRESTOR ')
    expect(rowModels(items[3]!)).toEqual(['Z1700 500 OV', 'Z1700'])
    expect(rowModels(items[4]!)).toEqual(['CT708UVG', 'CT708'])
    expect(rowModels(items[0]!)).toEqual(['BTH 199', 'DWH1'])
    expect(rowModels(items[5]!)).toEqual([])
  })

  it('names the row whose longest model is on the page, calls a page naming four rows the index, and reads nothing from a blank', () => {
    const reads = readPages(texts, rows)
    expect(reads[1]).toBeUndefined()
    expect(reads[2]).toEqual({ itemId: null, why: 'index' })
    expect(reads[3]).toEqual({ itemId: 'dwh', why: 'model' })
    expect(reads[4]).toEqual({ itemId: 'dwh', why: 'model' })
    expect(reads[5]).toBeUndefined()
    expect(reads[6]).toEqual({ itemId: 'fd', why: 'model' })
    expect(reads[7]).toEqual({ itemId: 'wha200', why: 'model' })
    // Z1700 alone is on both WHA rows; the longer "Z1700 500 OV" wins.
    expect(reads[8]).toEqual({ itemId: 'wha500', why: 'model' })
    expect(reads[9]).toEqual({ itemId: 'wc1', why: 'model' })
    expect(reads[10]).toBeUndefined()
  })

  it('falls back to a tag with a number in it, never a bare word like FD', () => {
    const reads = readPages(['fixture WC-1 wall carrier and seat, no model given here', 'the FD goes in the kitchen'], rows)
    expect(reads[1]).toEqual({ itemId: 'wc1', why: 'tag' })
    expect(reads[2]).toBeUndefined()
  })

  it('a family model reads its SKU on the sheet (CT708 → CT708UVG) once it is five characters; a short model must match whole', () => {
    const family = walkRowsFrom([item({ id: 'wc', tag: 'WC-1', submitted_model: 'CT708' }), item({ id: 'z', tag: 'Z-1', submitted_model: 'Z415' })])
    const reads = readPages(['TOTO CT708UVG elongated bowl submittal sheet with the rough-in', 'ZURN Z4150 something else entirely on this page here'], family)
    expect(reads[1]).toEqual({ itemId: 'wc', why: 'model' })
    expect(reads[2]).toBeUndefined()
  })

  it('the robot’s sure guesses read as tag matches; unsure ones are left to the reader', () => {
    const reads = readsFromGuesses(new Map([[3, { tag: 'wha-500', sure: true }], [4, { tag: 'WC-1', sure: false }], [5, { tag: 'NOPE', sure: true }]]), rows)
    expect(reads).toEqual({ 3: { itemId: 'wha500', why: 'tag' } })
    expect(readsFromGuesses(undefined, rows)).toEqual({})
  })

  it('finds the pages that name a row', () => {
    expect(findPagesForRow(texts, rows[4]!)).toEqual([2, 9])
    expect(findPagesForRow(texts, rows[5]!)).toEqual([])
  })
})

describe('the walk', () => {
  const reads = readPages(texts, rows)

  it('suggests what is kept, then what was read, then the row before, then the next row in order', () => {
    let d: WalkDecisions = {}
    expect(suggestFor(1, d, reads, rows)).toEqual({ value: 'dwh', why: 'next' })
    d = decide(d, 1, 'skip')
    expect(suggestFor(2, d, reads, rows)).toEqual({ value: 'skip', why: 'read' })
    d = decide(d, 2, 'skip')
    expect(suggestFor(3, d, reads, rows)).toEqual({ value: 'dwh', why: 'read' })
    d = decide(d, 3, 'dwh')
    d = decide(d, 4, 'dwh')
    // page 5 is blank: continue the run from page 4
    expect(suggestFor(5, d, reads, rows)).toEqual({ value: 'dwh', why: 'continue' })
    d = decide(d, 5, 'dwh')
    expect(suggestFor(5, d, reads, rows)).toEqual({ value: 'dwh', why: 'kept' })
    // after the last placed row (dwh), the next row with no page is fd
    expect(suggestFor(10, decide({}, 3, 'dwh'), {}, rows)).toEqual({ value: 'fd', why: 'next' })
    // every row placed: nothing to suggest
    const all = Object.fromEntries(rows.map((r, i) => [i + 1, r.id]))
    expect(suggestFor(9, all, {}, rows)).toEqual({ value: null, why: 'none' })
  })

  it('a pick and its undo, the run it belongs to, the next undecided page', () => {
    let d: WalkDecisions = decide(decide(decide({}, 3, 'dwh'), 4, 'dwh'), 6, 'fd')
    expect(runStart(d, 4)).toBe(3)
    expect(runStart(d, 6)).toBe(6)
    expect(runStart(d, 9)).toBe(9)
    expect(nextUndecided(d, 10, 4)).toBe(5)
    expect(nextUndecided(d, 10, 10)).toBe(1)
    d = clearDecision(d, 4)
    expect(d[4]).toBeUndefined()
    expect(pagesByItem(decide(d, 8, 'dwh')).get('dwh')).toEqual([3, 8])
    expect(nextUndecided({ 1: 'skip', 2: 'skip' }, 2, 2)).toBeNull()
  })

  it('counts the walk and unlocks Done only when every page is seen and decided', () => {
    const d: WalkDecisions = { 1: 'skip', 2: 'skip', 3: 'dwh', 4: 'dwh', 6: 'fd' }
    const s = walkSummary(d, new Set([1, 2, 3, 4]), 10, rows, (id) => id !== 'util')
    expect(s).toMatchObject({ placed: 3, skipped: 2, undecided: 5, seen: 4, pageCount: 10, rowsWithout: ['wha200', 'wha500', 'wc1'], done: false })
    expect(walkProgressText(s)).toBe('4 of 10 seen · 3 on rows · 2 not cut sheets · 3 rows with nothing')
    expect(doneButtonText(s)).toBe('Done — 4 of 10 seen')
    const full: Record<number, string> = {}
    for (let p = 1; p <= 10; p++) full[p] = p <= 2 || p === 10 ? 'skip' : 'dwh'
    const done = walkSummary(full, new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 10, rows)
    expect(done.done).toBe(true)
    expect(doneButtonText(done)).toBe('Done — put 7 pages on rows')
    // seen but one still undecided: not done
    expect(walkSummary(clearDecision(full, 7), new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 10, rows).done).toBe(false)
  })

  it('starts from the rows’ pages already in this file, and writes only what changed', () => {
    const before = [
      item({ id: 'dwh', tag: 'DWH-1', sheet_file: 0, sheet_pages: [3, 4] }),
      item({ id: 'fd', tag: 'FD', sheet_file: 1, sheet_pages: [2] }),
      item({ id: 'wc1', tag: 'WC-1', sheet_file: 0, sheet_pages: [9] }),
      item({ id: 'util', tag: 'UTILITY SINK' }),
    ]
    expect(initialDecisions(before, 0)).toEqual({ 3: 'dwh', 4: 'dwh', 9: 'wc1' })
    const d: WalkDecisions = { 1: 'skip', 3: 'dwh', 4: 'dwh', 5: 'dwh', 6: 'fd' }
    expect(decisionsToWrites(before, 0, d)).toEqual([
      { itemId: 'dwh', fileIndex: 0, pages: [3, 4, 5] },
      { itemId: 'fd', fileIndex: 0, pages: [6] },
      { itemId: 'wc1', fileIndex: null, pages: [] },
    ])
    expect(decisionsToWrites(before, 0, { 3: 'dwh', 4: 'dwh', 9: 'wc1' })).toEqual([])
  })

  it('gives every row a color by its place, wrapping the palette', () => {
    expect(rowColor(0)).toBe(rowColor(16))
    expect(rowColor(1)).not.toBe(rowColor(2))
  })
})
