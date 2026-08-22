import { describe, expect, it } from 'vitest'
import { matchCountRowsToBookEntries } from './bookEntryMatching'

const entries = [
  { id: 'e1', name: 'WH-1' },
  { id: 'e2', name: 'WCO' },
  { id: 'e3', name: 'Lav-1' },
  { id: 'e4', name: 'DUP' },
  { id: 'e5', name: 'dup' },
]

describe('matchCountRowsToBookEntries', () => {
  it('matches exact names, trimmed and case-insensitive', () => {
    const rows = [
      { id: 'r1', fixture: ' wh-1 ', hasAssignment: false },
      { id: 'r2', fixture: 'WCO', hasAssignment: false },
      { id: 'r3', fixture: '3/4IN 90 WATER', hasAssignment: false },
    ]
    expect(matchCountRowsToBookEntries(rows, entries)).toEqual([
      { countRowId: 'r1', entryId: 'e1' },
      { countRowId: 'r2', entryId: 'e2' },
    ])
  })

  it('skips rows that already have an assignment', () => {
    const rows = [{ id: 'r1', fixture: 'WH-1', hasAssignment: true }]
    expect(matchCountRowsToBookEntries(rows, entries)).toEqual([])
  })

  it('never matches a name shared by two entries (ambiguous → per-row search decides)', () => {
    const rows = [{ id: 'r1', fixture: 'DUP', hasAssignment: false }]
    expect(matchCountRowsToBookEntries(rows, entries)).toEqual([])
  })

  it('ignores blank fixtures and blank entry names', () => {
    const rows = [{ id: 'r1', fixture: '  ', hasAssignment: false }]
    expect(matchCountRowsToBookEntries(rows, [{ id: 'e9', name: null }])).toEqual([])
  })
})
