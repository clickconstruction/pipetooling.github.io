import { describe, expect, it } from 'vitest'
import { bookFillMessage, fillFromBookLabel, planBookFill } from './takeoffBookFill'

const entries = [
  { id: 'e-wc', fixture_name: 'wc', alias_names: ['toilet'], sequence_order: 1, items: [{ entry_id: 'e-wc', template_id: 't-wc', sequence_order: 1 }] },
  { id: 'e-s', fixture_name: 's', alias_names: null, sequence_order: 2, items: [{ entry_id: 'e-s', template_id: 't-sink', sequence_order: 1 }, { entry_id: 'e-s', template_id: 't-stops', sequence_order: 2 }] },
  { id: 'e-none', fixture_name: 'wh', alias_names: null, sequence_order: 3, items: [] },
]
const rows = [
  { id: 'r-wc', fixture: 'WC-12', count: 2 },
  { id: 'r-s1', fixture: 'S-1', count: 2 },
  { id: 'r-s2', fixture: 'S-2', count: 1 },
  { id: 'r-wh', fixture: 'WH-1', count: 1 },
  { id: 'r-fd', fixture: 'fd-2', count: 8 },
]
const line = (id: string, countRowId: string) => ({ id, countRowId, partId: 'p', quantity: 1, unitPrice: 1, sourceMaterialPartPriceId: null, sourceTemplateId: null })

describe('planBookFill', () => {
  it('lists matched fixtures without lines, in row order, and counts the rest', () => {
    const plan = planBookFill(rows, [line('l1', 'r-s1')], entries)
    expect(plan.fillable.map((m) => [m.countRowId, m.templateIds])).toEqual([
      ['r-wc', ['t-wc']],
      ['r-s2', ['t-sink', 't-stops']],
    ])
    expect(plan.matched).toBe(3)
    expect(plan.alreadyCosted).toBe(1)
  })

  it('is empty when no entry has items or no fixture matches', () => {
    expect(planBookFill(rows, [], [entries[2]!])).toEqual({ fillable: [], matched: 0, alreadyCosted: 0 })
    expect(planBookFill([{ id: 'x', fixture: 'lav', count: 1 }], [], entries).fillable).toEqual([])
  })
})

describe('bookFillMessage', () => {
  it('reads naturally for the common outcomes', () => {
    expect(bookFillMessage({ fixturesFilled: 3, linesAdded: 11, partsWithoutPrice: 0, emptyAssemblies: 0 })).toBe('Filled 3 fixtures from the book (11 lines).')
    expect(bookFillMessage({ fixturesFilled: 1, linesAdded: 1, partsWithoutPrice: 1, emptyAssemblies: 1 })).toBe('Filled 1 fixture from the book (1 line) · 1 without a catalog price · 1 empty assembly skipped.')
    expect(bookFillMessage({ fixturesFilled: 0, linesAdded: 0, partsWithoutPrice: 0, emptyAssemblies: 2 })).toBe('Nothing added — the matched assemblies have no parts.')
  })
})

describe('fillFromBookLabel', () => {
  it('keeps the By Stage button as it was', () => {
    expect(fillFromBookLabel(null, false, false)).toEqual({ label: 'Apply Matching Fixture Assemblies', disabled: false, title: '' })
    expect(fillFromBookLabel(null, true, false).label).toBe('Applying…')
  })

  it('names the match count under Combined and explains a disabled button', () => {
    const plan = planBookFill(rows, [], entries)
    expect(fillFromBookLabel(plan, false, true)).toMatchObject({ label: 'Fill from book · 3 matches', disabled: false })
    expect(fillFromBookLabel(plan, true, true)).toMatchObject({ label: 'Filling…', disabled: true })
    const done = planBookFill(rows, [line('a', 'r-wc'), line('b', 'r-s1'), line('c', 'r-s2')], entries)
    expect(fillFromBookLabel(done, false, true)).toMatchObject({ label: 'Fill from book · 0 matches', disabled: true, title: 'Every fixture this book matches already has lines' })
    expect(fillFromBookLabel({ fillable: [], matched: 0, alreadyCosted: 0 }, false, true).title).toContain('No entry in this book matches')
  })
})
