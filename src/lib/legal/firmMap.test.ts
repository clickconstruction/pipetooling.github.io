import { describe, expect, it } from 'vitest'
import { bridgeFirmOf, bridgeMapWords, caseNote, caseStand, casesInCounty, countyCardFacts, effectiveStand, legendCounts, lensSummaryWords, shapeMapCases, uncoveredCounties, uncoveredWords, type MapAccount } from './firmMap'

const acc = (key: string, name: string, balance: number, jobs: MapAccount['jobs'], viaGc = false): MapAccount => ({ key, name, balance, viaGc, jobs })

const ACCOUNTS = [
  acc('c:tle', 'The Learning Experience', 15781.82, [
    { id: 'j707', click_number: 707, job_address: '12400 Hwy 71 W, Bee Cave, TX' },
    { id: 'j717', click_number: 717, job_address: '12400 Hwy 71 W, Bee Cave, TX' },
  ]),
  acc('c:burd', 'Burd & Assoc.', 2028.04, [{ id: 'j891', hcp_number: '891', job_address: '11730 TX-29, Liberty Hill, TX', customer_address_id: 'addr-burd' }]),
  acc('c:rmc', 'RMC- Dudley Mason', 1712.5, [{ id: 'j790', click_number: 790, job_address: '628 Terrell Rd, San Antonio, TX' }], true),
  acc('c:closed', 'Closed Co', 999, [{ id: 'j1', click_number: 1, job_address: '1 Main St, Austin, TX' }]),
]
const GIVEN_UP = [acc('c:hall', 'Bruce Hall', 350, [{ id: 'j838', click_number: 838, job_address: '100 Oak, Seguin, TX' }])]
const MATTERS = new Map([
  ['c:tle', { stage: 'referred', closed_at: null, firm_id: 'firm-a', released_at: '2026-10-06T15:00:00Z' }],
  ['c:closed', { stage: 'settled', closed_at: '2026-10-01T00:00:00Z', firm_id: 'firm-a', released_at: '2026-09-01T00:00:00Z' }],
])
const COORDS = new Map([
  ['12400 hwy 71 w, bee cave, tx', { lat: 30.3169, lng: -97.9786 }],
  ['11730 tx-29, liberty hill, tx', { lat: 30.6583, lng: -97.8876 }],
  ['628 terrell rd, san antonio, tx', { lat: 29.4711, lng: -98.4454 }],
])
const countyOf = (lng: number, lat: number) => (lat > 30.5 ? 'Williamson' : lat > 30 ? 'Travis' : lng < -98.3 ? 'Bexar' : 'Guadalupe')
const FIRMS = [
  { id: 'firm-a', name: 'Snell Law Firm' },
  { id: 'firm-b', name: 'Austin firm' },
]
const FIRM_NAMES = new Map(FIRMS.map((f) => [f.id, f.name]))

const cases = shapeMapCases({ accounts: ACCOUNTS, givenUp: GIVEN_UP, byPayerKey: MATTERS, firmNames: FIRM_NAMES, coords: COORDS, recordCounty: new Map([['addr-burd', 'Williamson']]), countyOf })

describe('shapeMapCases', () => {
  it('places each account at its first job, the county from the record else the point, largest first, closed matters off the map', () => {
    expect(cases.map((c) => c.name)).toEqual(['The Learning Experience', 'Burd & Assoc.', 'RMC- Dudley Mason', 'Bruce Hall'])
    const tle = cases[0]!
    expect(tle).toMatchObject({ id: 'c:tle|live', key: 'c:tle', jobLabels: '707 · 717', jobCount: 2, stand: 'firm', note: 'with Snell Law Firm since 10/06', county: 'Travis', countyFrom: 'point', lat: 30.3169 })
    expect(cases[1]).toMatchObject({ stand: 'eyes', note: 'needs a dev’s eyes', county: 'Williamson', countyFrom: 'record', jobLabels: '891' })
    expect(cases[2]).toMatchObject({ stand: 'eyes', county: 'Bexar', viaGc: true })
    expect(cases[3]).toMatchObject({ id: 'c:hall|gave', stand: 'gave', note: 'given up on', lat: null, county: null, countyFrom: null })
  })
  it('stands: the job flag wins, then the matter', () => {
    expect(caseStand(null, true)).toBe('gave')
    expect(caseStand({ stage: 'referred', closed_at: null }, true)).toBe('gave')
    expect(caseStand({ stage: 'suit', closed_at: null }, false)).toBe('firm')
    expect(caseStand({ stage: 'review', closed_at: null }, false)).toBe('eyes')
    expect(caseStand({ stage: 'written_down', closed_at: null }, false)).toBe('closed')
    expect(caseStand(null, false)).toBe('eyes')
    expect(caseNote('firm', null, null)).toBe('with the firm')
  })
})

