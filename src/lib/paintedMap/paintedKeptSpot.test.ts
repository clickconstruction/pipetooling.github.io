import { describe, expect, it } from 'vitest'
import { KEPT_SPOT_MAX_AGE_MS, alreadyThere, keptSpotFrom, keptSpotPhotoIds, keptSpotsFromJson, keptSpotsWords, saveLostSignal, type KeptSpot } from './paintedKeptSpot'

const NOW = Date.UTC(2026, 10, 21, 18, 0, 0)
const spot = (over: Partial<KeptSpot> = {}): KeptSpot => ({
  id: 'p1',
  userId: 'u1',
  savedAtMs: NOW - 60_000,
  map: { id: 'm1', jobId: 'j1', developmentId: null, name: 'Places on this job', words: '', jobList: true, saved: false },
  place: { name: 'Cleanout', words: '4 ft off the front walk.', kind: 'cleanout', lat: 29.5, lng: -98.2, accuracyM: 6 },
  photoId: 'ph1',
  moreIds: ['ph2'],
  ...over,
})

describe('a kept place, read back', () => {
  it('reads a whole record as it was written', () => {
    expect(keptSpotFrom(JSON.parse(JSON.stringify(spot())))).toEqual(spot())
  })
  it('reads a place with no photo, no kind and no margin', () => {
    const bare = spot({ photoId: null, moreIds: [], place: { name: 'Meter', words: '', kind: null, lat: 29.5, lng: -98.2, accuracyM: null } })
    expect(keptSpotFrom(JSON.parse(JSON.stringify(bare)))).toEqual(bare)
  })
  it('takes anything that is not whole for nothing: a mangled record is never sent', () => {
    expect(keptSpotFrom(null)).toBeNull()
    expect(keptSpotFrom('p1')).toBeNull()
    expect(keptSpotFrom({ ...spot(), id: '' })).toBeNull()
    expect(keptSpotFrom({ ...spot(), map: null })).toBeNull()
    expect(keptSpotFrom({ ...spot(), place: { ...spot().place, lat: 'north' } })).toBeNull()
    expect(keptSpotFrom({ ...spot(), place: { ...spot().place, lat: 91 } })).toBeNull()
    expect(keptSpotFrom({ ...spot(), place: { ...spot().place, name: '' } })).toBeNull()
  })
})

describe('what a phone holds', () => {
  it('gives this person’s places, the oldest first', () => {
    const raw = JSON.stringify([spot({ id: 'new', savedAtMs: NOW - 1000 }), spot({ id: 'old', savedAtMs: NOW - 5000 }), spot({ id: 'theirs', userId: 'u2' }), 'junk'])
    expect(keptSpotsFromJson(raw, 'u1', NOW).waiting.map((s) => s.id)).toEqual(['old', 'new'])
  })
  it('sets a place more than seven days old apart, to be dropped with its bytes', () => {
    const raw = JSON.stringify([spot({ id: 'fresh' }), spot({ id: 'stale', savedAtMs: NOW - KEPT_SPOT_MAX_AGE_MS - 1 })])
    const read = keptSpotsFromJson(raw, 'u1', NOW)
    expect(read.waiting.map((s) => s.id)).toEqual(['fresh'])
    expect(read.expired.map((s) => s.id)).toEqual(['stale'])
  })
  it('reads nothing, and a mangled store, as no places', () => {
    expect(keptSpotsFromJson(null, 'u1', NOW)).toEqual({ waiting: [], expired: [] })
    expect(keptSpotsFromJson('{not json', 'u1', NOW)).toEqual({ waiting: [], expired: [] })
    expect(keptSpotsFromJson('{"a":1}', 'u1', NOW)).toEqual({ waiting: [], expired: [] })
  })
  it('lists every photo id a place holds bytes under', () => {
    expect(keptSpotPhotoIds(spot())).toEqual(['ph1', 'ph2'])
    expect(keptSpotPhotoIds(spot({ photoId: null, moreIds: [] }))).toEqual([])
  })
})

describe('the words', () => {
  it('says how many wait and what happens next', () => {
    expect(keptSpotsWords(1)).toBe('1 place waits on this phone. It goes to the job when the signal is back.')
    expect(keptSpotsWords(3)).toBe('3 places wait on this phone. They go to the job when the signal is back.')
  })
})

describe('telling a lost signal from a refusal', () => {
  it('takes an offline phone for a lost signal, whatever the error says', () => {
    expect(saveLostSignal('The place did not save.', false)).toBe(true)
    expect(saveLostSignal(null, false)).toBe(true)
  })
  it('takes a fetch that reached nothing for a lost signal', () => {
    expect(saveLostSignal('TypeError: Failed to fetch', true)).toBe(true)
    expect(saveLostSignal('Load failed', true)).toBe(true)
    expect(saveLostSignal('NetworkError when attempting to fetch resource.', true)).toBe(true)
  })
  it('does not take a refusal for one: it would be refused again', () => {
    expect(saveLostSignal('new row violates row-level security policy for table "painted_map_places"', true)).toBe(false)
    expect(saveLostSignal('A training account cannot change this.', true)).toBe(false)
    expect(saveLostSignal(null, true)).toBe(false)
  })
  it('takes a row or bytes already there for a success whose answer was lost', () => {
    expect(alreadyThere('duplicate key value violates unique constraint "painted_map_places_pkey"')).toBe(true)
    expect(alreadyThere('The resource already exists')).toBe(true)
    expect(alreadyThere('new row violates row-level security policy')).toBe(false)
    expect(alreadyThere(null)).toBe(false)
  })
})
