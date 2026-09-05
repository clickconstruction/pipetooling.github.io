import { describe, expect, it } from 'vitest'
import {
  buildPortalLinkHistory,
  buildPortalTimeline,
  computePortalMainOffCustomerIds,
  computePortalOffKeys,
  portalGlobeInitialState,
  portalOffKey,
} from './portalLinkState'

describe('computePortalOffKeys', () => {
  it('marks a pair off only when rows exist and none are active', () => {
    const keys = computePortalOffKeys([
      { customer_id: 'a', audience: 'customer', revoked_at: '2026-08-01T00:00:00Z' },
      { customer_id: 'a', audience: 'customer', revoked_at: '2026-08-02T00:00:00Z' },
      { customer_id: 'b', audience: 'customer', revoked_at: null },
      { customer_id: 'b', audience: 'gc', revoked_at: '2026-08-02T00:00:00Z' },
    ])
    expect(keys.sort()).toEqual([portalOffKey('a', 'customer'), portalOffKey('b', 'gc')].sort())
  })

  it('a rotated (revoked) row does not shadow the active successor', () => {
    const keys = computePortalOffKeys([
      { customer_id: 'a', audience: 'customer', revoked_at: '2026-08-02T00:00:00Z' },
      { customer_id: 'a', audience: 'customer', revoked_at: null },
    ])
    expect(keys).toEqual([])
  })

  it('never-minted customers are absent (not off)', () => {
    expect(computePortalOffKeys([])).toEqual([])
  })

  it('audiences are independent per customer', () => {
    const keys = computePortalOffKeys([
      { customer_id: 'a', audience: 'customer', revoked_at: null },
      { customer_id: 'a', audience: 'gc', revoked_at: '2026-08-02T00:00:00Z' },
    ])
    expect(keys).toEqual([portalOffKey('a', 'gc')])
  })
})

describe('buildPortalLinkHistory', () => {
  it('newest first, active link labeled active', () => {
    const h = buildPortalLinkHistory([
      { audience: 'customer', created_at: '2026-08-01T00:00:00Z', revoked_at: '2026-08-10T12:00:00Z' },
      { audience: 'customer', created_at: '2026-08-10T12:00:10Z', revoked_at: null },
    ])
    expect(h[0]!.outcome).toBe('active')
    expect(h[0]!.createdAt).toBe('2026-08-10T12:00:10Z')
    expect(h[1]!.outcome).toBe('rotated')
  })

  it('a revocation with no near-in-time successor is turned-off', () => {
    const h = buildPortalLinkHistory([
      { audience: 'customer', created_at: '2026-08-01T00:00:00Z', revoked_at: '2026-08-05T00:00:00Z' },
      { audience: 'customer', created_at: '2026-08-07T00:00:00Z', revoked_at: null },
    ])
    expect(h[1]!.outcome).toBe('turned-off')
  })

  it('a successor created just BEFORE the revocation timestamp still counts as rotation', () => {
    // Same-transaction ordering can stamp the insert a hair before the update.
    const h = buildPortalLinkHistory([
      { audience: 'customer', created_at: '2026-08-05T00:00:00.500Z', revoked_at: null },
      { audience: 'customer', created_at: '2026-08-01T00:00:00Z', revoked_at: '2026-08-05T00:00:01Z' },
    ])
    expect(h[1]!.outcome).toBe('rotated')
  })

  it('carries createdBy through', () => {
    const h = buildPortalLinkHistory([
      { audience: 'customer', created_at: '2026-08-01T00:00:00Z', revoked_at: null, created_by: 'u1' },
    ])
    expect(h[0]!.createdBy).toBe('u1')
  })
})


