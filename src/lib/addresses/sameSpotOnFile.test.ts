import { describe, expect, it } from 'vitest'
import { addressesOnFile, type AddressRow } from './addressesOnFile'
import { mapPointKey, pairKeys, type MapPoint, type PlaceAnswer } from './lookAlikes'
import { SAME_SPOT_BOX_DEGREES, SAME_SPOT_WORDS, mayAnswerPlace, samePlaceOnFile, samePlaceSentence, sameSpotOnFile, sameSpotSentence } from './sameSpotOnFile'
import { normalizeAddressKey } from '../developments/notInIt'
import { plainWordsFailures } from '../plainWords'
import { plainSentence } from '../valuesInPlace'

const job = (id: string, address: string): AddressRow => ({ kind: 'job', id, address, developmentId: null, label: `J${id}` })
const bid = (id: string, address: string): AddressRow => ({ kind: 'bid', id, address, developmentId: null, label: `B${id}` })
const key = normalizeAddressKey

// Made-up addresses and made-up points. A degree of latitude is about 111 km, so a metre is 1 / 111,320 of one.
const AT = (lat: number, lng: number): MapPoint => ({ lat, lng })
const north = (base: MapPoint, metres: number): MapPoint => AT(base.lat + metres / 111_320, base.lng)
const CANYON = AT(32, -98)
const COVE = AT(34, -98)
const TOWN = AT(36, -98)
const HAMLET = AT(37, -98)

const ROWS: AddressRow[] = [
  job('1', '412 Sample Canyon Dr Building 20, Exampleville, TX'),
  job('2', '412 Sample Canyon Dr Building 20, Exampleville, TX'),
  job('3', '412 Sample Canyon Dr Building 20, Exampleville, TX'),
  job('4', '801 Magnolia Cove, Exampleville, TX'),
  bid('5', '805 Magnolia Cove, Exampleville, TX'),
  job('6', '10 First St, Sampleton, TX'),
  job('7', '20 Second St, Sampleton, TX'),
  job('8', '30 Third St, Sampleton, TX'),
  job('9', '900 Far Away Rd, Placeholder, TX'),
  job('10', '40 Fourth St, Sampleton, TX'),
  job('11', '1 Mill Rd, Hamlet, TX'),
  job('12', '2 Forge Rd, Hamlet, TX'),
  job('13', '3 Kiln Rd, Hamlet, TX'),
]
const LIST = addressesOnFile(ROWS, new Map())
const point = (address: string, p: MapPoint): [string, MapPoint] => [mapPointKey(address), p]
const POINTS = new Map<string, MapPoint>([
  point('412 Sample Canyon Dr Building 20, Exampleville, TX', CANYON),
  point('801 Magnolia Cove, Exampleville, TX', COVE),
  point('805 Magnolia Cove, Exampleville, TX', north(COVE, 25)),
  point('10 First St, Sampleton, TX', TOWN),
  point('20 Second St, Sampleton, TX', TOWN),
  point('30 Third St, Sampleton, TX', TOWN),
  point('40 Fourth St, Sampleton, TX', TOWN),
  point('1 Mill Rd, Hamlet, TX', HAMLET),
  point('2 Forge Rd, Hamlet, TX', HAMLET),
  point('3 Kiln Rd, Hamlet, TX', HAMLET),
])
const answer = (one: string, other: string, same: boolean): PlaceAnswer => ({ ...pairKeys(key(one), key(other)), same, byName: 'Cora Sample', at: '2026-11-24T15:00:00Z' })

const BUILDING_16 = '412 Sample Canyon Dr Building 16, Exampleville, TX'
const BARN = '14 Lone Barn Ln, Exampleville, TX'

