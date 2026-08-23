import { describe, expect, it } from 'vitest'
import { buildCountSheetPageGroups, countSheetSummary, findDuplicateFixture, parsePlanPageTokens, type CountSheetRow } from './countSheet'

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
