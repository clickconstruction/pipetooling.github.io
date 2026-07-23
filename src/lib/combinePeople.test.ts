import { describe, expect, it } from 'vitest'
import { LABOR_ASSIGNED_DELIMITER, replaceNameInAssignedList } from './combinePeople'

describe('replaceNameInAssignedList', () => {
  it('replaces an exact segment case-insensitively, preserving others', () => {
    expect(replaceNameInAssignedList('Behar Kraja (Rough In) | Jesse', 'behar kraja (rough in)', 'Behar Kraja')).toBe(
      `Behar Kraja${LABOR_ASSIGNED_DELIMITER}Jesse`,
    )
  })

  it('drops the segment instead of duplicating when the new name is already present', () => {
    expect(replaceNameInAssignedList('Behar Kraja (Rough In) | Behar Kraja', 'Behar Kraja (Rough In)', 'Behar Kraja')).toBe('Behar Kraja')
  })

  it('never partial-matches inside another segment', () => {
    expect(replaceNameInAssignedList('Behar Kraja Sr | Jesse', 'Behar Kraja', 'X')).toBeNull()
  })

  it('returns null when the name is absent or the list is empty', () => {
    expect(replaceNameInAssignedList('Jesse | Paige', 'Behar', 'X')).toBeNull()
    expect(replaceNameInAssignedList('', 'Behar', 'X')).toBeNull()
    expect(replaceNameInAssignedList(null, 'Behar', 'X')).toBeNull()
  })

  it('handles a single-name list and trims whitespace', () => {
    expect(replaceNameInAssignedList('  Behar Kraja (Rough In)  ', 'Behar Kraja (Rough In)', 'Behar Kraja')).toBe('Behar Kraja')
  })
})
