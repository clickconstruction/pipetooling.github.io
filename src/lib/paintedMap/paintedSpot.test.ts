import { describe, expect, it } from 'vitest'
import { SPOT_FRESH_MS, spotAgoWords, spotPhotoIsFresh, spotStaleWords, spotStart } from './paintedSpot'

const NOW = Date.UTC(2026, 10, 21, 18, 0, 0)
const MIN = 60_000
const HERE = { lat: 29.5, lng: -98.2, accuracyM: 6 }

describe('a photo is of where the person stands only while it is fresh', () => {
  it('takes a photo of this minute, and one five minutes old, for fresh', () => {
    expect(spotPhotoIsFresh(NOW, NOW)).toBe(true)
    expect(spotPhotoIsFresh(NOW - 90_000, NOW)).toBe(true)
    expect(spotPhotoIsFresh(NOW - SPOT_FRESH_MS, NOW)).toBe(true)
  })
  it('takes an older photo for one picked from the phone’s library', () => {
    expect(spotPhotoIsFresh(NOW - SPOT_FRESH_MS - 1, NOW)).toBe(false)
    expect(spotPhotoIsFresh(NOW - 6 * 60 * MIN, NOW)).toBe(false)
  })
  it('takes a file that does not say when it was made for the camera’s own', () => {
    expect(spotPhotoIsFresh(null, NOW)).toBe(true)
    expect(spotPhotoIsFresh(undefined, NOW)).toBe(true)
    expect(spotPhotoIsFresh(0, NOW)).toBe(true)
    expect(spotPhotoIsFresh(Number.NaN, NOW)).toBe(true)
  })
  it('does not trust a time well ahead of the clock', () => {
    expect(spotPhotoIsFresh(NOW + 2 * MIN, NOW)).toBe(true)
    expect(spotPhotoIsFresh(NOW + 60 * MIN, NOW)).toBe(false)
  })
})

describe('how old a photo is, in words', () => {
  it('says minutes, hours and days, each in the largest whole unit', () => {
    expect(spotAgoWords(NOW - 12 * MIN, NOW)).toBe('12 minutes ago')
    expect(spotAgoWords(NOW - 1 * MIN, NOW)).toBe('1 minute ago')
    expect(spotAgoWords(NOW - 20_000, NOW)).toBe('1 minute ago')
    expect(spotAgoWords(NOW - 60 * MIN, NOW)).toBe('1 hour ago')
    expect(spotAgoWords(NOW - 6 * 60 * MIN, NOW)).toBe('6 hours ago')
    expect(spotAgoWords(NOW - 26 * 60 * MIN, NOW)).toBe('1 day ago')
    expect(spotAgoWords(NOW - 3 * 24 * 60 * MIN, NOW)).toBe('3 days ago')
  })
  it('says why the dot was not put where the person stands', () => {
    expect(spotStaleWords(NOW - 6 * 60 * MIN, NOW)).toBe('This photo was taken 6 hours ago. You are not there now, so the dot was not put where you stand. Drag it onto the spot.')
    expect(spotStaleWords(NOW + 60 * MIN, NOW)).toBe('This photo’s time is ahead of this phone’s clock. The dot was not put where you stand. Drag it onto the spot.')
  })
})

describe('where the dot starts for a spot', () => {
  it('starts on a good reading, with its margin', () => {
    expect(spotStart({ ok: true, fix: HERE }, true)).toEqual({ kind: 'here', fix: HERE })
  })
  it('starts on a weak reading too: the phone knows about where it is, and the dot is dragged the rest of the way', () => {
    const weak = { ...HERE, accuracyM: 48 }
    expect(spotStart({ ok: true, fix: weak }, true)).toEqual({ kind: 'here', fix: weak })
  })
  it('starts on a reading with no margin, which said nothing against itself', () => {
    const bare = { ...HERE, accuracyM: null }
    expect(spotStart({ ok: true, fix: bare }, true)).toEqual({ kind: 'here', fix: bare })
  })
  it('moves no dot on a rough reading, which is an area and not a spot', () => {
    expect(spotStart({ ok: true, fix: { ...HERE, accuracyM: 3200 } }, true)).toEqual({ kind: 'rough', accuracyM: 3200 })
  })
  it('says why when no reading came', () => {
    expect(spotStart({ ok: false, why: 'refused' }, true)).toEqual({ kind: 'none', why: 'refused' })
    expect(spotStart({ ok: false, why: 'failed' }, true)).toEqual({ kind: 'none', why: 'failed' })
  })
  it('uses no reading at all for a photo that is not fresh, however good the reading', () => {
    expect(spotStart({ ok: true, fix: HERE }, false)).toEqual({ kind: 'stale' })
    expect(spotStart({ ok: false, why: 'refused' }, false)).toEqual({ kind: 'stale' })
  })
})

describe('the point a photo keeps (step 3)', () => {
  const HERE = { lat: 29.5, lng: -98.2, accuracyM: 6.4 }
  it('is the reading of a fresh photo, with the margin as a whole number of metres', async () => {
    const { takenPointOf } = await import('./paintedSpot')
    expect(takenPointOf({ ok: true, fix: HERE }, true)).toEqual({ lat: 29.5, lng: -98.2, accuracyM: 6 })
    expect(takenPointOf({ ok: true, fix: { ...HERE, accuracyM: null } }, true)).toEqual({ lat: 29.5, lng: -98.2, accuracyM: null })
  })
  it('is a weak reading too, since its margin says how weak', async () => {
    const { takenPointOf } = await import('./paintedSpot')
    expect(takenPointOf({ ok: true, fix: { ...HERE, accuracyM: 48 } }, true)).toEqual({ lat: 29.5, lng: -98.2, accuracyM: 48 })
  })
  it('is nothing for a rough reading, no reading, a reading that did not come in time, or a photo that is not of this moment', async () => {
    const { takenPointOf } = await import('./paintedSpot')
    expect(takenPointOf({ ok: true, fix: { ...HERE, accuracyM: 3200 } }, true)).toBeNull()
    expect(takenPointOf({ ok: false, why: 'refused' }, true)).toBeNull()
    expect(takenPointOf(null, true)).toBeNull()
    expect(takenPointOf({ ok: true, fix: HERE }, false)).toBeNull()
  })
  it('writes three columns for a point and none at all for no point', async () => {
    const { takenPointColumns } = await import('./paintedSpot')
    expect(takenPointColumns({ lat: 29.5, lng: -98.2, accuracyM: 6 })).toEqual({ taken_lat: 29.5, taken_lng: -98.2, taken_accuracy_m: 6 })
    expect(takenPointColumns({ lat: 29.5, lng: -98.2, accuracyM: null })).toEqual({ taken_lat: 29.5, taken_lng: -98.2, taken_accuracy_m: null })
    expect(takenPointColumns(null)).toEqual({})
    expect(takenPointColumns(undefined)).toEqual({})
    expect(takenPointColumns({ lat: Number.NaN, lng: -98.2, accuracyM: 6 })).toEqual({})
  })
  it('reads a stored row’s point back, and half a point as none', async () => {
    const { takenPointFromRow } = await import('./paintedSpot')
    expect(takenPointFromRow({ taken_lat: 29.5, taken_lng: -98.2, taken_accuracy_m: 6 })).toEqual({ lat: 29.5, lng: -98.2, accuracyM: 6 })
    expect(takenPointFromRow({ taken_lat: 29.5, taken_lng: null, taken_accuracy_m: 6 })).toBeNull()
    expect(takenPointFromRow({ taken_lat: null, taken_lng: null })).toBeNull()
    expect(takenPointFromRow(null)).toBeNull()
  })
})
