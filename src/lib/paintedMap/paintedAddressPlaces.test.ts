import { describe, expect, it } from 'vitest'
import { addressListFromWords, addressListLineWords, addressListsOf, listMonthWords, placeRowsMoreWords, placeRowsShown } from './paintedAddressPlaces'
import type { PaintedMap, PaintedPlace } from './paintedMap'

const map = (id: string, jobId: string | null, jobList: boolean, createdAt: string): PaintedMap => ({ id, name: jobList ? 'Places on this job' : 'The way in', words: '', jobId, developmentId: null, jobList, createdBy: 'u1', createdAt })
const place = (id: string, mapId: string, name: string, setAt: string): PaintedPlace => ({ id, mapId, name, words: '', lat: 29.5, lng: -98.2, accuracyM: null, photoPath: null, kind: null, setBy: 'u1', setAt })

describe('a list’s month', () => {
  it('says the month and the year, in UTC', () => {
    expect(listMonthWords('2026-11-21T15:00:00Z')).toBe('Nov 2026')
    expect(listMonthWords('2026-12-01T00:30:00Z')).toBe('Dec 2026')
    expect(listMonthWords('2027-01-01T05:59:00-06:00')).toBe('Jan 2027')
  })
  it('says nothing for a stamp that is not one', () => {
    expect(listMonthWords('')).toBe('')
    expect(listMonthWords(null)).toBe('')
    expect(listMonthWords('soon')).toBe('')
  })
})

describe('where a list came from, in words', () => {
  it('names the job when the reader may read it', () => {
    expect(addressListFromWords({ createdAt: '2026-11-21T15:00:00Z', jobLabel: 'Sewer line replacement' })).toBe('from Sewer line replacement, Nov 2026')
  })
  it('says the month alone for a reader who cannot read the ledger', () => {
    expect(addressListFromWords({ createdAt: '2026-11-21T15:00:00Z', jobLabel: null })).toBe('kept Nov 2026')
    expect(addressListFromWords({ createdAt: '2026-11-21T15:00:00Z', jobLabel: '  ' })).toBe('kept Nov 2026')
  })
  it('still says something with no stamp to read', () => {
    expect(addressListFromWords({ createdAt: '', jobLabel: 'Sewer line replacement' })).toBe('from Sewer line replacement')
    expect(addressListFromWords({ createdAt: '', jobLabel: null })).toBe('kept by an earlier job')
  })
  it('counts the places on the line’s right end', () => {
    expect(addressListLineWords({ places: [1, 2, 3], map: { createdAt: '2026-11-21T15:00:00Z' }, jobLabel: 'Sewer line replacement' })).toBe('3 places · from Sewer line replacement, Nov 2026')
    expect(addressListLineWords({ places: [1], map: { createdAt: '2026-11-21T15:00:00Z' }, jobLabel: null })).toBe('1 place · kept Nov 2026')
  })
})

describe('the lists a job reads from earlier jobs at its address', () => {
  const wholes = [
    { map: map('newer', 'j3', true, '2027-03-02T15:00:00Z'), places: [place('n1', 'newer', 'Backflow', '2027-03-02T15:01:00Z')] },
    { map: map('older', 'j1', true, '2026-11-21T15:00:00Z'), places: [place('o2', 'older', 'Cleanout', '2026-11-21T15:02:00Z'), place('o1', 'older', 'Meter', '2026-11-21T15:01:00Z')] },
    { map: map('way', 'j1', false, '2026-11-21T15:05:00Z'), places: [place('w1', 'way', 'Truck gate', '2026-11-21T15:06:00Z')] },
    { map: map('mine', 'j2', true, '2027-10-19T15:00:00Z'), places: [place('m1', 'mine', 'Mine', '2027-10-19T15:01:00Z')] },
    { map: map('empty', 'j4', true, '2026-01-01T15:00:00Z'), places: [] },
  ]
  const lists = addressListsOf(wholes, 'j2', new Map([['j1', '4135 Sewer line at the house']]))

  it('keeps the lists of other jobs, the oldest first, and leaves out a painted map, this job’s own list and an empty one', () => {
    expect(lists.map((l) => l.map.id)).toEqual(['older', 'newer'])
  })
  it('names the job that kept a list when it can', () => {
    expect(lists.map((l) => l.jobLabel)).toEqual(['4135 Sewer line at the house', null])
  })
  it('gives each place the letter it wears on its own list, in the order it was set', () => {
    expect(lists[0]!.places.map((p) => `${p.letter} ${p.name}`)).toEqual(['A Meter', 'B Cleanout'])
    expect(lists[1]!.places.map((p) => `${p.letter} ${p.name}`)).toEqual(['A Backflow'])
  })
})

describe('the rows a job’s window draws for a list', () => {
  it('draws them all when they fit', () => {
    expect(placeRowsShown([1, 2, 3, 4])).toEqual({ shown: [1, 2, 3, 4], more: 0 })
  })
  it('draws the first four and counts the rest', () => {
    expect(placeRowsShown([1, 2, 3, 4, 5, 6, 7])).toEqual({ shown: [1, 2, 3, 4], more: 3 })
    expect(placeRowsMoreWords(3)).toBe('＋ 3 more ›')
  })
})
