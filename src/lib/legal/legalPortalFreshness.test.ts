/** Punch list #85, item 22: the page reloads before the fifteen-minute PDF links die. */
import { describe, expect, it } from 'vitest'
import { PORTAL_RELOAD_AFTER_MS, PORTAL_SIGNED_LINK_MS, portalPayloadIsStale } from './legalPortalFreshness'

describe('portalPayloadIsStale', () => {
  it('is never stale before the first load', () => {
    expect(portalPayloadIsStale(null, Date.now())).toBe(false)
  })

  it('turns stale at ten minutes, five before a signed link dies', () => {
    const t0 = 1_000_000
    expect(portalPayloadIsStale(t0, t0 + PORTAL_RELOAD_AFTER_MS - 1)).toBe(false)
    expect(portalPayloadIsStale(t0, t0 + PORTAL_RELOAD_AFTER_MS)).toBe(true)
    expect(PORTAL_SIGNED_LINK_MS - PORTAL_RELOAD_AFTER_MS).toBe(5 * 60 * 1000)
  })
})
