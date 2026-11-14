import { describe, expect, it } from 'vitest'
import { ON_SITE_BOX_REFRESH_AFTER_MS, ON_SITE_REFRESH_AFTER_MS, ON_SITE_REFRESH_EVERY_MS, readIsStale } from './onSiteFresh'

describe('readIsStale', () => {
  const T = 1_800_000_000_000
  it('a read older than the age is made again, a newer one is kept', () => {
    expect(readIsStale(T - 61_000, T, ON_SITE_REFRESH_AFTER_MS)).toBe(true)
    expect(readIsStale(T - 60_000, T, ON_SITE_REFRESH_AFTER_MS)).toBe(true)
    expect(readIsStale(T - 59_000, T, ON_SITE_REFRESH_AFTER_MS)).toBe(false)
  })
  it('a job never read is not refreshed', () => {
    expect(readIsStale(null, T, ON_SITE_REFRESH_AFTER_MS)).toBe(false)
    expect(readIsStale(undefined, T, 0)).toBe(false)
  })
  it('a box asks sooner than the page, and the page’s own timer is the slowest', () => {
    expect(ON_SITE_BOX_REFRESH_AFTER_MS).toBeLessThan(ON_SITE_REFRESH_AFTER_MS)
    expect(ON_SITE_REFRESH_AFTER_MS).toBeLessThan(ON_SITE_REFRESH_EVERY_MS)
  })
})
