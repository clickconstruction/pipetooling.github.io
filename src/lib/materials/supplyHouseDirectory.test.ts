import { describe, expect, it } from 'vitest'

import {
  buildDirectoryRows,
  directoryAgoPhrase,
  directorySearchMatches,
  priceCountsByHouse,
  requestOutcomeLabel,
  type DirectoryHouse,
  type DirectoryRep,
  type DirectoryRequest,
} from './supplyHouseDirectory'

function house(id: string, name: string, extra: Partial<DirectoryHouse> = {}): DirectoryHouse {
  return { id, name, address: null, phone: null, website_url: null, notes: null, is_insurer: false, ...extra }
}

function rep(id: string, supply_house_id: string, extra: Partial<DirectoryRep> = {}): DirectoryRep {
  return { id, supply_house_id, label: null, name: null, email: `${id}@x.com`, is_default: false, created_by: null, created_at: '2026-09-01T00:00:00Z', ...extra }
}

function request(supply_house_id: string, created_at: string, extra: Partial<DirectoryRequest> = {}): DirectoryRequest {
  return { supply_house_id, created_at, created_by: null, status: 'sent', bid_id: null, bid_label: null, ...extra }
}

const HOUSES = [
  house('moore', 'Moore Supply', { address: '1 Main St' }),
  house('ferguson', 'Ferguson'),
  house('winn', 'Winn Supply'),
  house('texas-mutual', 'Texas Mutual (Workers Comp)', { is_insurer: true }),
  house('apple', 'Apple Lumber'),
]

const REPS = [
  rep('r1', 'moore', { label: 'Counter', email: 'counter@moore.com' }),
  rep('r2', 'moore', { label: 'Quotes desk', email: 'quotes@moore.com', is_default: true, created_by: 'u-office' }),
  rep('r3', 'ferguson', { name: 'Pat', email: 'pat@ferguson.com', is_default: true }),
  rep('r4', 'texas-mutual', { label: 'Agent', email: 'agent@tm.com', is_default: true }),
  rep('orphan', null as unknown as string, { email: 'shortlist@x.com' }),
]

const REQUESTS = [
  request('moore', '2026-08-20T10:00:00Z', { status: 'quoted', created_by: 'u-grace', bid_label: 'b391' }),
  request('moore', '2026-09-01T10:00:00Z', { status: 'sent', created_by: 'u-wendi', bid_label: 'b398' }),
  request('ferguson', '2026-07-01T10:00:00Z', { status: 'closed' }),
  request(null as unknown as string, '2026-09-05T10:00:00Z'),
]

