import { describe, expect, it } from 'vitest'
import { addressesOnFile, type AddressRow } from './addressesOnFile'
import {
  LOOK_ALIKE_WORDS,
  answeredWords,
  apartWords,
  groupTabWords,
  lookAlikeCountsSentence,
  lookAlikes,
  mapPointKey,
  metersBetween,
  pairId,
  pairKeys,
  samePlaceKeys,
  writtenAlike,
  type MapPoint,
  type PlaceAnswer,
} from './lookAlikes'
import { normalizeAddressKey } from '../developments/notInIt'
import { plainWordsFailures } from '../plainWords'
import { plainSentence } from '../valuesInPlace'

const job = (id: string, address: string): AddressRow => ({ kind: 'job', id, address, developmentId: null, label: `J${id}` })
const key = normalizeAddressKey

// Made-up addresses and made-up points. A degree of latitude is about 111 km, so 0.00001 is about a metre.
const AT = (lat: number, lng: number): MapPoint => ({ lat, lng })
const BASE = AT(30, -98)
const near = (metres: number): MapPoint => AT(30 + metres / 111_320, -98)

const ROWS: AddressRow[] = [
  job('1', '115 E Sample St, Exampleville, TX'),
  job('2', '115 E Sampel St, Exampleville, TX'),
  job('3', '11704 FM 1117, Placeholder, TX'),
  job('4', '11704 FM1117, Placeholder, TX'),
  job('5', '412 Sample Canyon Dr Building 16, Exampleville, TX'),
  job('6', '412 Sample Canyon Dr Building 20, Exampleville, TX'),
  job('7', '7400 San Sample Ave, Placeholder, TX'),
  job('8', '7400 San Sampel Ave, Placeholder, TX'),
  job('9', '801 Magnolia Cove, Exampleville, TX'),
  job('10', '803 Juniper Way, Exampleville, TX'),
  job('11', 'Old Quarry Trail, Sampleton, TX'),
  job('12', 'Old Quarry Trail, Sampleton, TX'),
  job('13', '50 Lone Oak Rd, Placeholder, TX'),
]
const LIST = addressesOnFile(ROWS, new Map())
const point = (address: string, p: MapPoint): [string, MapPoint] => [mapPointKey(address), p]
const POINTS = new Map<string, MapPoint>([
  point('115 E Sample St, Exampleville, TX', BASE),
  point('115 E Sampel St, Exampleville, TX', near(0)),
  point('11704 FM 1117, Placeholder, TX', AT(31, -98)),
  point('11704 FM1117, Placeholder, TX', AT(31, -98)),
  point('412 Sample Canyon Dr Building 16, Exampleville, TX', AT(32, -98)),
  point('412 Sample Canyon Dr Building 20, Exampleville, TX', AT(32 + 60 / 111_320, -98)),
  point('7400 San Sample Ave, Placeholder, TX', AT(33, -98)),
  point('7400 San Sampel Ave, Placeholder, TX', AT(33 + 400 / 111_320, -98)),
  point('801 Magnolia Cove, Exampleville, TX', AT(34, -98)),
  point('803 Juniper Way, Exampleville, TX', AT(34 + 20 / 111_320, -98)),
  point('50 Lone Oak Rd, Placeholder, TX', AT(35, -98)),
])

describe('writtenAlike', () => {
  it('is true for a letter off, a moved space and a unit after the street', () => {
    expect(writtenAlike(key('115 E Sample St'), key('115 E Sampel St'))).toBe(true)
    expect(writtenAlike(key('11704 FM 1117'), key('11704 FM1117'))).toBe(true)
    expect(writtenAlike(key('8217 Placeholder Creek Blvd'), key('8217 Placeholder Creek Blvd 201'))).toBe(true)
    expect(writtenAlike(key('412 Sample Canyon Dr Building 16'), key('412 Sample Canyon Dr Building 20'))).toBe(true)
  })

  it('is false for another house number, another street, a different road number, and the same key', () => {
    expect(writtenAlike(key('115 E Sample St'), key('117 E Sample St'))).toBe(false)
    expect(writtenAlike(key('115 Elm Grove Ct'), key('115 Oak Hollow Ct'))).toBe(false)
    expect(writtenAlike(key('9150 FM 1101'), key('9150 FM 1102'))).toBe(false)
    expect(writtenAlike(key('5 A St'), key('5 A Street'))).toBe(false)
    expect(writtenAlike(key('Old Quarry Trl'), key('Old Quary Trl'))).toBe(false)
  })
})

