import { describe, expect, it } from 'vitest'
import {
  CALLING_LOCK_TTL_MS,
  callingLockCutoffIso,
  callingLockDecision,
  isCallingLockLive,
} from './callingLock'

const NOW = Date.parse('2026-09-05T15:00:00Z')
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString()

describe('callingLockDecision', () => {
  it('takes when nobody holds the prospect', () => {
    expect(callingLockDecision({ existing: null, now: NOW, me: 'me' })).toBe('take')
    expect(callingLockDecision({ existing: undefined, now: NOW, me: 'me' })).toBe('take')
  })

  it('takes (refreshes) my own lock regardless of age', () => {
    expect(callingLockDecision({ existing: { user_id: 'me', locked_at: minutesAgo(1) }, now: NOW, me: 'me' })).toBe('take')
    expect(callingLockDecision({ existing: { user_id: 'me', locked_at: minutesAgo(600) }, now: NOW, me: 'me' })).toBe('take')
  })

  it("never steals a colleague's live lock", () => {
    expect(callingLockDecision({ existing: { user_id: 'them', locked_at: minutesAgo(2) }, now: NOW, me: 'me' })).toBe('held-by-other')
    expect(callingLockDecision({ existing: { user_id: 'them', locked_at: minutesAgo(29) }, now: NOW, me: 'me' })).toBe('held-by-other')
  })

  it("takes over a colleague's stale lock (closed tab, forgotten row)", () => {
    expect(callingLockDecision({ existing: { user_id: 'them', locked_at: minutesAgo(31) }, now: NOW, me: 'me' })).toBe('stale-take')
    expect(callingLockDecision({ existing: { user_id: 'them', locked_at: minutesAgo(60 * 24 * 7) }, now: NOW, me: 'me' })).toBe('stale-take')
  })

  it('the TTL edge: exactly TTL old is stale, one ms younger is live', () => {
    const exactly = new Date(NOW - CALLING_LOCK_TTL_MS).toISOString()
    const justInside = new Date(NOW - CALLING_LOCK_TTL_MS + 1).toISOString()
    expect(callingLockDecision({ existing: { user_id: 'them', locked_at: exactly }, now: NOW, me: 'me' })).toBe('stale-take')
    expect(callingLockDecision({ existing: { user_id: 'them', locked_at: justInside }, now: NOW, me: 'me' })).toBe('held-by-other')
  })

  it('honours a custom ttlMs', () => {
    expect(callingLockDecision({ existing: { user_id: 'them', locked_at: minutesAgo(5) }, now: NOW, me: 'me', ttlMs: 60_000 })).toBe('stale-take')
    expect(callingLockDecision({ existing: { user_id: 'them', locked_at: minutesAgo(5) }, now: NOW, me: 'me', ttlMs: 10 * 60_000 })).toBe('held-by-other')
  })

  it('a row with no / unparseable locked_at is never live', () => {
    expect(callingLockDecision({ existing: { user_id: 'them', locked_at: null }, now: NOW, me: 'me' })).toBe('stale-take')
    expect(callingLockDecision({ existing: { user_id: 'them', locked_at: 'garbage' }, now: NOW, me: 'me' })).toBe('stale-take')
  })
})

describe('isCallingLockLive', () => {
  it('is the TTL window', () => {
    expect(isCallingLockLive({ locked_at: minutesAgo(0) }, NOW)).toBe(true)
    expect(isCallingLockLive({ locked_at: minutesAgo(29) }, NOW)).toBe(true)
    expect(isCallingLockLive({ locked_at: minutesAgo(30) }, NOW)).toBe(false)
    expect(isCallingLockLive({ locked_at: null }, NOW)).toBe(false)
  })
})

describe('callingLockCutoffIso', () => {
  it('is now minus the TTL, as ISO for the .gte() filter', () => {
    expect(callingLockCutoffIso(NOW)).toBe('2026-09-05T14:30:00.000Z')
    expect(callingLockCutoffIso(NOW, 60_000)).toBe('2026-09-05T14:59:00.000Z')
  })

  it('the default TTL is 30 minutes', () => {
    expect(CALLING_LOCK_TTL_MS).toBe(30 * 60 * 1000)
  })
})
