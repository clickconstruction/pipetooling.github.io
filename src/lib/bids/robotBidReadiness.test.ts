import { describe, expect, it } from 'vitest'
import { buildRobotBidPrompt, robotBidReadiness, type RobotReadinessBidFields } from './robotBidReadiness'

const fullBid: RobotReadinessBidFields = {
  bid_number: '393',
  project_name: 'TAKE 5 CONROE',
  plans_link: 'https://drive.example/plans',
  service_type_id: 'st-1',
  distance_from_office: 44,
  bid_due_date: '2026-09-01',
  gc_builder_id: 'gc-1',
  customer_id: null,
}

describe('robotBidReadiness', () => {
  it('is ready when both required inputs are present', () => {
    const r = robotBidReadiness(fullBid)
    expect(r.state).toBe('ready')
    expect(r.missing).toEqual([])
    expect(r.items.every((i) => i.ok)).toBe(true)
  })

  it('missing plans blocks readiness with a fix hint', () => {
    const r = robotBidReadiness({ ...fullBid, plans_link: '  ' })
    expect(r.state).toBe('missing')
    expect(r.missing.map((m) => m.key)).toEqual(['plans'])
    expect(r.missing[0]?.fix).toMatch(/plans link/i)
  })

  it('missing service type blocks readiness', () => {
    const r = robotBidReadiness({ ...fullBid, service_type_id: null })
    expect(r.state).toBe('missing')
    expect(r.missing.map((m) => m.key)).toEqual(['service-type'])
  })

  it('optional gaps warn but do not block', () => {
    const r = robotBidReadiness({
      ...fullBid,
      distance_from_office: null,
      bid_due_date: null,
      gc_builder_id: null,
      customer_id: null,
    })
    expect(r.state).toBe('ready')
    expect(r.items.filter((i) => !i.ok).map((i) => i.key).sort()).toEqual(['distance', 'due-date', 'gc'])
  })

  it('an existing twin bid wins over everything', () => {
    const r = robotBidReadiness({ ...fullBid, plans_link: null }, { twinBidExists: true })
    expect(r.state).toBe('done')
    expect(r.missing).toEqual([])
  })

  it('customer_id alone satisfies the GC item', () => {
    const r = robotBidReadiness({ ...fullBid, gc_builder_id: null, customer_id: 'c-1' })
    expect(r.items.find((i) => i.key === 'gc')?.ok).toBe(true)
  })
})

describe('buildRobotBidPrompt', () => {
  it('carries the bid number, name, due date, mileage, external_ref and blind rule', () => {
    const p = buildRobotBidPrompt(fullBid)
    expect(p).toContain('b393')
    expect(p).toContain('TAKE 5 CONROE')
    expect(p).toContain('due 2026-09-01')
    expect(p).toContain('44 mi from the office')
    expect(p).toContain('external_ref b393')
    expect(p).toContain('BLIND RULE')
    expect(p).not.toMatch(/\$\d/)
  })

  it('degrades gracefully when optional logistics are absent', () => {
    const p = buildRobotBidPrompt({ ...fullBid, bid_due_date: null, distance_from_office: null })
    expect(p).toContain('distance not recorded')
    expect(p).not.toContain('due ')
  })
})
