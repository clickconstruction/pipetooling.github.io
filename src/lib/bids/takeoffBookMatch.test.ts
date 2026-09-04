import { describe, expect, it } from 'vitest'
import { fillableBookMatches, matchBookEntries } from './takeoffBookMatch'

const entries = [
  { id: 'e-wc', fixture_name: 'Water Closet', alias_names: ['wc', 'toilet'], sequence_order: 1 },
  { id: 'e-lav', fixture_name: 'lav', alias_names: null, sequence_order: 2 },
  { id: 'e-wc12', fixture_name: 'wc-12', alias_names: [], sequence_order: 3 },
  { id: 'e-empty', fixture_name: 'fd', alias_names: [], sequence_order: 0 },
]
const items = [
  { entry_id: 'e-wc', template_id: 't-wc-rough', stage: 'rough_in', sequence_order: 2 },
  { entry_id: 'e-wc', template_id: 't-wc-trim', stage: 'trim_set', sequence_order: 3 },
  { entry_id: 'e-wc', template_id: 't-wc-rough', stage: 'top_out', sequence_order: 1 },
  { entry_id: 'e-lav', template_id: 't-lav', sequence_order: 1 },
  { entry_id: 'e-wc12', template_id: 't-wc12', sequence_order: 1 },
]

describe('matchBookEntries', () => {
  it('matches by primary name or alias on the exact form, then on the stripped key', () => {
    const m = matchBookEntries(
      [
        { id: 'r1', fixture: 'Toilet' },
        { id: 'r2', fixture: 'WC-3' },
        { id: 'r3', fixture: 'lav-1' },
        { id: 'r4', fixture: 'wco' },
      ],
      entries,
      items,
    )
    expect(m.get('r1')).toMatchObject({ entryId: 'e-wc', exact: true })
    expect(m.get('r2')).toMatchObject({ entryId: 'e-wc', exact: false })
    expect(m.get('r3')).toMatchObject({ entryId: 'e-lav', exact: false, templateIds: ['t-lav'] })
    expect(m.has('r4')).toBe(false)
  })

  it('prefers an exact-name entry over a key match, whatever the sequence order', () => {
    const m = matchBookEntries([{ id: 'r', fixture: 'WC-12' }], entries, items)
    expect(m.get('r')).toMatchObject({ entryId: 'e-wc12', exact: true, templateIds: ['t-wc12'] })
  })

  it('de-duplicates templates in item order and skips entries with no items', () => {
    const m = matchBookEntries([{ id: 'r', fixture: 'wc' }, { id: 'f', fixture: 'fd-2' }], entries, items)
    expect(m.get('r')?.templateIds).toEqual(['t-wc-rough', 't-wc-trim'])
    expect(m.has('f')).toBe(false)
  })

  it('ignores blank rows', () => {
    expect(matchBookEntries([{ id: 'x', fixture: '   ' }, { id: 'y', fixture: null }], entries, items).size).toBe(0)
  })
})

describe('fillableBookMatches', () => {
  it('keeps only matched rows that have no lines, in row order', () => {
    const rows = [{ id: 'a', fixture: 'wc' }, { id: 'b', fixture: 'lav' }, { id: 'c', fixture: 'wc-2' }]
    const m = matchBookEntries(rows, entries, items)
    expect(fillableBookMatches(rows, m, ['c', 'a']).map((x) => x.countRowId)).toEqual(['a', 'c'])
    expect(fillableBookMatches(rows, m, [])).toEqual([])
  })
})