describe('sameSpotOnFile', () => {
  it('asks about an address written alike at the same spot, and one within 75 m', () => {
    const at = sameSpotOnFile(LIST, BUILDING_16, CANYON, POINTS, [])
    expect(at.map((f) => [f.entry.address, f.meters])).toEqual([['412 Sample Canyon Dr Building 20, Exampleville, TX', 0]])
    expect(sameSpotOnFile(LIST, BUILDING_16, north(CANYON, 60), POINTS, []).map((f) => f.meters)).toEqual([60])
    expect(sameSpotOnFile(LIST, BUILDING_16, north(CANYON, 90), POINTS, [])).toEqual([])
  })

  it('asks about different words only within 40 m, the nearest first', () => {
    const found = sameSpotOnFile(LIST, BARN, north(COVE, 10), POINTS, [])
    expect(found.map((f) => [f.entry.address, f.meters])).toEqual([
      ['801 Magnolia Cove, Exampleville, TX', 10],
      ['805 Magnolia Cove, Exampleville, TX', 15],
    ])
    expect(sameSpotOnFile(LIST, BARN, north(COVE, -30), POINTS, []).map((f) => f.entry.address)).toEqual(['801 Magnolia Cove, Exampleville, TX'])
    expect(sameSpotOnFile(LIST, BARN, north(COVE, -50), POINTS, [])).toEqual([])
  })

  it('stays quiet for an address on file, one with no point, and a blank', () => {
    expect(sameSpotOnFile(LIST, '412 sample canyon drive building 20 exampleville tx', CANYON, POINTS, [])).toEqual([])
    expect(sameSpotOnFile(LIST, BUILDING_16, null, POINTS, [])).toEqual([])
    expect(sameSpotOnFile(LIST, BUILDING_16, AT(Number.NaN, -98), POINTS, [])).toEqual([])
    expect(sameSpotOnFile(LIST, '  ', CANYON, POINTS, [])).toEqual([])
    // An address on file with no point of its own is never asked about.
    expect(sameSpotOnFile(LIST, '902 Far Away Rd, Placeholder, TX', CANYON, new Map(), [])).toEqual([])
  })

  it('never asks at a point four or more addresses share, the typed one counted', () => {
    // Four on file share the town's centre: none of them is asked about, at the point or beside it.
    expect(sameSpotOnFile(LIST, '50 Fifth St, Sampleton, TX', TOWN, POINTS, [])).toEqual([])
    expect(sameSpotOnFile(LIST, '50 Fifth St, Sampleton, TX', north(TOWN, 5), POINTS, [])).toEqual([])
    // Three on file share a point, and the typed one makes four.
    expect(sameSpotOnFile(LIST, '4 Anvil Rd, Hamlet, TX', HAMLET, POINTS, [])).toEqual([])
    // Three sharing a point are not a pile by themselves: beside them, each is asked about.
    expect(sameSpotOnFile(LIST, '4 Anvil Rd, Hamlet, TX', north(HAMLET, 5), POINTS, []).map((f) => f.entry.address)).toEqual(['1 Mill Rd, Hamlet, TX', '2 Forge Rd, Hamlet, TX', '3 Kiln Rd, Hamlet, TX'])
  })

  it('asks once: an answered pair is left out, whichever way it was answered', () => {
    expect(sameSpotOnFile(LIST, BUILDING_16, CANYON, POINTS, [answer(BUILDING_16, '412 Sample Canyon Dr Building 20, Exampleville, TX', false)])).toEqual([])
    expect(sameSpotOnFile(LIST, BUILDING_16, CANYON, POINTS, [answer('412 Sample Canyon Dr Building 20, Exampleville, TX', BUILDING_16, true)])).toEqual([])
    // Not the same for the first neighbour leaves the second to ask.
    const next = sameSpotOnFile(LIST, BARN, north(COVE, 10), POINTS, [answer(BARN, '801 Magnolia Cove, Exampleville, TX', false)])
    expect(next.map((f) => f.entry.address)).toEqual(['805 Magnolia Cove, Exampleville, TX'])
  })

  it('leaves out an address the answers already join to the typed one, and one the form asked about another way', () => {
    const chain = [answer(BARN, '801 Magnolia Cove, Exampleville, TX', true), answer('801 Magnolia Cove, Exampleville, TX', '805 Magnolia Cove, Exampleville, TX', true)]
    expect(sameSpotOnFile(LIST, BARN, north(COVE, 10), POINTS, chain)).toEqual([])
    const skipped = sameSpotOnFile(LIST, BARN, north(COVE, 10), POINTS, [], new Set([key('801 Magnolia Cove, Exampleville, TX')]))
    expect(skipped.map((f) => f.entry.address)).toEqual(['805 Magnolia Cove, Exampleville, TX'])
  })

  it('reads a box that holds every point within the longer reach', () => {
    // 75 m north to south is under a thousandth of a degree, and so is 75 m east to west at 36° north.
    expect(75 / 111_320).toBeLessThan(SAME_SPOT_BOX_DEGREES)
    expect(75 / (111_320 * Math.cos((36 * Math.PI) / 180))).toBeLessThan(SAME_SPOT_BOX_DEGREES)
  })
})

describe('samePlaceOnFile', () => {
  it('names the addresses on file the answers make one place with the typed one, the busiest first', () => {
    const answers = [answer(BARN, '805 Magnolia Cove, Exampleville, TX', true), answer(BARN, '412 Sample Canyon Dr Building 20, Exampleville, TX', true), answer(BARN, '801 Magnolia Cove, Exampleville, TX', false)]
    expect(samePlaceOnFile(LIST, BARN, answers).map((a) => a.address)).toEqual(['412 Sample Canyon Dr Building 20, Exampleville, TX', '805 Magnolia Cove, Exampleville, TX'])
    expect(samePlaceOnFile(LIST, BARN, [])).toEqual([])
    expect(samePlaceOnFile(LIST, '801 Magnolia Cove, Exampleville, TX', answers)).toEqual([])
  })
})

describe('the words', () => {
  const canyon = sameSpotOnFile(LIST, BUILDING_16, CANYON, POINTS, [])[0]!
  const cove = sameSpotOnFile(LIST, BARN, north(COVE, 30), POINTS, [])[0]!

  it('says how many are on file, where, and as what', () => {
    expect(plainSentence(sameSpotSentence(canyon))).toBe('3 jobs are on file at this spot as 412 Sample Canyon Dr Building 20, Exampleville, TX.')
    expect(plainSentence(sameSpotSentence(cove))).toBe('1 bid is on file 5 m from here as 805 Magnolia Cove, Exampleville, TX.')
    expect(sameSpotSentence(canyon)).toContain('412 Sample Canyon Dr Building 20, Exampleville, TX')
  })

  it('says the quiet line after Same place, keep mine', () => {
    expect(plainSentence(samePlaceSentence(canyon.entry))).toBe('Kept as the same place as 412 Sample Canyon Dr Building 20, Exampleville, TX. 3 jobs are there.')
    expect(plainSentence(samePlaceSentence(cove.entry))).toBe('Kept as the same place as 805 Magnolia Cove, Exampleville, TX. 1 bid is there.')
  })

  it('passes the plain-words rules', () => {
    for (const line of [SAME_SPOT_WORDS.title, SAME_SPOT_WORDS.foot, plainSentence(sameSpotSentence(canyon)), plainSentence(samePlaceSentence(canyon.entry))]) {
      expect(plainWordsFailures(line), line).toEqual([])
    }
  })

  it('asks only the office, whose answer the table keeps', () => {
    expect(['dev', 'master_technician', 'assistant', 'controller'].every(mayAnswerPlace)).toBe(true)
    expect(['estimator', 'subcontractor', 'primary', '', null, undefined].some(mayAnswerPlace)).toBe(false)
  })
})
