import { describe, expect, it } from 'vitest'
import type { NameAnswerRow } from './nameAnswers'
import { lookAlikePairs } from './nameLikeness'
import type { BuilderRow } from './permitBuilders'
import {
  LOOK_ALIKE_COUNT_FRESH_MS,
  cityLookAlikes,
  freshLookAlikeCount,
  lookAlikeNudgeWords,
  ourBids,
  parseLookAlikeCounts,
  permitNamesOf,
  settledNames,
  siteCountsInCity,
  sumCityLookAlikes,
  withLookAlikeCount,
} from './lookAlikeWorklist'

// Every name and address here is made up.
const builder = (over: Partial<BuilderRow>): BuilderRow => ({ key: 'k', name: null, sample_contact: null, kind: null, customer_id: null, mark: null, mark_reason: null, mark_by_name: null, mark_at: null, permits: 1, open: 0, last_permit_on: null, plumber: null, plumber_jobs: 0, bids: 0, won: 0, last_bid_on: null, ...over })
const answer = (over: Partial<NameAnswerRow>): NameAnswerRow => ({ id: 'a', builder_key: 'ridgewaybuilderstexas', customer_id: 'c1', answer: 'works_for', scope: 'all', permit_id: null, name: 'Ridgeway Builders of Texas LLC', answered_by: 'u1', answered_at: '2026-11-10T15:00:00Z', ...over })

const BUILDERS: BuilderRow[] = [
  builder({ key: 'ridgewaybuilderstexas', sample_contact: 'Ridgeway Builders of Texas LLC', permits: 7, last_permit_on: '2026-11-03' }),
  builder({ key: 'hartwellinteriorcontracting', sample_contact: 'Hartwell Interior Contracting', permits: 4 }),
  builder({ key: 'danawhitlow', sample_contact: 'Dana Whitlow', permits: 8 }),
  builder({ key: 'pecangrovedental', sample_contact: 'Pecan Grove Dental', permits: 2 }),
  builder({ key: 'copperlineexpediting', name: 'Copperline Expediting', kind: 'files_for_others', permits: 30 }),
]
const CUSTOMERS = [
  { id: 'c1', name: 'Ridgeway Builders' },
  { id: 'c3', name: 'Hartwell Interiors' },
  { id: 'c5', name: 'Larkspur Dental' },
  { id: 'c6', name: 'Copperline Mechanical' },
]

describe('ourBids', () => {
  it('leaves the robots’ copies out', () => {
    const bids = [
      { customer_id: 'c1', address: '100 Sample St, San Antonio, TX 78201', project_name: 'Sample Clinic' },
      { customer_id: 'c1', address: '100 Sample St, San Antonio, TX 78201', project_name: 'ZZ Twin Sample Clinic' },
      { customer_id: 'c1', address: '100 Sample St, San Antonio, TX 78201', project_name: 'ZZ Shadow Sample Clinic' },
    ]
    expect(ourBids(bids).map((b) => b.project_name)).toEqual(['Sample Clinic'])
  })
})

describe('settledNames', () => {
  it('holds a name tied to a customer and a name refused for it, per customer', () => {
    const settled = settledNames([answer({}), answer({ id: 'b', builder_key: 'ridgewayroofing', answer: 'someone_else', scope: null }), answer({ id: 'c', customer_id: 'c3', builder_key: 'hartwellinteriorcontracting', answer: 'someone_else', scope: null })])
    expect([...(settled.get('c1') ?? [])].sort()).toEqual(['ridgewaybuilderstexas', 'ridgewayroofing'])
    expect([...(settled.get('c3') ?? [])]).toEqual(['hartwellinteriorcontracting'])
  })

  it('leaves a name open on Not sure, on one permit tied, and once the answer is taken back', () => {
    expect(settledNames([answer({ answer: 'not_sure', scope: null })]).size).toBe(0)
    expect(settledNames([answer({ scope: 'this_permit', permit_id: 'p1' })]).size).toBe(0)
    expect(settledNames([answer({}), answer({ id: 'b', answer: 'taken_back', scope: null, answered_at: '2026-11-11T09:00:00Z' })]).size).toBe(0)
  })
})

