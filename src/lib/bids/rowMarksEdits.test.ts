/**
 * The edits to a row's marks and to the bid's markup, as `BidsPricingTab` made them inline before
 * the move (decomposition queue row 1). Every expected number here is what that inline code wrote.
 * The last block runs a typed markup through `rowPriceSplit` and `rowMarksToDbPatch`, so the dollars
 * on the row and the column on the database are pinned for one whole row.
 */
import { describe, expect, it } from 'vitest'
import {
  markupUndoBack,
  markupUndoFor,
  putBackFailedRowMarks,
  readRowMarkupText,
  readSplitOpen,
  rowMarkupCommit,
  rowMarkupPreviewOf,
  savedSovFactorOf,
  seedRowMarks,
  sovFactorFromMarkup,
  splitOpenStorageKey,
  taxUndoBack,
  taxUndoFor,
  toggledSplitOpen,
  withSplitMarkup,
  withSplitTaxable,
} from './rowMarksEdits'
import type { RowMarksByRowId } from './rowKinds'
import { rowMarksToDbPatch } from './rowMarksIo'
import { rowPriceSplit } from './rowPriceSplit'

describe('sovFactorFromMarkup / savedSovFactorOf', () => {
  it('saves 1 + the markup, to four places', () => {
    expect(sovFactorFromMarkup(0.35)).toBe(1.35)
    expect(sovFactorFromMarkup(0.5)).toBe(1.5)
    expect(sovFactorFromMarkup(0)).toBe(1)
    expect(sovFactorFromMarkup(0.123456)).toBe(1.1235)
    // 0.1 + 1 is 1.1 after the rounding, never 1.1000000000000001
    expect(sovFactorFromMarkup(0.1)).toBe(1.1)
  })
  it('null is the bid going back to the company number', () => {
    expect(sovFactorFromMarkup(null)).toBeNull()
  })
  it("reads the bid's saved factor as a number, and none as null", () => {
    expect(savedSovFactorOf({ sov_material_factor: 1.35 })).toBe(1.35)
    expect(savedSovFactorOf({ sov_material_factor: '1.4000' })).toBe(1.4)
    expect(savedSovFactorOf({ sov_material_factor: null })).toBeNull()
    expect(savedSovFactorOf({})).toBeNull()
    expect(savedSovFactorOf(null)).toBeNull()
  })
  it('a typed markup that saves as the factor already on the bid is the same number', () => {
    // The tab writes nothing when the two are equal; 35% typed on a bid saved at 1.35 must compare equal.
    expect(sovFactorFromMarkup(0.35)).toBe(savedSovFactorOf({ sov_material_factor: 1.35 }))
  })
})

describe('seedRowMarks', () => {
  it('reads each count row into its marks, keyed by row id', () => {
    const rows = [
      { id: 'wc', kind: 'fixture', tags: ['restrooms'], split_material_cents: null, split_markup_pct: 60, split_taxable: null },
      { id: 'lift', kind: 'equipment', tags: null, split_material_cents: null, split_markup_pct: null, split_taxable: null },
      { id: 'old-row' },
    ]
    expect(seedRowMarks(rows)).toEqual({
      wc: { kind: 'fixture', tags: ['restrooms'], split: { material: null, markup: 0.6, taxable: null } },
      lift: { kind: 'equipment', tags: [], split: null },
      'old-row': { kind: null, tags: [], split: null },
    })
  })
  it('no rows is no marks', () => {
    expect(seedRowMarks([])).toEqual({})
  })
})

