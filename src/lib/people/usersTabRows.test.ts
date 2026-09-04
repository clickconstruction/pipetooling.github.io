import { describe, expect, it } from 'vitest'
import type { RailRow } from './deskRailAttention'
import { describeGroupCount, foldNoLoginRows, orderUsersTabRows, rowMatchesFilter } from './usersTabRows'

function row(p: Partial<RailRow> & { name: string }): RailRow {
  return { userId: null, personId: `p-${p.name}`, kind: 'sub', archived: false, attention: 'green', badge: '', reasons: [], signals: [], ...p }
}

describe('orderUsersTabRows', () => {
  it('puts account rows first, then roster-only, alphabetical within each', () => {
    const out = orderUsersTabRows([row({ name: 'Zed' }), row({ name: 'Behar', userId: 'u1' }), row({ name: 'Adam' }), row({ name: 'Michael A', userId: 'u2' })])
    expect(out.map((r) => r.name)).toEqual(['Behar', 'Michael A', 'Adam', 'Zed'])
  })
})

describe('rowMatchesFilter', () => {
  it('reads login, attention, and field/office off the row', () => {
    const sub = row({ name: 'DV', attention: 'amber' })
    const office = row({ name: 'Grace', userId: 'u', kind: 'assistant' })
    expect(rowMatchesFilter(sub, 'all')).toBe(true)
    expect(rowMatchesFilter(sub, 'nologin')).toBe(true)
    expect(rowMatchesFilter(office, 'nologin')).toBe(false)
    expect(rowMatchesFilter(sub, 'attention')).toBe(true)
    expect(rowMatchesFilter(office, 'attention')).toBe(false)
    expect(rowMatchesFilter(sub, 'field')).toBe(true)
    expect(rowMatchesFilter(office, 'office')).toBe(true)
    expect(rowMatchesFilter(row({ name: 'Abe', kind: 'superintendent' }), 'field')).toBe(true)
  })
})

describe('foldNoLoginRows', () => {
  const rows = orderUsersTabRows([row({ name: 'Behar', userId: 'u1' }), ...Array.from({ length: 9 }, (_, i) => row({ name: `Sub ${String.fromCharCode(65 + i)}` }))])

  it('keeps account rows and the first six roster-only rows, folds the rest', () => {
    const { shown, folded } = foldNoLoginRows(rows, { forceOpen: false })
    expect(shown.map((r) => r.name)).toEqual(['Behar', 'Sub A', 'Sub B', 'Sub C', 'Sub D', 'Sub E', 'Sub F'])
    expect(folded.map((r) => r.name)).toEqual(['Sub G', 'Sub H', 'Sub I'])
  })

  it('never folds a single row, and force-open shows everything', () => {
    const seven = orderUsersTabRows(Array.from({ length: 7 }, (_, i) => row({ name: `S${i}` })))
    expect(foldNoLoginRows(seven, { forceOpen: false }).folded).toEqual([])
    expect(foldNoLoginRows(rows, { forceOpen: true }).folded).toEqual([])
  })
})

describe('describeGroupCount', () => {
  it('says how many have a login', () => {
    expect(describeGroupCount([row({ name: 'a', userId: 'u' }), row({ name: 'b' })])).toBe('2 · 1 with a login')
    expect(describeGroupCount([row({ name: 'a', userId: 'u' })])).toBe('1')
    expect(describeGroupCount([row({ name: 'a' }), row({ name: 'b' })])).toBe('2 · no logins')
    expect(describeGroupCount([])).toBe('')
  })
})