describe('siteCountsInCity', () => {
  const permits = [
    { id: 'p1', address: '100 SAMPLE ST', builder_key: 'danawhitlow', permit_number: 'COM-1', permit_type: 'Comm New Building Permit', stage: 'issued' },
    { id: 'p2', address: '100 SAMPLE ST', builder_key: 'danawhitlow', permit_number: 'COM-2', permit_type: 'Comm New Building Permit', stage: 'issued' },
    { id: 'p3', address: '100 SAMPLE ST', builder_key: null, permit_number: 'COM-3', permit_type: 'Comm New Building Permit', stage: 'issued' },
    { id: 'p4', address: '900 OTHER RD', builder_key: 'pecangrovedental', permit_number: 'COM-4', permit_type: 'Comm New Building Permit', stage: 'issued' },
  ]

  it('counts the names on permits that sit on addresses bid to each customer', () => {
    const counts = siteCountsInCity([{ customer_id: 'c1', address: '100 Sample St, San Antonio, TX 78201', project_name: 'Sample Clinic' }], 'San Antonio', permits)
    expect([...counts.keys()]).toEqual(['c1'])
    expect([...(counts.get('c1') ?? [])]).toEqual([['danawhitlow', 2]])
  })

  it('counts one permit once for a customer with two bids on the address, and skips a robot’s copy and another city', () => {
    const bids = [
      { customer_id: 'c1', address: '100 Sample St, San Antonio, TX 78201', project_name: 'Sample Clinic' },
      { customer_id: 'c1', address: '100 Sample Street, San Antonio, TX', project_name: 'Sample Clinic, rebid' },
      { customer_id: 'c3', address: '100 Sample St, San Antonio, TX 78201', project_name: 'ZZ Twin Sample Clinic' },
      { customer_id: 'c5', address: '100 Sample St, Austin, TX 78701', project_name: 'Austin Clinic' },
    ]
    const counts = siteCountsInCity(bids, 'San Antonio', permits)
    expect([...counts.keys()]).toEqual(['c1'])
    expect(counts.get('c1')?.get('danawhitlow')).toBe(2)
  })
})

describe('cityLookAlikes', () => {
  it('is the likeness kernel over Builders’ rows, so the chip and the Needs you line count one list', () => {
    const sites = new Map([['c1', new Map([['danawhitlow', 1]])]])
    const pairs = cityLookAlikes({ customers: CUSTOMERS }, BUILDERS, sites, new Map())
    expect(pairs).toEqual(lookAlikePairs(CUSTOMERS, permitNamesOf(BUILDERS), sites, new Map()))
    expect(pairs.map((p) => `${p.customerName} ~ ${p.suggestion.name}`)).toEqual(['Ridgeway Builders ~ Ridgeway Builders of Texas LLC', 'Hartwell Interiors ~ Hartwell Interior Contracting', 'Ridgeway Builders ~ Dana Whitlow'])
  })

  it('drops a name once it is answered either way, and never offers a name that files for others', () => {
    const settled = settledNames([answer({}), answer({ id: 'b', customer_id: 'c3', builder_key: 'hartwellinteriorcontracting', answer: 'someone_else', scope: null })])
    expect(cityLookAlikes({ customers: CUSTOMERS }, BUILDERS, new Map(), settled)).toEqual([])
    expect(cityLookAlikes({ customers: CUSTOMERS }, BUILDERS, new Map(), new Map()).some((p) => p.suggestion.key === 'copperlineexpediting')).toBe(false)
  })

  it('reads a builder by the name the office gave it, else the company on its permits', () => {
    expect(permitNamesOf([builder({ key: 'a', name: 'Ridgeway', sample_contact: 'Dana Whitlow / Ridgeway Builders LLC', permits: 3, last_permit_on: '2026-11-01', kind: 'gc' })])).toEqual([{ key: 'a', name: 'Ridgeway', permits: 3, lastOn: '2026-11-01', kind: 'gc' }])
  })
})

