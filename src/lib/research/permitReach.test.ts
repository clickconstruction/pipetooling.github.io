import { describe, expect, it } from 'vitest'
import { permitsColumnWords, reachDay, reachWords, recordsReach, recordsStartLine, theirPermitsTitle } from './permitReach'

const TODAY = '2026-11-10'

describe('recordsReach', () => {
  it('is the day the records start while they are shorter than the window', () => {
    expect(recordsReach('2026-08-26', TODAY)).toEqual({ sinceYmd: '2026-08-26', whole: false })
  })

  it('is the window once the records reach back a year or more', () => {
    expect(recordsReach('2025-01-01', TODAY)).toEqual({ sinceYmd: '2025-11-10', whole: true })
    expect(recordsReach('2025-11-10', TODAY)).toEqual({ sinceYmd: '2025-11-10', whole: true })
    expect(recordsReach('2025-11-11', TODAY)).toEqual({ sinceYmd: '2025-11-11', whole: false })
  })

  it('knows nothing when the start is missing or is not a day', () => {
    expect(recordsReach(null, TODAY)).toEqual({ sinceYmd: null, whole: false })
    expect(recordsReach('', TODAY)).toEqual({ sinceYmd: null, whole: false })
    expect(recordsReach('2026-08-26T00:00:00Z', TODAY)).toEqual({ sinceYmd: null, whole: false })
  })

  it('takes a window of its own', () => {
    expect(recordsReach('2026-08-26', TODAY, 30)).toEqual({ sinceYmd: '2026-10-11', whole: true })
  })
})

describe('the words a count ends on', () => {
  it('names the day, with the year when it is another year', () => {
    expect(reachDay('2026-08-26', TODAY)).toBe('Aug 26')
    expect(reachDay('2025-12-03', TODAY)).toBe('Dec 3, 2025')
  })

  it('says since the day on short records and a year on whole ones', () => {
    expect(reachWords(recordsReach('2026-08-26', TODAY), TODAY)).toBe('since Aug 26')
    expect(reachWords(recordsReach('2025-11-20', TODAY), TODAY)).toBe('since Nov 20, 2025')
    expect(reachWords(recordsReach('2025-01-01', TODAY), TODAY)).toBe('in the last year')
    expect(reachWords(recordsReach('2026-08-26', TODAY, 30), TODAY, 30)).toBe('in the last 30 days')
  })

  it('says nothing when the start is not known', () => {
    expect(reachWords(recordsReach(null, TODAY), TODAY)).toBeNull()
  })
})

describe('the Builders page', () => {
  it('heads the count column with what it covers', () => {
    expect(permitsColumnWords(recordsReach('2026-08-26', TODAY), TODAY)).toBe('Permits since Aug 26')
    expect(permitsColumnWords(recordsReach('2025-01-01', TODAY), TODAY)).toBe('Permits, 12 mo')
    expect(permitsColumnWords(recordsReach(null, TODAY), TODAY)).toBe('Permits')
  })

  it('titles a builder’s permits the same way', () => {
    expect(theirPermitsTitle(recordsReach('2026-08-26', TODAY), TODAY)).toBe('Their permits since Aug 26')
    expect(theirPermitsTitle(recordsReach('2025-01-01', TODAY), TODAY)).toBe('Their permits in the last year')
    expect(theirPermitsTitle(recordsReach(null, TODAY), TODAY)).toBe('Their permits')
  })

  it('says where the records start only while they are short', () => {
    expect(recordsStartLine('San Antonio', recordsReach('2026-08-26', TODAY), TODAY)).toBe("San Antonio's records here start Aug 26. Every count is what we can see since then.")
    expect(recordsStartLine('Corpus', recordsReach('2026-08-26', TODAY), TODAY)).toBe("Corpus' records here start Aug 26. Every count is what we can see since then.")
    expect(recordsStartLine('San Antonio', recordsReach('2025-01-01', TODAY), TODAY)).toBeNull()
    expect(recordsStartLine('San Antonio', recordsReach(null, TODAY), TODAY)).toBeNull()
  })
})