describe('against the county map', () => {
  const assignments = new Map([
    ['Travis', 'firm-b'],
    ['Bexar', 'firm-a'],
  ])
  it('a case not with the firm in an uncovered county is none', () => {
    expect(effectiveStand(cases[0]!, assignments)).toBe('firm')
    expect(effectiveStand(cases[1]!, assignments)).toBe('none')
    expect(effectiveStand(cases[2]!, assignments)).toBe('eyes')
    expect(effectiveStand(cases[3]!, assignments)).toBe('none')
  })
  it('the county card lists the county’s cases with their dollars', () => {
    const card = countyCardFacts('Travis', cases, assignments, FIRM_NAMES)
    expect(card.title).toBe('Travis County')
    expect(card.firmName).toBe('Austin firm')
    expect(card.countLine).toBe('1 case · $15,781.82 open')
    expect(card.rows[0]).toMatchObject({ stand: 'firm', money: '$15,781.82' })
    const empty = countyCardFacts('Hays', cases, assignments, FIRM_NAMES)
    expect(empty).toMatchObject({ firmName: null, countLine: '0 cases', emptyLine: 'No case in Hays County.', rows: [] })
    expect(casesInCounty(cases, null)).toEqual([])
  })
  it('the legend counts cases and dollars per firm, then the uncovered', () => {
    expect(legendCounts(cases, assignments, FIRMS)).toEqual([
      // TLE is with firm-a (Snell) though Travis is firm-b's county: a case counts for the firm it is with (v2.5784).
      { firmId: 'firm-a', name: 'Snell Law Firm', count: 2, dollars: 17494.32, moneyWords: '$17,494.32' },
      { firmId: 'firm-b', name: 'Austin firm', count: 0, dollars: 0, moneyWords: '$0.00' },
      { firmId: null, name: 'No firm covers it', count: 2, dollars: 2378.04, moneyWords: '$2,378.04' },
    ])
    expect(uncoveredWords(cases, assignments)).toBe('2 cases in a county no firm covers · Burd & Assoc. (Williamson) · Bruce Hall (off the map). Color the county for a firm, or the desk cannot release them.')
    expect(uncoveredWords([], assignments)).toBeNull()
  })
})

describe('the lens (v2.5784)', () => {
  const cases = shapeMapCases({ accounts: ACCOUNTS, givenUp: GIVEN_UP, byPayerKey: MATTERS, firmNames: FIRM_NAMES, coords: COORDS, recordCounty: new Map([['addr-burd', 'Williamson']]), countyOf })
  it('uncoveredCounties lists each uncovered case\'s county once, sorted; a case with the firm is never uncovered', () => {
    expect(uncoveredCounties(cases, new Map([['Bexar', 'firm-a']]))).toEqual(['Williamson'])
    expect(uncoveredCounties(cases, new Map([['Bexar', 'firm-a'], ['Williamson', 'firm-b']]))).toEqual([])
  })
  it('lensSummaryWords counts accounts, jobs and open dollars', () => {
    expect(lensSummaryWords(cases)).toBe('4 accounts · 5 jobs · $19,872.36 open')
    expect(lensSummaryWords([])).toBe('Nothing is in Collections.')
  })
})

describe('the bridge on the Map (v2.6233, punch list #222)', () => {
  const none = new Map<string, string>()
  it('one firm and no county colored is the bridge; a second firm or a colored county ends it', () => {
    expect(bridgeFirmOf(none, [{ id: 'snell' }])).toBe('snell')
    expect(bridgeFirmOf(none, [{ id: 'snell' }, { id: 'alamo' }])).toBeNull()
    expect(bridgeFirmOf(new Map([['Bexar', 'snell']]), [{ id: 'snell' }])).toBeNull()
  })
  it('under the bridge no case is red, the one firm counts every case, the flag is silent and the card names the firm by default', () => {
    expect(cases.some((c) => effectiveStand(c, none) === 'none')).toBe(true)
    expect(cases.some((c) => effectiveStand(c, none, 'snell') === 'none')).toBe(false)
    expect(uncoveredWords(cases, none, 'snell')).toBeNull()
    expect(uncoveredCounties(cases, none, 'snell')).toEqual([])
    const counts = legendCounts(cases, none, [{ id: 'snell', name: 'Snell' }], 'snell')
    // Every case with no firm yet counts for the one firm; a case already released to another firm keeps its own row.
    const elsewhere = cases.filter((c) => c.firmId && c.firmId !== 'snell').length
    expect(counts.find((r) => r.firmId === 'snell')!.count).toBe(cases.length - elsewhere)
    expect(counts.find((r) => r.firmId === null)!.count).toBe(elsewhere)
    const card = countyCardFacts('Williamson', cases, none, new Map([['snell', 'Snell']]), 'snell')
    expect(card.firmName).toBe('Snell')
    expect(card.rows.every((r) => r.stand !== 'none')).toBe(true)
    expect(bridgeMapWords('Snell')).toBe('Snell takes every account today, by default. No county is colored yet. The first county colored for any firm ends that.')
  })
})

