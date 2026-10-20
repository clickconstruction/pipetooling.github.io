import { describe, expect, it } from 'vitest'
import { rowMarksFromDbRow, rowMarksToDbPatch } from './rowMarksIo'

describe('rowMarksFromDbRow / rowMarksToDbPatch', () => {
  it('reads the five columns into marks and writes them back the same', () => {
    const m = rowMarksFromDbRow({ id: 'r', kind: 'equipment', tags: ['restrooms', ' '], split_material_cents: '320000', split_markup_pct: 60, split_taxable: false })
    expect(m).toEqual({ kind: 'equipment', tags: ['restrooms'], split: { material: 3200, markup: 0.6, taxable: false } })
    expect(rowMarksToDbPatch(m)).toEqual({ kind: 'equipment', tags: ['restrooms'], split_material_cents: 320000, split_markup_pct: 60, split_taxable: false })
  })
  it('an unknown kind reads as none, and a row with no split has none', () => {
    const m = rowMarksFromDbRow({ id: 'r', kind: 'other', tags: null, split_material_cents: null, split_markup_pct: null, split_taxable: null })
    expect(m).toEqual({ kind: null, tags: [], split: null })
    expect(rowMarksToDbPatch(m)).toEqual({ kind: null, tags: [], split_material_cents: null, split_markup_pct: null, split_taxable: null })
  })
  it('rounds money to cents and a markup to a thousandth of a percent', () => {
    expect(rowMarksToDbPatch({ split: { material: 12.345, markup: 0.123456 } })).toMatchObject({ split_material_cents: 1235, split_markup_pct: 12.346 })
  })
})