describe('readRowMarkupText', () => {
  it('reads percent with one decimal as a markup', () => {
    expect(readRowMarkupText('35')).toEqual({ kind: 'markup', markup: 0.35 })
    expect(readRowMarkupText('12.5%')).toEqual({ kind: 'markup', markup: 0.125 })
    expect(readRowMarkupText(' 60 % ')).toEqual({ kind: 'markup', markup: 0.6 })
    expect(readRowMarkupText('0')).toEqual({ kind: 'markup', markup: 0 })
    // one decimal of a percent is kept, the rest is rounded off
    expect(readRowMarkupText('33.333')).toEqual({ kind: 'markup', markup: 0.333 })
    expect(readRowMarkupText('12.55')).toEqual({ kind: 'markup', markup: 0.126 })
  })
  it('empty text, or only a percent sign and spaces, clears', () => {
    expect(readRowMarkupText('')).toEqual({ kind: 'clear' })
    expect(readRowMarkupText(' % ')).toEqual({ kind: 'clear' })
  })
  it('a negative, a word or a number with a comma is unreadable', () => {
    expect(readRowMarkupText('-5')).toEqual({ kind: 'unreadable' })
    expect(readRowMarkupText('abc')).toEqual({ kind: 'unreadable' })
    expect(readRowMarkupText('1,5')).toEqual({ kind: 'unreadable' })
    expect(readRowMarkupText('Infinity')).toEqual({ kind: 'unreadable' })
  })
})

describe('rowMarkupPreviewOf', () => {
  it('nothing typed previews nothing', () => {
    expect(rowMarkupPreviewOf(null)).toBeNull()
  })
  it('a readable markup previews on its row', () => {
    expect(rowMarkupPreviewOf({ rowId: 'wc', text: '45%' })).toEqual({ rowId: 'wc', markup: 0.45 })
  })
  it("an emptied cell previews the bid's markup on its row", () => {
    expect(rowMarkupPreviewOf({ rowId: 'wc', text: '' })).toEqual({ rowId: 'wc', markup: null })
  })
  it('unreadable text previews nothing, so the row keeps its saved split', () => {
    expect(rowMarkupPreviewOf({ rowId: 'wc', text: '4x' })).toBeNull()
    expect(rowMarkupPreviewOf({ rowId: 'wc', text: '-1' })).toBeNull()
  })
})

describe('rowMarkupCommit', () => {
  it('writes a new markup', () => {
    expect(rowMarkupCommit(null, '45')).toEqual({ markup: 0.45 })
    expect(rowMarkupCommit(0.6, '45%')).toEqual({ markup: 0.45 })
  })
  it("empty text clears a row's own markup, and writes nothing on a row with none", () => {
    expect(rowMarkupCommit(0.6, '')).toEqual({ markup: null })
    expect(rowMarkupCommit(null, '')).toBeNull()
    expect(rowMarkupCommit(null, ' % ')).toBeNull()
  })
  it('the markup the row already has writes nothing', () => {
    expect(rowMarkupCommit(0.6, '60')).toBeNull()
    expect(rowMarkupCommit(0.125, '12.5%')).toBeNull()
  })
  it("the bid's markup typed on a row with none of its own is written as the row's own", () => {
    // The cell shows the bid's 35% on a row with no markup of its own; leaving it untouched still writes 0.35.
    expect(rowMarkupCommit(null, '35')).toEqual({ markup: 0.35 })
  })
  it('unreadable text writes nothing', () => {
    expect(rowMarkupCommit(0.6, 'abc')).toBeNull()
    expect(rowMarkupCommit(0.6, '-10')).toBeNull()
  })
})

describe('withSplitMarkup / withSplitTaxable', () => {
  it("sets the one value and keeps the rest of the row's marks", () => {
    const m = { kind: 'fixture' as const, tags: ['restrooms'], split: { material: 3200, markup: 0.6, taxable: false } }
    expect(withSplitMarkup(m, 0.45)).toEqual({ kind: 'fixture', tags: ['restrooms'], split: { material: 3200, markup: 0.45, taxable: false } })
    expect(withSplitTaxable(m, true)).toEqual({ kind: 'fixture', tags: ['restrooms'], split: { material: 3200, markup: 0.6, taxable: true } })
    expect(withSplitMarkup(m, null).split).toEqual({ material: 3200, markup: null, taxable: false })
  })
  it('a row with no split gains one', () => {
    expect(withSplitMarkup({}, 0.45)).toEqual({ split: { markup: 0.45 } })
    expect(withSplitTaxable({ split: null }, false)).toEqual({ split: { taxable: false } })
  })
  it('never changes the marks it was given', () => {
    const m = { split: { markup: 0.6 } }
    withSplitMarkup(m, 0.1)
    expect(m).toEqual({ split: { markup: 0.6 } })
  })
})

