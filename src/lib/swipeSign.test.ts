// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerDismissalPusher } from './dismissalStore'
import { IMPERSONATION_ORIGINAL_STORAGE_KEY } from './impersonationSession'
import {
  SWIPE_SIGN_MAX_PLAYS,
  SWIPE_SIGN_PREFIX,
  loadSwipeSignState,
  newSwipeSignState,
  readSwipeSignState,
  saveSwipeSignState,
  swipeSignLearned,
  swipeSignMayPlay,
  swipeSignPlayed,
} from './swipeSign'

describe('the sign that a row swipes: when it may show (punch list #426)', () => {
  it('a person who has seen nothing may be shown either way', () => {
    const s = newSwipeSignState()
    expect(swipeSignMayPlay(s, 'away', '2026-11-25')).toBe(true)
    expect(swipeSignMayPlay(s, 'back', '2026-11-25')).toBe(true)
  })

  it('shows once a day at most', () => {
    const s = swipeSignPlayed(newSwipeSignState(), 'away', '2026-11-25')
    expect(swipeSignMayPlay(s, 'away', '2026-11-25')).toBe(false)
    expect(swipeSignMayPlay(s, 'away', '2026-11-26')).toBe(true)
    // The other way has its own count.
    expect(swipeSignMayPlay(s, 'back', '2026-11-25')).toBe(true)
  })

  it('shows three times at most', () => {
    let s = newSwipeSignState()
    const days = ['2026-11-25', '2026-11-26', '2026-11-27']
    for (const d of days) {
      expect(swipeSignMayPlay(s, 'away', d)).toBe(true)
      s = swipeSignPlayed(s, 'away', d)
    }
    expect(s.away.plays).toBe(SWIPE_SIGN_MAX_PLAYS)
    expect(swipeSignMayPlay(s, 'away', '2026-11-28')).toBe(false)
    expect(swipeSignMayPlay(s, 'away', '2027-01-01')).toBe(false)
  })

  it('is done for good once the person makes the swipe themselves', () => {
    const s = swipeSignLearned(newSwipeSignState(), 'away')
    expect(swipeSignMayPlay(s, 'away', '2026-11-25')).toBe(false)
    expect(swipeSignMayPlay(s, 'away', '2026-12-25')).toBe(false)
    // Learning the way out does not teach the way back.
    expect(swipeSignMayPlay(s, 'back', '2026-11-25')).toBe(true)
    // Learned twice is the same state, so nothing is saved again.
    expect(swipeSignLearned(s, 'away')).toBe(s)
  })

  it('reads whatever storage held with care', () => {
    expect(readSwipeSignState(null)).toEqual(newSwipeSignState())
    expect(readSwipeSignState('x')).toEqual(newSwipeSignState())
    expect(readSwipeSignState({ away: { plays: 2.9, lastYmd: '2026-11-25', learned: 'yes' }, back: 7 })).toEqual({
      away: { plays: 2, lastYmd: '2026-11-25', learned: false },
      back: { plays: 0, lastYmd: null, learned: false },
    })
    expect(readSwipeSignState({ away: { plays: -4, lastYmd: 'yesterday', learned: true } }).away).toEqual({ plays: 0, lastYmd: null, learned: true })
  })
})

describe('the sign that a row swipes: where the count is kept', () => {
  const pushed: Array<{ userId: string; key: string; state: unknown }> = []
  beforeEach(() => {
    localStorage.clear()
    pushed.length = 0
    registerDismissalPusher((userId, key, state) => pushed.push({ userId, key, state }))
  })
  afterEach(() => {
    registerDismissalPusher(null)
    vi.restoreAllMocks()
  })

  it('is kept on the device and with the person, under the key a new device is seeded by', () => {
    const s = swipeSignPlayed(newSwipeSignState(), 'away', '2026-11-25')
    saveSwipeSignState('me', s)
    expect(JSON.parse(localStorage.getItem(SWIPE_SIGN_PREFIX + 'me') ?? 'null')).toEqual(s)
    expect(pushed).toEqual([{ userId: 'me', key: SWIPE_SIGN_PREFIX, state: s }])
    expect(loadSwipeSignState('me')).toEqual(s)
    // Another person on the same device has their own count.
    expect(loadSwipeSignState('you')).toEqual(newSwipeSignState())
  })

  it('while View as is on, nothing is written: the person viewed has not seen it', () => {
    localStorage.setItem(IMPERSONATION_ORIGINAL_STORAGE_KEY, JSON.stringify({ access_token: 'a', refresh_token: 'r' }))
    saveSwipeSignState('them', swipeSignLearned(newSwipeSignState(), 'away'))
    expect(localStorage.getItem(SWIPE_SIGN_PREFIX + 'them')).toBeNull()
    expect(pushed).toEqual([])
  })

  it('a blocked or broken store reads as nothing seen and never throws', () => {
    localStorage.setItem(SWIPE_SIGN_PREFIX + 'me', '{not json')
    expect(loadSwipeSignState('me')).toEqual(newSwipeSignState())
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => saveSwipeSignState('me', newSwipeSignState())).not.toThrow()
  })
})
