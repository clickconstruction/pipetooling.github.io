import { describe, expect, it } from 'vitest'

import {
  buildPrepareCopyGroups,
  buildScopedFixtureCopyText,
  isFixtureEquipmentSection,
  rowIdsForScope,
  scopeForSelection,
  type PrepareCopyRow,
} from './prepareFixtureCopy'
import type { SpecSectionMatchRule } from './classifySpecSection'

const RULES: SpecSectionMatchRule[] = [
  { pattern: 'DEMO', matchKind: 'exact', sectionCode: null, priority: 50 },
  { pattern: 'WC-', matchKind: 'starts_with', sectionCode: '22 42 13', priority: 100 },
  { pattern: 'WH-', matchKind: 'starts_with', sectionCode: '22 33 00', priority: 170 },
  { pattern: 'WASTE', matchKind: 'contains', sectionCode: '22 13 16', priority: 200 },
  { pattern: 'WATER', matchKind: 'contains', sectionCode: '22 11 16', priority: 220 },
]

const TITLES = new Map([
  ['22 11 16', 'Domestic Water Piping'],
  ['22 13 16', 'Sanitary Waste and Vent Piping'],
  ['22 33 00', 'Electric Domestic Water Heaters'],
  ['22 42 13', 'Commercial Water Closets and Urinals'],
])

const ROWS: PrepareCopyRow[] = [
  { id: 'a', fixture: 'WC-1', count: 4 },
  { id: 'b', fixture: 'ft of 4IN WASTE', count: 751.45 },
  { id: 'c', fixture: 'ft of 3/4IN WATER', count: 1782.15 },
  { id: 'd', fixture: 'WH-1', count: 4 },
  { id: 'e', fixture: 'GPR-10', count: 1 },
  { id: 'f', fixture: 'DEMO', count: 24 },
  { id: 'g', fixture: 'ZERO', count: 0 },
]

const GROUPS = buildPrepareCopyGroups(ROWS, RULES, TITLES)

describe('buildPrepareCopyGroups', () => {
  it('groups by ascending section code with the tail last, skipping unusable counts', () => {
    expect(GROUPS.map((g) => g.sectionCode)).toEqual(['22 11 16', '22 13 16', '22 33 00', '22 42 13', null])
    const tail = GROUPS[GROUPS.length - 1]!
    expect(tail.rows.map((r) => r.fixture)).toEqual(['GPR-10', 'DEMO'])
    expect(GROUPS.flatMap((g) => g.rows.map((r) => r.id))).not.toContain('g')
  })
})

describe('scope presets', () => {
  it('splits fixtures & equipment (22 3x/22 4x) from pipe, tail only in whole', () => {
    expect(isFixtureEquipmentSection('22 42 13')).toBe(true)
    expect(isFixtureEquipmentSection('22 33 00')).toBe(true)
    expect(isFixtureEquipmentSection('22 11 16')).toBe(false)
    expect([...rowIdsForScope(GROUPS, 'whole')!].sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect([...rowIdsForScope(GROUPS, 'pipe')!].sort()).toEqual(['b', 'c'])
    expect([...rowIdsForScope(GROUPS, 'fixtures')!].sort()).toEqual(['a', 'd'])
    expect(rowIdsForScope(GROUPS, 'custom')).toBeNull()
  })

  it('recognizes which preset a selection is, and calls anything else custom', () => {
    expect(scopeForSelection(GROUPS, new Set(['b', 'c']))).toBe('pipe')
    expect(scopeForSelection(GROUPS, new Set(['a', 'd']))).toBe('fixtures')
    expect(scopeForSelection(GROUPS, new Set(['a', 'b', 'c', 'd', 'e', 'f']))).toBe('whole')
    expect(scopeForSelection(GROUPS, new Set(['a']))).toBe('custom')
  })
})

describe('buildScopedFixtureCopyText', () => {
  it('renders exactly the shipped grouped format for the selection', () => {
    const text = buildScopedFixtureCopyText({
      bidLabel: 'BP339 SAISD - DAVIS MS PHASE II',
      groups: GROUPS,
      selected: new Set(['b', 'c']),
      sectionTitleByCode: TITLES,
    })
    expect(text).toBe(
      [
        'Bid: BP339 SAISD - DAVIS MS PHASE II',
        '',
        '22 11 16 · Domestic Water Piping',
        'ft of 3/4IN WATER — 1782.15',
        '',
        '22 13 16 · Sanitary Waste and Vent Piping',
        'ft of 4IN WASTE — 751.45',
        '',
        'Items: 2',
      ].join('\n'),
    )
    expect(text).not.toContain('$')
  })

  it('selected tail rows land under No code yet; empty selection is just the bid line', () => {
    const text = buildScopedFixtureCopyText({
      bidLabel: 'Bid',
      groups: GROUPS,
      selected: new Set(['e', 'f']),
      sectionTitleByCode: TITLES,
    })
    expect(text).toContain('No code yet\nGPR-10 — 1\nDEMO — 24')
    expect(
      buildScopedFixtureCopyText({ bidLabel: 'Bid', groups: GROUPS, selected: new Set(), sectionTitleByCode: TITLES }),
    ).toBe('Bid: Bid')
  })
})
