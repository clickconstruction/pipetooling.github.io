import { describe, expect, it } from 'vitest'
import { HISTORY_CITIES, HISTORY_GOAL_YMD, historyAsk, historyDoneWords, permitsColumnWords, reachDay, reachWords, recordsReach, recordsStartLine, recordsStartOf, theirPermitsTitle } from './permitReach'

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

describe('a read back as history', () => {
  /** The cities a read back is open for once it is no longer held. */
  const OPEN = ['San Antonio']

  it('asks for one step further back, up to the day the records start', () => {
    expect(historyAsk('San Antonio', '2026-08-26', TODAY, OPEN)).toEqual({
      since: '2026-05-26',
      until: '2026-08-26',
      words: "San Antonio's records here start Aug 26.",
      press: 'Read back to May 26',
      busy: 'Reading May 26 to Aug 26…',
    })
  })

  it('stops at the goal, and asks nothing once the records reach it or their start is not known', () => {
    expect(historyAsk('San Antonio', '2025-02-10', TODAY, OPEN)).toMatchObject({ since: HISTORY_GOAL_YMD, until: '2025-02-10', press: 'Read back to Jan 1, 2025', busy: 'Reading Jan 1, 2025 to Feb 10, 2025…' })
    expect(historyAsk('San Antonio', HISTORY_GOAL_YMD, TODAY, OPEN)).toBeNull()
    expect(historyAsk('San Antonio', '2024-06-01', TODAY, OPEN)).toBeNull()
    expect(historyAsk('San Antonio', null, TODAY, OPEN)).toBeNull()
    // A city whose feed cannot be read up to a day has no read back yet.
    expect(historyAsk('Seguin', '2026-08-26', TODAY, OPEN)).toBeNull()
    // Held: until the Permits reads are index-driven no city has a read back, so nothing is asked.
    expect(HISTORY_CITIES).toEqual([])
    expect(historyAsk('San Antonio', '2026-08-26', TODAY)).toBeNull()
  })

  it('says what a read back kept', () => {
    expect(historyDoneWords(6412, '2026-05-26', TODAY)).toBe('6,412 permits read back to May 26.')
    expect(historyDoneWords(1, '2025-01-01', TODAY)).toBe('1 permit read back to Jan 1, 2025.')
  })
})

describe('where a city’s records start', () => {
  it('is the day every feed reaches: the latest of each feed’s earliest clean read', () => {
    const runs = [
      { source: 'sa-issued', since: '2026-08-26' },
      { source: 'sa-applied', since: '2026-08-26' },
      { source: 'sa-issued', since: '2026-10-27' },
      { source: 'sa-issued', since: '2026-05-26' },
    ]
    // The applications were not read back yet, so the day does not move.
    expect(recordsStartOf(runs)).toBe('2026-08-26')
    expect(recordsStartOf([...runs, { source: 'sa-applied', since: '2026-05-26' }])).toBe('2026-05-26')
  })

  it('is nothing with no run on record', () => {
    expect(recordsStartOf([])).toBeNull()
    expect(recordsStartOf([{ source: 'sa-issued', since: null }])).toBeNull()
  })
})