describe('lookAlikes', () => {
  const found = lookAlikes(LIST, POINTS, [])
  const groupOf = (a: string, b: string) => found.pairs.find((p) => p.id === pairId(key(a), key(b)))?.group

  it('puts a pair written alike at one spot in the first group', () => {
    expect(groupOf('115 E Sample St, Exampleville, TX', '115 E Sampel St, Exampleville, TX')).toBe('alikeSameSpot')
    expect(groupOf('11704 FM 1117, Placeholder, TX', '11704 FM1117, Placeholder, TX')).toBe('alikeSameSpot')
    // Two buildings sixty metres apart are still within one site's reach.
    expect(groupOf('412 Sample Canyon Dr Building 16, Exampleville, TX', '412 Sample Canyon Dr Building 20, Exampleville, TX')).toBe('alikeSameSpot')
  })

  it('puts a pair written alike that the map holds apart in the second group', () => {
    expect(groupOf('7400 San Sample Ave, Placeholder, TX', '7400 San Sampel Ave, Placeholder, TX')).toBe('alikeApart')
  })

  it('puts different words within forty metres in the third group', () => {
    expect(groupOf('801 Magnolia Cove, Exampleville, TX', '803 Juniper Way, Exampleville, TX')).toBe('sameSpot')
  })

  it('counts what is still to answer, by group', () => {
    expect(found.toLook).toBe(5)
    expect(found.answered).toBe(0)
    expect(found.byGroup).toEqual({ alikeSameSpot: 3, alikeApart: 1, sameSpot: 1 })
  })

  it('lists an address with no house number apart, and pairs it with nothing by its words', () => {
    expect(found.noNumber.map((a) => a.address)).toEqual(['Old Quarry Trail, Sampleton, TX'])
    expect(found.noNumber[0]?.jobs).toBe(2)
    expect(found.pairs.some((p) => p.a.key === key('Old Quarry Trail, Sampleton, TX') || p.b.key === key('Old Quarry Trail, Sampleton, TX'))).toBe(false)
  })

  it('orders the likeliest first: the first group, then the nearest', () => {
    expect(found.pairs[0]?.group).toBe('alikeSameSpot')
    expect(found.pairs[0]?.meters).toBe(0)
    expect(found.pairs[found.pairs.length - 1]?.group).toBe('sameSpot')
  })

  it('leads a pair with the busier address, so the odd spelling is read against the one people know', () => {
    const typo = found.pairs.find((p) => p.id === pairId(key('7400 San Sample Ave, Placeholder, TX'), key('7400 San Sampel Ave, Placeholder, TX')))
    // One job each: the smaller key leads.
    expect(typo?.a.address).toBe('7400 San Sampel Ave, Placeholder, TX')
    const rows = [job('a', '9 Maple Ridge Rd'), job('b', '9 Maple Ridge Rd'), job('c', '9 Maple Rigde Rd')]
    const out = lookAlikes(addressesOnFile(rows, new Map()), new Map(), [])
    expect(out.pairs[0]?.a.address).toBe('9 Maple Ridge Rd')
    expect(out.pairs[0]?.b.address).toBe('9 Maple Rigde Rd')
  })

  it('with no map point, a pair written alike still shows, as one to look at', () => {
    const blind = lookAlikes(LIST, new Map(), [])
    expect(blind.byGroup).toEqual({ alikeSameSpot: 0, alikeApart: 4, sameSpot: 0 })
    expect(blind.pairs[0]?.meters).toBeNull()
  })

  it('leaves out a point that four addresses share, so a town centre pairs nothing', () => {
    const rows = ['1 Ash Ln', '2 Birch Ln', '3 Cedar Ln', '4 Dogwood Ln'].map((a, i) => job(String(i), `${a}, Sampleton, TX`))
    const list = addressesOnFile(rows, new Map())
    const points = new Map(rows.map((r) => point(r.address ?? '', BASE)))
    expect(lookAlikes(list, points, []).pairs).toEqual([])
    // Three at one point are a real building or a real lot: they do pair.
    const three = addressesOnFile(rows.slice(0, 3), new Map())
    expect(lookAlikes(three, new Map(rows.slice(0, 3).map((r) => point(r.address ?? '', BASE))), []).pairs.length).toBe(3)
  })

  it('uses whichever spelling of an address the map has a point for', () => {
    const rows = [job('a', '90 Example Ridge Rd, Placeholder, TX'), job('b', '90 Example Ridge Road, Placeholder, TX'), job('c', '90 Example Rigde Rd, Placeholder, TX')]
    const list = addressesOnFile(rows, new Map())
    const points = new Map([point('90 Example Ridge Road, Placeholder, TX', BASE), point('90 Example Rigde Rd, Placeholder, TX', near(3))])
    const out = lookAlikes(list, points, [])
    expect(out.pairs.length).toBe(1)
    expect(out.pairs[0]?.group).toBe('alikeSameSpot')
    expect(out.pairs[0]?.meters).toBe(3)
  })

  it('carries an answer onto its pair, and moves it under the ones still to answer', () => {
    const answers: PlaceAnswer[] = [{ ...pairKeys(key('115 E Sample St, Exampleville, TX'), key('115 E Sampel St, Exampleville, TX')), same: true, byName: 'Cora Sample', at: '2026-11-24T18:00:00Z' }]
    const out = lookAlikes(LIST, POINTS, answers)
    expect(out.toLook).toBe(4)
    expect(out.answered).toBe(1)
    expect(out.byGroup.alikeSameSpot).toBe(2)
    expect(out.pairs[out.pairs.length - 1]?.answer?.byName).toBe('Cora Sample')
  })
})

