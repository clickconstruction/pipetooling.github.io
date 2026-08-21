import { describe, expect, it } from 'vitest'
import { buildCountSheetPageGroups, countSheetSummary, findDuplicateFixture, parsePlanPageTokens, type CountSheetRow } from './countSheet'

const row = (id: string, fixture: string, count: number, page: string | null, group_tag: string | null = null): CountSheetRow => ({ id, fixture, count, page, group_tag })

describe('parsePlanPageTokens', () => {
  it('splits on commas/semicolons, trims, dedupes', () => {
    expect(parsePlanPageTokens('5, 26,38')).toEqual(['5', '26', '38'])
    expect(parsePlanPageTokens('26; 26 , A-101')).toEqual(['26', 'A-101'])
    expect(parsePlanPageTokens('  ')).toEqual([])
    expect(parsePlanPageTokens(null)).toEqual([])
  })
})

describe('countSheetSummary', () => {
  it('totals items, units, missing pages, and group tags', () => {
    const s = countSheetSummary([
      row('a', 'WC', 6, '5, 26'),
      row('b', 'Waterline', 200, null),
      row('c', 'Sink', 12, '26', 'Kitchen'),
    ])
    expect(s).toEqual({ items: 3, units: 218, noPageCount: 1, withGroupTag: 1 })
  })
})

describe('buildCountSheetPageGroups', () => {
  it('groups by page with multi-page rows under each, numeric pages first', () => {
    const g = buildCountSheetPageGroups([
      row('a', 'WC', 6, '5, 26'),
      row('b', 'WH', 2, '26'),
      row('c', 'Riser', 1, 'A-101'),
      row('d', 'Waterline', 200, null),
    ])
    expect(g.pages.map((p) => p.label)).toEqual(['5', '26', 'A-101'])
    expect(g.pages[1]!.rows.map((r) => r.fixture)).toEqual(['WC', 'WH'])
    expect(g.pages[1]!.units).toBe(8)
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
