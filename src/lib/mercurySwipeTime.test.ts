import { describe, expect, it } from 'vitest'
import { isMercuryIsoInstant, mercuryChargeAtIso, mercuryChargeDayPhrase, mercuryChargeDayYmd, mercuryPostedOnALaterDay, mercurySwipeAtIso, mercurySwipeDayYmd } from './mercurySwipeTime'

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

describe('mercuryChargeAtIso, mercuryChargeDayYmd and mercuryChargeDayPhrase', () => {
  const TODAY = '2026-10-23' // a Friday

  it('reads the swipe from raw.createdAt first', () => {
    expect(mercuryChargeAtIso({ raw: { createdAt: SWIPE }, created_at: POSTED, posted_at: POSTED })).toBe(SWIPE)
  })

  it('falls back to the row created_at for a synced row read without raw, before posted_at', () => {
    expect(mercuryChargeAtIso({ raw: null, created_at: SWIPE, posted_at: POSTED })).toBe(SWIPE)
    expect(mercuryChargeAtIso({ raw: null, created_at: SWIPE, posted_at: null })).toBe(SWIPE)
    expect(mercuryChargeAtIso({ raw: null, created_at: 'garbage', posted_at: POSTED })).toBe(POSTED)
  })

  it('reads posted_at first for a manual row, whose created_at is the upload', () => {
    expect(mercuryChargeAtIso({ raw: null, created_at: '2026-10-23T15:00:00Z', posted_at: '2026-10-01T12:00:00Z', source: 'manual' })).toBe('2026-10-01T12:00:00Z')
    expect(mercuryChargeAtIso({ raw: null, created_at: '2026-10-23T15:00:00Z', posted_at: null, source: 'manual' })).toBe('2026-10-23T15:00:00Z')
  })

  it('is null when nothing reads', () => {
    expect(mercuryChargeAtIso({ raw: null, created_at: null, posted_at: null })).toBeNull()
    expect(mercuryChargeDayPhrase({ raw: {}, created_at: '', posted_at: undefined }, TODAY)).toBeNull()
  })

  it('keeps a charge at 11 PM Central on a Tuesday on Tuesday, not Wednesday', () => {
    // 11:00 PM CDT Tuesday 2026-10-20 is 04:00 UTC Wednesday.
    const tx = { raw: { createdAt: '2026-10-21T04:00:00.000Z' }, created_at: '2026-10-21T04:00:00.000Z', posted_at: null }
    expect(mercuryChargeDayYmd(tx)).toBe('2026-10-20')
    expect(mercuryChargeDayPhrase(tx, TODAY)).toBe('Tuesday · 3 days ago (10/20/26)')
  })

  it('writes Today and Yesterday for the newest charges', () => {
    expect(mercuryChargeDayPhrase({ raw: { createdAt: '2026-10-23T16:10:00Z' }, created_at: '2026-10-23T16:10:00Z', posted_at: null }, TODAY)).toBe('Today (10/23/26)')
    expect(mercuryChargeDayPhrase({ raw: null, created_at: '2026-10-22T20:00:00Z', posted_at: null }, TODAY)).toBe('Yesterday (10/22/26)')
  })

  it('keeps the swipe day when the charge posted on a later day', () => {
    expect(mercuryChargeDayPhrase({ raw: { createdAt: SWIPE }, created_at: SWIPE, posted_at: POSTED }, '2026-09-23')).toBe('Tuesday · 8 days ago (9/15/26)')
  })
})