describe('the tools and their Undo', () => {
  const marks: RowMarksByRowId = {
    wc: { split: { markup: 0.6, taxable: false } },
    lav: { split: { material: 900 } },
    drain: {},
  }
  it("the Markup tool's undo list is each row's own markup as it stood", () => {
    expect(markupUndoFor(['wc', 'lav', 'drain', 'gone'], marks)).toEqual([
      { rowId: 'wc', markup: 0.6 },
      { rowId: 'lav', markup: undefined },
      { rowId: 'drain', markup: undefined },
      { rowId: 'gone', markup: undefined },
    ])
  })
  it('undo writes each back, and a row that had none goes back to null', () => {
    const back = markupUndoBack(markupUndoFor(['wc', 'lav', 'drain'], marks))
    expect([...back.entries()]).toEqual([
      ['wc', 0.6],
      ['lav', null],
      ['drain', null],
    ])
  })
  it('apply then undo leaves every row pricing as it did', () => {
    const undo = markupUndoFor(['wc', 'lav', 'drain'], marks)
    const applied: RowMarksByRowId = {}
    for (const id of ['wc', 'lav', 'drain']) applied[id] = withSplitMarkup(marks[id] ?? {}, 0.25)
    expect(applied).toEqual({ wc: { split: { markup: 0.25, taxable: false } }, lav: { split: { material: 900, markup: 0.25 } }, drain: { split: { markup: 0.25 } } })
    const back = markupUndoBack(undo)
    const undone: RowMarksByRowId = {}
    for (const id of back.keys()) undone[id] = withSplitMarkup(applied[id] ?? {}, back.get(id) ?? null)
    expect(undone).toEqual({ wc: { split: { markup: 0.6, taxable: false } }, lav: { split: { material: 900, markup: null } }, drain: { split: { markup: null } } })
  })
  it("the Tax tool's undo list and its way back", () => {
    const undo = taxUndoFor(['wc', 'lav', 'drain'], marks)
    expect(undo).toEqual([
      { rowId: 'wc', taxable: false },
      { rowId: 'lav', taxable: undefined },
      { rowId: 'drain', taxable: undefined },
    ])
    expect([...taxUndoBack(undo).entries()]).toEqual([
      ['wc', false],
      ['lav', null],
      ['drain', null],
    ])
  })
})

describe('putBackFailedRowMarks', () => {
  const before: RowMarksByRowId = { wc: { split: { markup: 0.6 } }, lav: {} }
  const onScreen: RowMarksByRowId = { wc: { split: { markup: 0.25 } }, lav: { split: { markup: 0.25 } }, drain: { tags: ['later'] } }
  it('puts back only the rows that failed', () => {
    expect(putBackFailedRowMarks(onScreen, ['wc', 'lav'], [true, false], before)).toEqual({ wc: { split: { markup: 0.6 } }, lav: { split: { markup: 0.25 } }, drain: { tags: ['later'] } })
  })
  it('a failed row that had no marks before goes back to none', () => {
    expect(putBackFailedRowMarks(onScreen, ['new'], [true], before)).toMatchObject({ new: {} })
  })
  it('nothing failed changes nothing, in a new object', () => {
    const out = putBackFailedRowMarks(onScreen, ['wc', 'lav'], [false, false], before)
    expect(out).toEqual(onScreen)
    expect(out).not.toBe(onScreen)
  })
})