describe('samePlaceKeys', () => {
  const answers: PlaceAnswer[] = [
    { keyA: 'a', keyB: 'b', same: true, byName: '', at: '' },
    { keyA: 'b', keyB: 'c', same: true, byName: '', at: '' },
    { keyA: 'c', keyB: 'd', same: false, byName: '', at: '' },
    { keyA: 'x', keyB: 'y', same: true, byName: '', at: '' },
  ]

  it('joins through a chain of Same place, and stops at Not the same', () => {
    expect([...samePlaceKeys('a', answers)].sort()).toEqual(['a', 'b', 'c'])
    expect([...samePlaceKeys('c', answers)].sort()).toEqual(['a', 'b', 'c'])
    expect([...samePlaceKeys('d', answers)]).toEqual(['d'])
    expect([...samePlaceKeys('y', answers)].sort()).toEqual(['x', 'y'])
  })

  it('is the key alone with no answers', () => {
    expect([...samePlaceKeys('a', [])]).toEqual(['a'])
  })
})

describe('the small words', () => {
  it('orders a pair one way whichever way it is asked', () => {
    expect(pairKeys('b', 'a')).toEqual({ keyA: 'a', keyB: 'b' })
    expect(pairId('b', 'a')).toBe(pairId('a', 'b'))
  })

  it('measures metres', () => {
    expect(Math.round(metersBetween(BASE, near(100)))).toBe(100)
    expect(metersBetween(BASE, BASE)).toBe(0)
  })

  it('says how far apart', () => {
    expect(apartWords(null)).toBe('')
    expect(apartWords(0)).toBe('same spot')
    expect(apartWords(4)).toBe('4 m apart')
    expect(apartWords(1234)).toBe('1.2 km apart')
  })

  it('names a tab with its count, and an answered row with who and when', () => {
    expect(groupTabWords('alikeSameSpot', 26)).toBe('Written alike, same spot on the map · 26')
    expect(answeredWords({ keyA: 'a', keyB: 'b', same: true, byName: 'Cora Sample', at: '' }, 'Nov 24')).toBe('Same place · Cora Sample, Nov 24')
    expect(answeredWords({ keyA: 'a', keyB: 'b', same: false, byName: '', at: '' }, '')).toBe('Not the same')
  })

  it('says the counts over the tabs', () => {
    expect(plainSentence(lookAlikeCountsSentence({ toLook: 5, answered: 1 }))).toBe('5 pairs to look at. 1 answered.')
    expect(plainSentence(lookAlikeCountsSentence({ toLook: 1, answered: 0 }))).toBe('1 pair to look at. 0 answered.')
  })

  it('passes the plain-words rules', () => {
    for (const line of [LOOK_ALIKE_WORDS.lead, LOOK_ALIKE_WORDS.foot, LOOK_ALIKE_WORDS.nothing]) expect(plainWordsFailures(line), line).toEqual([])
  })
})
