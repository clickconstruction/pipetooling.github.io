import { describe, expect, it } from 'vitest'
import { canSwitchReader, readerHealthWords, readerIsOn } from './emailReader'

// Monday, October 12, 2026, 7:30 PM in Chicago.
const NOW = '2026-10-13T00:30:00.000Z'

describe('Read bids@', () => {
  it('lets the owner and a dev turn it on or off, as the switch’s policy does', () => {
    expect(canSwitchReader('master_technician')).toBe(true)
    expect(canSwitchReader('dev')).toBe(true)
    expect(canSwitchReader('assistant')).toBe(false)
    expect(canSwitchReader('estimator')).toBe(false)
    expect(canSwitchReader(null)).toBe(false)
  })

  it('reads on only for the word the cron reads', () => {
    expect(readerIsOn('true')).toBe(true)
    expect(readerIsOn('false')).toBe(false)
    expect(readerIsOn('TRUE')).toBe(false)
    expect(readerIsOn(null)).toBe(false)
    expect(readerIsOn(undefined)).toBe(false)
  })

  it('says when it last read, and that nothing is wrong, in Chicago', () => {
    expect(readerHealthWords({ last_ok_at: '2026-10-13T00:12:00.000Z', last_error: null }, NOW)).toBe('Last read today at 7:12 PM. Nothing wrong.')
    expect(readerHealthWords({ last_ok_at: '2026-10-10T14:05:00.000Z', last_error: null }, NOW)).toBe('Last read Sat, Oct 10 at 9:05 AM. Nothing wrong.')
  })

  it('says the error’s own words when the last run stopped on one', () => {
    expect(readerHealthWords({ last_ok_at: '2026-10-13T00:12:00.000Z', last_error: 'Gmail 403: Delegation denied. ' }, NOW)).toBe(
      'Last read today at 7:12 PM. The last run stopped: Gmail 403: Delegation denied.',
    )
    expect(readerHealthWords({ last_ok_at: null, last_error: 'GMAIL_IMPERSONATE_USER is not set.' }, NOW)).toBe('Not read yet. The last run stopped: GMAIL_IMPERSONATE_USER is not set.')
  })

  it('says it has not read yet before its first run, or before its row is there', () => {
    expect(readerHealthWords({ last_ok_at: null, last_error: null }, NOW)).toBe('Not read yet.')
    expect(readerHealthWords(null, NOW)).toBe('Not read yet.')
  })
})
