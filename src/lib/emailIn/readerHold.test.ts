import { describe, expect, it } from 'vitest'
import { isRateLimited, readerHold, retryAfterIn, RETRY_AFTER_CAP_MS, RETRY_AFTER_DEFAULT_MS } from './readerHold'

const WORDS = 'Gmail /labels failed (429): User-rate limit exceeded.  Retry after 2026-11-07T16:57:02.324Z'
const NOW = '2026-11-07T16:50:00.000Z'

describe('isRateLimited: Gmail’s 429 by its words', () => {
  it('reads the status gmail.ts writes, and Google’s own name for it', () => {
    expect(isRateLimited(WORDS)).toBe(true)
    expect(isRateLimited('Gmail /messages/abc failed (429): Rate Limit Exceeded')).toBe(true)
    expect(isRateLimited('rateLimitExceeded')).toBe(true)
  })

  it('is false for another failure, and for no words', () => {
    expect(isRateLimited('Gmail /history failed (404): Requested entity was not found.')).toBe(false)
    expect(isRateLimited('Writing 18f2 failed: duplicate key')).toBe(false)
    expect(isRateLimited(null)).toBe(false)
    expect(isRateLimited('')).toBe(false)
  })
})

describe('retryAfterIn: the time Google named', () => {
  it('is the ISO time after "Retry after", whatever the case or the spaces', () => {
    expect(retryAfterIn(WORDS)).toBe('2026-11-07T16:57:02.324Z')
    expect(retryAfterIn('User-rate limit exceeded. retry after 2026-11-07T08:08:00Z')).toBe('2026-11-07T08:08:00.000Z')
  })

  it('is null when the words name none, or name one that is not a time', () => {
    expect(retryAfterIn('Gmail /labels failed (429): User-rate limit exceeded.')).toBeNull()
    expect(retryAfterIn('Retry after soon')).toBeNull()
    expect(retryAfterIn(undefined)).toBeNull()
  })
})

describe('readerHold: a run inside Google’s window waits', () => {
  it('holds until Google’s own time while it is ahead', () => {
    expect(readerHold({ last_error: WORDS, updated_at: '2026-11-07T16:42:02.339Z' }, NOW)).toBe('2026-11-07T16:57:02.324Z')
  })

  it('runs once the time has passed, or when the last run was not a 429, or there is no row yet', () => {
    expect(readerHold({ last_error: WORDS, updated_at: '2026-11-07T16:42:02.339Z' }, '2026-11-07T16:58:00.000Z')).toBeNull()
    expect(readerHold({ last_error: WORDS, updated_at: '2026-11-07T16:42:02.339Z' }, '2026-11-07T16:57:02.324Z')).toBeNull()
    expect(readerHold({ last_error: 'Gmail /history failed (404): gone', updated_at: '2026-11-07T16:49:00Z' }, NOW)).toBeNull()
    expect(readerHold({ last_error: null, updated_at: '2026-11-07T16:49:00Z' }, NOW)).toBeNull()
    expect(readerHold(null, NOW)).toBeNull()
  })

  it('holds fifteen minutes past the row’s save when the 429 named no time', () => {
    const state = { last_error: 'Gmail /messages/abc failed (429): Rate Limit Exceeded', updated_at: '2026-11-07T16:45:00.000Z' }
    expect(readerHold(state, NOW)).toBe(new Date(Date.parse(state.updated_at) + RETRY_AFTER_DEFAULT_MS).toISOString())
    expect(readerHold({ ...state, updated_at: '2026-11-07T16:30:00.000Z' }, NOW)).toBeNull()
    expect(readerHold({ ...state, updated_at: null }, NOW)).toBeNull()
  })

  it('never holds more than an hour past now, whatever the words say', () => {
    const far = 'Gmail /labels failed (429): User-rate limit exceeded. Retry after 2026-11-09T00:00:00Z'
    expect(readerHold({ last_error: far, updated_at: NOW }, NOW)).toBe(new Date(Date.parse(NOW) + RETRY_AFTER_CAP_MS).toISOString())
  })

  it('runs when now is not a time', () => {
    expect(readerHold({ last_error: WORDS, updated_at: NOW }, 'later')).toBeNull()
  })
})