describe('buildDirectoryRows', () => {
  it('orders houses with a rep, then other kinds, then houses that need one — alphabetical inside each group', () => {
    const { rows } = buildDirectoryRows({ houses: HOUSES, reps: REPS, requests: REQUESTS, priceCountByHouse: null })
    expect(rows.map((r) => r.house.name)).toEqual(['Ferguson', 'Moore Supply', 'Texas Mutual (Workers Comp)', 'Apple Lumber', 'Winn Supply'])
  })

  it('counts coverage over supply houses only', () => {
    const { coverage } = buildDirectoryRows({ houses: HOUSES, reps: REPS, requests: REQUESTS, priceCountByHouse: null })
    expect(coverage).toEqual({ total: 4, withRep: 2, needRep: 2 })
  })

  it('hides insurers for the supply_house kind filter and keeps coverage unchanged', () => {
    const { rows, coverage } = buildDirectoryRows({ houses: HOUSES, reps: REPS, requests: REQUESTS, priceCountByHouse: null, kinds: 'supply_house' })
    expect(rows.some((r) => r.kind === 'insurer')).toBe(false)
    expect(coverage).toEqual({ total: 4, withRep: 2, needRep: 2 })
  })

  it('puts the default rep first and drops reps with no house', () => {
    const { rows } = buildDirectoryRows({ houses: HOUSES, reps: REPS, requests: REQUESTS, priceCountByHouse: null })
    const moore = rows.find((r) => r.house.id === 'moore')!
    expect(moore.reps.map((r) => r.label)).toEqual(['Quotes desk', 'Counter'])
    expect(moore.defaultRep?.id).toBe('r2')
    expect(moore.needsRep).toBe(false)
    expect(rows.flatMap((r) => r.reps).some((r) => r.id === 'orphan')).toBe(false)
  })

  it('reports the newest request and a capped recent list, newest first', () => {
    const { rows } = buildDirectoryRows({ houses: HOUSES, reps: REPS, requests: REQUESTS, priceCountByHouse: null, recentLimit: 1 })
    const moore = rows.find((r) => r.house.id === 'moore')!
    expect(moore.lastRequest?.bid_label).toBe('b398')
    expect(moore.lastRequest?.created_by).toBe('u-wendi')
    expect(moore.recentRequests).toHaveLength(1)
    const winn = rows.find((r) => r.house.id === 'winn')!
    expect(winn.lastRequest).toBeNull()
  })

  it('carries price counts when stats are loaded and null when they are not', () => {
    const loaded = buildDirectoryRows({ houses: HOUSES, reps: REPS, requests: [], priceCountByHouse: { moore: 312 } })
    expect(loaded.rows.find((r) => r.house.id === 'moore')!.priceCount).toBe(312)
    expect(loaded.rows.find((r) => r.house.id === 'winn')!.priceCount).toBe(0)
    const pending = buildDirectoryRows({ houses: HOUSES, reps: REPS, requests: [], priceCountByHouse: null })
    expect(pending.rows[0]!.priceCount).toBeNull()
  })

  it('searches house name, address and rep fields, and keeps coverage for the whole roster', () => {
    const byRep = buildDirectoryRows({ houses: HOUSES, reps: REPS, requests: [], priceCountByHouse: null, search: 'quotes@' })
    expect(byRep.rows.map((r) => r.house.id)).toEqual(['moore'])
    expect(byRep.coverage.total).toBe(4)
    const byAddress = buildDirectoryRows({ houses: HOUSES, reps: REPS, requests: [], priceCountByHouse: null, search: 'main st' })
    expect(byAddress.rows.map((r) => r.house.id)).toEqual(['moore'])
    const byName = buildDirectoryRows({ houses: HOUSES, reps: REPS, requests: [], priceCountByHouse: null, search: '  WINN ' })
    expect(byName.rows.map((r) => r.house.id)).toEqual(['winn'])
  })
})

describe('directorySearchMatches', () => {
  it('matches everything on an empty query', () => {
    expect(directorySearchMatches({ house: house('a', 'A'), reps: [] }, '   ')).toBe(true)
  })
})

describe('requestOutcomeLabel', () => {
  it('names each status for the next reader', () => {
    expect(requestOutcomeLabel('quoted')).toBe('answered')
    expect(requestOutcomeLabel('sent')).toBe('no reply yet')
    expect(requestOutcomeLabel('closed')).toBe('closed')
    expect(requestOutcomeLabel('draft')).toBe('draft')
    expect(requestOutcomeLabel('anything-else')).toBe('no reply yet')
  })
})

describe('priceCountsByHouse', () => {
  const rows = [
    { supply_house_id: 'moore', service_type_id: 'plumbing', price_count: 300 },
    { supply_house_id: 'moore', service_type_id: 'hvac', price_count: 12 },
    { supply_house_id: 'ferguson', service_type_id: 'plumbing', price_count: 1204 },
  ]
  it('sums across service types by default', () => {
    expect(priceCountsByHouse(rows)).toEqual({ moore: 312, ferguson: 1204 })
  })
  it('narrows to one service type when asked', () => {
    expect(priceCountsByHouse(rows, 'hvac')).toEqual({ moore: 12 })
  })
})

describe('directoryAgoPhrase', () => {
  const now = Date.parse('2026-09-08T12:00:00Z')
  it('phrases days, weeks, months and years', () => {
    expect(directoryAgoPhrase('2026-09-08T09:00:00Z', now)).toBe('today')
    expect(directoryAgoPhrase('2026-09-07T09:00:00Z', now)).toBe('yesterday')
    expect(directoryAgoPhrase('2026-08-27T09:00:00Z', now)).toBe('12 days ago')
    expect(directoryAgoPhrase('2026-08-04T09:00:00Z', now)).toBe('5 weeks ago')
    expect(directoryAgoPhrase('2026-05-01T09:00:00Z', now)).toBe('4 months ago')
    expect(directoryAgoPhrase('2025-06-01T09:00:00Z', now)).toBe('a year ago')
    expect(directoryAgoPhrase('not a date', now)).toBeNull()
  })
})
