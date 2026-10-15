import { describe, expect, it } from 'vitest'
import {
  NO_SOURCE,
  benchDouble,
  benchNeedWords,
  benchNeeds,
  orderSubsByNeed,
  sourceSuccess,
  subGap,
  subsForTrade,
  subsLaneHref,
  tradeKey,
  tradesLeftToPick,
  withTrade,
} from './subsLane'

const benches = [
  { trade: 'Concrete', dependable: 1 },
  { trade: 'Fire sprinkler', dependable: 0 },
  { trade: 'Plumbing', dependable: 3 },
]

type Row = { id: string; trades: string[] | null; prospect_fit_status: string | null; created_at: string | null; source: string | null }
const a: Row = { id: 'a', trades: ['Fire sprinkler', 'HVAC'], prospect_fit_status: null, created_at: '2026-10-01', source: "A GC's sub list" }
const b: Row = { id: 'b', trades: ['concrete'], prospect_fit_status: null, created_at: '2026-10-02', source: 'PlanHub' }
const c: Row = { id: 'c', trades: ['Concrete'], prospect_fit_status: 'converted', created_at: '2026-09-01', source: 'PlanHub' }
const d: Row = { id: 'd', trades: ['Roofing'], prospect_fit_status: null, created_at: '2026-10-03', source: null }
const e: Row = { id: 'e', trades: null, prospect_fit_status: null, created_at: '2026-10-04', source: 'A referral' }
const subs: Row[] = [a, b, c, d, e]

describe('subsLane: what the bench needs', () => {
  it('lists the bench trades biggest gap first, counting the subs still in the queue, then the trades only the subs name', () => {
    expect(benchNeeds(benches, subs)).toEqual([
      { trade: 'Fire sprinkler', dependable: 0, short: 3, toCall: 1, onBench: true },
      { trade: 'Concrete', dependable: 1, short: 2, toCall: 1, onBench: true },
      { trade: 'Plumbing', dependable: 3, short: 0, toCall: 0, onBench: true },
      { trade: 'HVAC', dependable: 0, short: 0, toCall: 1, onBench: false },
      { trade: 'Roofing', dependable: 0, short: 0, toCall: 1, onBench: false },
    ])
  })

  it('words a trade by its gap, a full bench, or a trade the bench does not ask for', () => {
    expect(benchNeedWords({ trade: 'Concrete', dependable: 1, short: 2, toCall: 4, onBench: true })).toEqual({ head: '2 more', tail: '4 to call' })
    expect(benchNeedWords({ trade: 'Plumbing', dependable: 3, short: 0, toCall: 0, onBench: true })).toEqual({ head: '3 on the bench', tail: '0 to call' })
    expect(benchNeedWords({ trade: 'Roofing', dependable: 0, short: 0, toCall: 1, onBench: false })).toEqual({ head: 'not on the bench', tail: '1 to call' })
  })

  it('reads a trade case-blind', () => {
    expect(tradeKey('  Fire Sprinkler ')).toBe('fire sprinkler')
    expect(subsForTrade(subs, 'CONCRETE').map((s) => s.id)).toEqual(['b', 'c'])
    expect(subsForTrade(subs, null)).toHaveLength(5)
    expect(subsForTrade(subs, '  ')).toHaveLength(5)
  })
})

describe('subsLane: By need', () => {
  const needs = benchNeeds(benches, subs)

  it('takes the biggest gap among a sub’s trades', () => {
    expect(subGap({ trades: ['HVAC', 'Concrete'] }, needs)).toBe(2)
    expect(subGap({ trades: ['Roofing'] }, needs)).toBe(0)
    expect(subGap({ trades: null }, needs)).toBe(0)
  })

  it('orders by gap, then never called, then the caller’s order', () => {
    const queue = [d, b, a, e] // roofing, concrete, fire sprinkler, no trade
    const called = new Set(['a'])
    expect(orderSubsByNeed(queue, needs, called).map((s) => s.id)).toEqual(['a', 'b', 'd', 'e'])
    expect(orderSubsByNeed(queue, needs, new Set()).map((s) => s.id)).toEqual(['a', 'b', 'd', 'e'])
    const twoConcrete = [{ ...b, id: 'x' }, b]
    expect(orderSubsByNeed(twoConcrete, needs, new Set(['x'])).map((s) => s.id)).toEqual(['b', 'x'])
  })
})

describe('subsLane: source success', () => {
  it('counts every row by where we found them, most tried first, blank as No source', () => {
    expect(sourceSuccess(subs)).toEqual([
      { source: 'PlanHub', landed: 1, total: 2 },
      { source: "A GC's sub list", landed: 0, total: 1 },
      { source: 'A referral', landed: 0, total: 1 },
      { source: NO_SOURCE, landed: 0, total: 1 },
    ])
    expect(sourceSuccess([{ source: 'planhub', prospect_fit_status: 'converted' }, { source: 'PlanHub', prospect_fit_status: null }])).toEqual([
      { source: 'planhub', landed: 1, total: 2 },
    ])
  })
})

describe('subsLane: the double on the bench', () => {
  const companies = [
    { id: 'co-1', name: 'Bexar Fire Protection', phone: '(210) 555-0188' },
    { id: 'co-2', name: 'Comal Concrete Works', phone: '' },
  ]

  it('finds the same name case-blind or the same phone digits', () => {
    expect(benchDouble('bexar fire protection ', null, companies)?.id).toBe('co-1')
    expect(benchDouble('Bexar Fire', '210.555.0188', companies)?.id).toBe('co-1')
    expect(benchDouble('Comal Concrete Works', null, companies)?.id).toBe('co-2')
  })

  it('does not match a short number, a blank name or a stranger', () => {
    expect(benchDouble('', '0188', companies)).toBeNull()
    expect(benchDouble('Lone Star Sprinkler', '(512) 555-0100', companies)).toBeNull()
  })

  it('writes the bench’s door into the lane', () => {
    expect(subsLaneHref('Fire sprinkler')).toBe('/prospects?tab=subs&trade=Fire%20sprinkler')
    expect(subsLaneHref(null)).toBe('/prospects?tab=subs')
  })
})

describe('subsLane: the bench names as picks', () => {
  it('offers the bench trades not yet typed, once each, in the bench spelling', () => {
    expect(tradesLeftToPick(['Concrete', 'Fire sprinkler', 'concrete ', 'HVAC'], 'fire SPRINKLER, Roofing')).toEqual(['Concrete', 'HVAC'])
    expect(tradesLeftToPick([], '')).toEqual([])
  })

  it('adds a pick to the box without doubling it', () => {
    expect(withTrade('', 'Concrete')).toBe('Concrete')
    expect(withTrade('Roofing,HVAC', 'Fire sprinkler')).toBe('Roofing, HVAC, Fire sprinkler')
    expect(withTrade('concrete', 'Concrete')).toBe('concrete')
  })
})
