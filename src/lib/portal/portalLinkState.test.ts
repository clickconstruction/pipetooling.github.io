import { describe, expect, it } from 'vitest'
import { buildPortalLinkHistory, computePortalOffKeys, portalOffKey } from './portalLinkState'

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
