import { describe, expect, it } from 'vitest'
import { isMercuryIsoInstant, mercuryPostedOnALaterDay, mercurySwipeAtIso, mercurySwipeDayYmd } from './mercurySwipeTime'

// Swiped Tuesday 9:17 AM Chicago, posted overnight into Wednesday.
const SWIPE = '2026-09-15T14:17:00.000Z'
const POSTED = '2026-09-16T06:30:00+00:00'

describe('mercurySwipeAtIso', () => {
  it('reads the swipe from raw.createdAt', () => {
    expect(mercurySwipeAtIso({ createdAt: SWIPE }, POSTED)).toBe(SWIPE)
  })

  it('falls back to posted_at when createdAt is missing or unreadable', () => {
    expect(mercurySwipeAtIso({}, POSTED)).toBe(POSTED)
    expect(mercurySwipeAtIso({ createdAt: 'not a time' }, POSTED)).toBe(POSTED)
    expect(mercurySwipeAtIso({ createdAt: 42 }, POSTED)).toBe(POSTED)
    expect(mercurySwipeAtIso(null, POSTED)).toBe(POSTED)
  })

  it('is null when neither time reads', () => {
    expect(mercurySwipeAtIso(null, null)).toBeNull()
    expect(mercurySwipeAtIso({ createdAt: '' }, 'garbage')).toBeNull()
  })
})

describe('mercurySwipeDayYmd and mercuryPostedOnALaterDay', () => {
  it('puts the charge on the swipe day, and says when it posted on a later one', () => {
    expect(mercurySwipeDayYmd({ createdAt: SWIPE }, POSTED)).toBe('2026-09-15')
    expect(mercuryPostedOnALaterDay({ createdAt: SWIPE }, POSTED)).toBe(true)
  })

  it('a charge posted the same day, or with no swipe time, did not move', () => {
    expect(mercuryPostedOnALaterDay({ createdAt: SWIPE }, '2026-09-15T22:00:00Z')).toBe(false)
    expect(mercuryPostedOnALaterDay({}, POSTED)).toBe(false)
  })

  it('keeps an evening swipe on its own company day', () => {
    // 8:30 PM Chicago is 01:30 UTC the next morning.
    expect(mercurySwipeDayYmd({ createdAt: '2026-09-16T01:30:00Z' }, '2026-09-16T09:00:00Z')).toBe('2026-09-15')
  })
})

describe('isMercuryIsoInstant, the same test the database applies to purchased_at', () => {
  it('takes ISO instants with Z or an offset, with or without a fraction', () => {
    for (const ok of ['2026-09-15T14:17:00Z', '2026-09-15T14:17:00.390553Z', '2026-09-15T09:17:00-05:00', '2026-09-15T09:17:00-0500']) {
      expect(isMercuryIsoInstant(ok)).toBe(true)
    }
  })

  it('refuses words, dates without a time or zone, and days that do not exist', () => {
    for (const bad of ['yesterday', 'now', 'Sep 15 2026', '2026-09-15', '2026-09-15T14:17:00', '2026-02-30T10:00:00Z', '2026-09-15T25:00:00Z']) {
      expect(isMercuryIsoInstant(bad)).toBe(false)
    }
  })

  it('falls back to posted_at when createdAt fails it', () => {
    expect(mercurySwipeAtIso({ createdAt: '2026-02-30T10:00:00Z' }, POSTED)).toBe(POSTED)
    expect(mercurySwipeAtIso({ createdAt: 'Sep 15 2026' }, POSTED)).toBe(POSTED)
  })
})