describe('sumCityLookAlikes', () => {
  const rows = [
    { city: 'San Antonio', count: 9 },
    { city: 'Austin', count: 5 },
    { city: 'Seguin', count: 0 },
  ]

  it('adds the chips up and lists each city that has some, the fullest first', () => {
    expect(sumCityLookAlikes(rows)).toEqual({ count: 14, byCity: [{ city: 'San Antonio', count: 9 }, { city: 'Austin', count: 5 }], city: 'San Antonio' })
    expect(sumCityLookAlikes([{ city: 'Austin', count: 5 }, { city: 'San Antonio', count: 5 }]).byCity.map((c) => c.city)).toEqual(['Austin', 'San Antonio'])
  })

  it('opens the city this browser last had on screen when it has some, else the fullest', () => {
    expect(sumCityLookAlikes(rows, 'Austin').city).toBe('Austin')
    expect(sumCityLookAlikes(rows, 'Seguin').city).toBe('San Antonio')
    expect(sumCityLookAlikes(rows, null).city).toBe('San Antonio')
  })

  it('is none when no city has any', () => {
    expect(sumCityLookAlikes([{ city: 'Seguin', count: 0 }], 'Seguin')).toEqual({ count: 0, byCity: [], city: null })
    expect(sumCityLookAlikes([])).toEqual({ count: 0, byCity: [], city: null })
  })
})

describe('lookAlikeNudgeWords', () => {
  it('says how many names look like a customer and what a press does', () => {
    expect(lookAlikeNudgeWords(14, [{ city: 'San Antonio', count: 14 }])).toEqual({ title: '14 names on permits look like a customer', detail: 'Answer each once. Nothing is tied until you press.' })
    expect(lookAlikeNudgeWords(1)).toEqual({ title: '1 name on permits looks like a customer', detail: 'Answer each once. Nothing is tied until you press.' })
  })

  it('says where when more than one city has some', () => {
    expect(lookAlikeNudgeWords(14, [{ city: 'San Antonio', count: 9 }, { city: 'Austin', count: 5 }, { city: 'Seguin', count: 0 }])?.detail).toBe('San Antonio 9 · Austin 5. Answer each once. Nothing is tied until you press.')
  })

  it('has no words when none wait', () => {
    expect(lookAlikeNudgeWords(0)).toBeNull()
  })
})

describe('what the Dashboard remembers', () => {
  const NOW = 1_800_000_000_000

  it('takes a city’s count while it is fresh, and reads the city again after half an hour', () => {
    const memory = withLookAlikeCount({}, 'San Antonio', 9, NOW)
    expect(freshLookAlikeCount(memory, 'San Antonio', NOW)).toBe(9)
    expect(freshLookAlikeCount(memory, 'San Antonio', NOW + LOOK_ALIKE_COUNT_FRESH_MS - 1)).toBe(9)
    expect(freshLookAlikeCount(memory, 'San Antonio', NOW + LOOK_ALIKE_COUNT_FRESH_MS)).toBeNull()
    expect(freshLookAlikeCount(memory, 'Austin', NOW)).toBeNull()
  })

  it('remembers none as a count, and does not trust a count from the future', () => {
    expect(freshLookAlikeCount(withLookAlikeCount({}, 'Seguin', 0, NOW), 'Seguin', NOW + 1)).toBe(0)
    expect(freshLookAlikeCount(withLookAlikeCount({}, 'Seguin', 3, NOW + 60_000), 'Seguin', NOW)).toBeNull()
  })

  it('keeps the other cities when one is counted again', () => {
    const memory = withLookAlikeCount(withLookAlikeCount({}, 'San Antonio', 9, NOW), 'Austin', 5, NOW + 5)
    expect(withLookAlikeCount(memory, 'San Antonio', 7, NOW + 9)).toEqual({ 'San Antonio': { count: 7, at: NOW + 9 }, Austin: { count: 5, at: NOW + 5 } })
  })

  it('reads back what it kept, and drops anything that is not a count with its moment', () => {
    const memory = withLookAlikeCount({}, 'San Antonio', 9, NOW)
    expect(parseLookAlikeCounts(JSON.stringify(memory))).toEqual(memory)
    expect(parseLookAlikeCounts(null)).toEqual({})
    expect(parseLookAlikeCounts('not json')).toEqual({})
    expect(parseLookAlikeCounts('[1,2]')).toEqual({})
    expect(parseLookAlikeCounts(JSON.stringify({ Austin: { count: '5', at: NOW }, Seguin: { count: -1, at: NOW }, 'San Marcos': null, 'New Braunfels': { count: 2, at: NOW } }))).toEqual({ 'New Braunfels': { count: 2, at: NOW } })
  })
})
