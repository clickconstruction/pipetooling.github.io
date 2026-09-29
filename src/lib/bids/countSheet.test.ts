import { describe, expect, it } from 'vitest'
import { alternateScopeKey, buildCountSheetGroupGroups, buildCountSheetPageGroups, countSheetAlternateTotals, countSheetSummary, findDuplicateFixture, isAlternateRow, mergeAlternateTags, parsePlanPageTokens, summarizeAlternates, toggleAlternateTag, type CountSheetRow } from './countSheet'

const row = (id: string, fixture: string, count: number, page: string | null, group_tag: string | null = null, unit: string | null = null): CountSheetRow => ({ id, fixture, count, page, group_tag, unit })

describe('parsePlanPageTokens', () => {
  it('splits on commas/semicolons, trims, dedupes', () => {
    expect(parsePlanPageTokens('5, 26,38')).toEqual(['5', '26', '38'])
    expect(parsePlanPageTokens('26; 26 , A-101')).toEqual(['26', 'A-101'])
    expect(parsePlanPageTokens('  ')).toEqual([])
    expect(parsePlanPageTokens(null)).toEqual([])
  })
})

describe('countSheetSummary', () => {
  it('totals items per unit (never feet into counts), missing pages, and group tags', () => {
    const s = countSheetSummary([
      row('a', 'WC', 6, '5, 26'),
      row('b', 'ft of Waterline', 200, null),
      row('c', 'Sink', 12, '26', 'Kitchen'),
      row('d', '2in copper', 30.5, '26', null, 'ft'),
    ])
    expect(s.items).toBe(4)
    expect(s.byUnit.ea).toEqual({ items: 2, total: 18 })
    expect(s.byUnit.ft).toEqual({ items: 2, total: 230.5 })
    expect(s.byUnit.px).toEqual({ items: 0, total: 0 })
    expect(s.noPageCount).toBe(1)
    expect(s.withGroupTag).toBe(1)
  })
})

describe('buildCountSheetPageGroups', () => {
  it('groups by page with multi-page rows under each, numeric pages first', () => {
    const g = buildCountSheetPageGroups([
      row('a', 'WC', 6, '5, 26'),
      row('b', 'WH', 2, '26'),
      row('c', 'Riser', 1, 'A-101'),
      row('d', 'Waterline', 200, null),
      row('e', 'ft of 2in CW', 40.25, '26'),
    ])
    expect(g.pages.map((p) => p.label)).toEqual(['5', '26', 'A-101'])
    expect(g.pages[1]!.rows.map((r) => r.fixture)).toEqual(['WC', 'WH', 'ft of 2in CW'])
    expect(g.pages[1]!.byUnit.ft).toEqual({ items: 1, total: 40.25 })
    expect(g.pages[1]!.byUnit.ea).toEqual({ items: 2, total: 8 })
    expect(g.noPage.map((r) => r.fixture)).toEqual(['Waterline'])
  })
})

describe('findDuplicateFixture', () => {
  it('matches case-insensitively and trimmed', () => {
    const rows = [row('a', 'WC', 6, null)]
    expect(findDuplicateFixture(rows, ' wc ')?.id).toBe('a')
    expect(findDuplicateFixture(rows, 'WH')).toBeNull()
    expect(findDuplicateFixture(rows, '')).toBeNull()
  })

  it('excludes the row being renamed, but still catches other rows', () => {
    const rows = [row('a', 'WC', 6, null), row('b', 'Lav', 2, null)]
    expect(findDuplicateFixture(rows, 'wc', 'a')).toBeNull()
    expect(findDuplicateFixture(rows, 'lav', 'a')?.id).toBe('b')
  })
})

describe('alternates (v2.4188)', () => {
  const rows = [
    { id: 'a', fixture: 'WC', count: 4, group_tag: 'Restroom A', page: '2' },
    { id: 'b', fixture: 'ft of 2" PVC', count: 112, group_tag: 'Restroom A', page: '2' },
    { id: 'c', fixture: 'WH', count: 1, group_tag: null, page: '1' },
    { id: 'd', fixture: 'WC', count: 1, group_tag: 'Break room', page: '3' },
    { id: 'e', fixture: 'ft of 2" PVC', count: 48.5, group_tag: 'break room ', page: '3' },
    { id: 'f', fixture: 'LAV', count: 2, group_tag: 'Annex', page: '4' },
  ]
  const alts = ['Break room', 'Annex']

  it('groups by tag: base groups alphabetical, then the alternates; rows with no group apart', () => {
    const { groups, noGroup } = buildCountSheetGroupGroups(rows, alts)
    expect(groups.map((g) => [g.label, g.alternate, g.rows.length])).toEqual([['Restroom A', false, 2], ['Annex', true, 1], ['Break room', true, 2]])
    expect(noGroup.map((r) => r.id)).toEqual(['c'])
    expect(groups[2]!.byUnit.ea).toEqual({ items: 1, total: 1 })
    expect(groups[2]!.byUnit.ft).toEqual({ items: 1, total: 48.5 })
  })

  it('totals the base and each alternate; null when no alternate holds a row', () => {
    const t = countSheetAlternateTotals(rows, alts)!
    expect(t.base.ea).toEqual({ items: 2, total: 5 })
    expect(t.base.ft).toEqual({ items: 1, total: 112 })
    expect(t.alternates.map((a) => [a.label, a.byUnit.ea.total, a.byUnit.ft.total])).toEqual([['Annex', 2, 0], ['Break room', 1, 48.5]])
    expect(countSheetAlternateTotals(rows, ['Nothing here'])).toBeNull()
    expect(countSheetAlternateTotals(rows, [])).toBeNull()
    expect(countSheetSummary(rows, alts).alternates).toBe(2)
    expect(summarizeAlternates(rows, ['Break room'])).toBe('1 alternate: Break room (1 ea · 48.5 ft)')
  })

  it('scope: the same fixture in the base and in an alternate are not duplicates of each other', () => {
    expect(findDuplicateFixture(rows, 'WC')?.id).toBe('a')                                                    // no scope: the old rule
    expect(findDuplicateFixture(rows, 'WC', undefined, { alternateTags: alts, groupTag: null })?.id).toBe('a')
    expect(findDuplicateFixture(rows, 'wc', undefined, { alternateTags: alts, groupTag: 'Break room' })?.id).toBe('d')
    expect(findDuplicateFixture(rows, 'WC', 'd', { alternateTags: alts, groupTag: 'Break room' })).toBeNull()
    expect(findDuplicateFixture(rows, 'WC', undefined, { alternateTags: alts, groupTag: 'Annex' })).toBeNull()
    expect(alternateScopeKey(rows[4]!, alts)).toBe('break room')
    expect(alternateScopeKey(rows[0]!, alts)).toBe('')
  })

  it('toggle and merge keep spelling and order and never double a tag', () => {
    expect(toggleAlternateTag(['Annex'], ' Break room ', true)).toEqual(['Annex', 'Break room'])
    expect(toggleAlternateTag(['Annex', 'Break room'], 'break ROOM', true)).toEqual(['Annex', 'break ROOM'])
    expect(toggleAlternateTag(['Annex', 'Break room'], 'break room', false)).toEqual(['Annex'])
    expect(mergeAlternateTags(['Annex'], ['annex', 'Break room', ' '])).toEqual(['Annex', 'Break room'])
    expect(isAlternateRow({ group_tag: 'BREAK ROOM' }, ['Break room'])).toBe(true)
    expect(isAlternateRow({ group_tag: null }, ['Break room'])).toBe(false)
  })
})
