import { describe, expect, it } from 'vitest'
import { matchesQuickfillSectionSearch } from './quickfillSectionSearch'

describe('matchesQuickfillSectionSearch', () => {
  it('matches everything on blank or whitespace-only search', () => {
    expect(matchesQuickfillSectionSearch('Office Arriving', '')).toBe(true)
    expect(matchesQuickfillSectionSearch('Office Arriving', '   ')).toBe(true)
    expect(matchesQuickfillSectionSearch('', '')).toBe(true)
  })

  it('matches case-insensitive substrings', () => {
    expect(matchesQuickfillSectionSearch('Office Arriving', 'office')).toBe(true)
    expect(matchesQuickfillSectionSearch('Office Arriving', 'ARRIV')).toBe(true)
    expect(matchesQuickfillSectionSearch('Ready to Bill', 'bill')).toBe(true)
    expect(matchesQuickfillSectionSearch('Unreachable Prospects', 'reach')).toBe(true)
  })

  it('trims the search text before matching', () => {
    expect(matchesQuickfillSectionSearch('Hours', '  hours  ')).toBe(true)
  })

  it('rejects non-matching labels', () => {
    expect(matchesQuickfillSectionSearch('Office Arriving', 'bill')).toBe(false)
    expect(matchesQuickfillSectionSearch('Hours', 'hourz')).toBe(false)
    expect(matchesQuickfillSectionSearch('', 'x')).toBe(false)
  })

  it('does not treat the search as a regex', () => {
    expect(matchesQuickfillSectionSearch('Office Arriving', '.*')).toBe(false)
    expect(matchesQuickfillSectionSearch('A+B', 'a+b')).toBe(true)
  })
})