describe('computePortalMainOffCustomerIds (merged-audience red globe)', () => {
  it("'all' rows are authoritative: off only when every 'all' row is revoked", () => {
    expect(
      computePortalMainOffCustomerIds([
        { customer_id: 'a', audience: 'all', revoked_at: '2026-08-02T00:00:00Z' },
        { customer_id: 'a', audience: 'customer', revoked_at: null }, // active scoped link does not save it
        { customer_id: 'b', audience: 'all', revoked_at: null },
        { customer_id: 'b', audience: 'gc', revoked_at: '2026-08-02T00:00:00Z' }, // scoped off never paints red
      ]),
    ).toEqual(['a'])
  })

  it('legacy-only customers are off when every row is revoked', () => {
    expect(
      computePortalMainOffCustomerIds([
        { customer_id: 'c', audience: 'customer', revoked_at: '2026-08-01T00:00:00Z' },
        { customer_id: 'c', audience: 'gc', revoked_at: '2026-08-01T00:00:00Z' },
        { customer_id: 'd', audience: 'customer', revoked_at: null },
      ]),
    ).toEqual(['c'])
  })

  it('never-minted customers are absent', () => {
    expect(computePortalMainOffCustomerIds([])).toEqual([])
  })
})

describe('buildPortalTimeline', () => {
  it('merges link lifecycles (per-audience rotation inference) with slug events, newest first', () => {
    const timeline = buildPortalTimeline(
      [
        // 'customer' scoped link revoked with an 'all' mint moments later —
        // must stay turned-off, not read as a rotation across audiences.
        { audience: 'customer', created_at: '2026-08-01T00:00:00Z', revoked_at: '2026-08-21T10:00:00Z', created_by: 'u1' },
        { audience: 'all', created_at: '2026-08-21T10:00:05Z', revoked_at: null, created_by: 'u1' },
      ],
      [
        { event: 'created', slug: 'knight-contracting', created_at: '2026-08-21T11:00:00Z', created_by: 'u1' },
        { event: 'bogus', slug: null, created_at: '2026-08-21T11:30:00Z', created_by: null },
      ],
    )
    expect(timeline.map((e) => e.kind)).toEqual(['slug', 'link', 'link'])
    const scoped = timeline[2]!
    expect(scoped.kind === 'link' && scoped.outcome).toBe('turned-off')
    const all = timeline[1]!
    expect(all.kind === 'link' && all.audience).toBe('all')
    expect(all.kind === 'link' && all.outcome).toBe('active')
  })
})

describe('portalGlobeInitialState', () => {
  const row = (audience: string, revoked_at: string | null, customer_id = 'c1') => ({ customer_id, audience, revoked_at })

  it('never-minted → unminted (the modal must not mint on open)', () => {
    expect(portalGlobeInitialState([], 'c1')).toBe('unminted')
  })

  it("another customer's rows are not this customer's", () => {
    expect(portalGlobeInitialState([row('all', null, 'other')], 'c1')).toBe('unminted')
  })

  it('a live merged link → active', () => {
    expect(portalGlobeInitialState([row('all', '2026-08-01T00:00:00Z'), row('all', null)], 'c1')).toBe('active')
  })

  it('every all-row revoked → off, even with a live scoped row', () => {
    expect(portalGlobeInitialState([row('all', '2026-08-02T00:00:00Z')], 'c1')).toBe('off')
    expect(portalGlobeInitialState([row('all', '2026-08-02T00:00:00Z'), row('gc', null)], 'c1')).toBe('off')
  })

  it('legacy-only rows: all revoked → off; one live → legacy-active (continuation mint)', () => {
    expect(portalGlobeInitialState([row('customer', '2026-08-02T00:00:00Z')], 'c1')).toBe('off')
    expect(portalGlobeInitialState([row('gc', null)], 'c1')).toBe('legacy-active')
    expect(portalGlobeInitialState([row('gc', null), row('customer', '2026-08-02T00:00:00Z')], 'c1')).toBe('legacy-active')
  })

  it('rows without customer_id (sub-portal adapter shape) belong to the asked-for id', () => {
    expect(portalGlobeInitialState([{ audience: 'all', revoked_at: null }], 'p1')).toBe('active')
    expect(portalGlobeInitialState([{ audience: 'all', revoked_at: '2026-08-02T00:00:00Z' }], 'p1')).toBe('off')
  })
})