describe('the open splits', () => {
  const store = (value: string | null) => ({ getItem: () => value })
  it('is remembered per bid', () => {
    expect(splitOpenStorageKey('bid-1')).toBe('pt.pricing.split.open.bid-1')
    expect(splitOpenStorageKey(null)).toBe('pt.pricing.split.open.')
    expect(splitOpenStorageKey(undefined)).toBe('pt.pricing.split.open.')
  })
  it('reads the remembered rows', () => {
    expect([...readSplitOpen(store('["wc","lav"]'), 'k')]).toEqual(['wc', 'lav'])
  })
  it('nothing remembered, no storage, a value that does not parse or is not a list is none open', () => {
    expect(readSplitOpen(store(null), 'k').size).toBe(0)
    expect(readSplitOpen(null, 'k').size).toBe(0)
    expect(readSplitOpen(store('{not json'), 'k').size).toBe(0)
    expect(readSplitOpen(store('5'), 'k').size).toBe(0)
    expect(
      readSplitOpen(
        {
          getItem: () => {
            throw new Error('storage refused')
          },
        },
        'k',
      ).size,
    ).toBe(0)
  })
  it('a chevron opens a closed row and closes an open one, in a new set', () => {
    const open = new Set(['wc'])
    expect([...toggledSplitOpen(open, 'lav')]).toEqual(['wc', 'lav'])
    expect([...toggledSplitOpen(open, 'wc')]).toEqual([])
    expect([...open]).toEqual(['wc'])
  })
})

describe('one row, from the typed cell to its dollars and its column', () => {
  // Six water closets sold at $4,800 for the row, $1,000 of takeoff material, on a bid at 35% and 8.25% tax.
  const row = { price: 4800, materialCost: 1000, markup: 0.35, taxPercent: 8.25, kind: 'fixture' as const }

  it("at the bid's markup: material $1,350, tax $111.375, labor $3,338.625", () => {
    const s = rowPriceSplit({ ...row, typed: null })
    expect(s.material).toBe(1350)
    expect(s.tax).toBeCloseTo(111.375, 10)
    expect(s.labor).toBeCloseTo(3338.625, 10)
    expect(s.markupSource).toBe('bid')
  })

  it('"60%" typed on the row: material $1,600, tax $132, labor $3,068, and the column holds 60', () => {
    const write = rowMarkupCommit(null, '60%')
    expect(write).toEqual({ markup: 0.6 })
    const marks = withSplitMarkup({ kind: 'fixture', tags: [] }, write!.markup)
    const s = rowPriceSplit({ ...row, typed: marks.split })
    expect(s.material).toBe(1600)
    expect(s.tax).toBeCloseTo(132, 10)
    expect(s.labor).toBeCloseTo(3068, 10)
    expect(s.markupSource).toBe('row')
    expect(rowMarksToDbPatch(marks)).toEqual({ kind: 'fixture', tags: [], split_material_cents: null, split_markup_pct: 60, split_taxable: null })
  })

  it('"12.5" while it is typed moves the labor at once: material $1,125, labor $3,582.1875', () => {
    const preview = rowMarkupPreviewOf({ rowId: 'wc', text: '12.5' })
    expect(preview).toEqual({ rowId: 'wc', markup: 0.125 })
    const s = rowPriceSplit({ ...row, typed: { markup: preview!.markup } })
    expect(s.material).toBe(1125)
    expect(s.tax).toBeCloseTo(92.8125, 10)
    expect(s.labor).toBeCloseTo(3582.1875, 10)
  })

  it("the cell emptied goes back to the bid's 35%", () => {
    const write = rowMarkupCommit(0.6, '')
    expect(write).toEqual({ markup: null })
    const marks = withSplitMarkup({ split: { markup: 0.6 } }, write!.markup)
    expect(rowPriceSplit({ ...row, typed: marks.split }).material).toBe(1350)
    expect(rowMarksToDbPatch(marks).split_markup_pct).toBeNull()
  })

  it('the Tax tool making the row tax-free moves its tax to labor: tax $0, labor $3,450', () => {
    const marks = withSplitTaxable({}, false)
    const s = rowPriceSplit({ ...row, typed: marks.split })
    expect(s.tax).toBe(0)
    expect(s.labor).toBe(3450)
    expect(rowMarksToDbPatch(marks).split_taxable).toBe(false)
  })

  it("the bid's markup typed as 35% saves the factor 1.35", () => {
    expect(sovFactorFromMarkup(0.35)).toBe(1.35)
  })
})
