import { describe, expect, it } from 'vitest'
import { computeReorderedSort, isPinnedIn, pinKey, type PinnedItem } from './pinnedTabs'

describe('isPinnedIn', () => {
  const list: PinnedItem[] = [
    { path: '/bids', label: 'Bids' },
    { path: '/bids', label: 'Bids · Counts', tab: 'counts' },
    { path: '/jobs', label: 'Jobs', tab: 'billing' },
  ]

  it('matches a page pin with no tab', () => {
    expect(isPinnedIn(list, '/bids', undefined)).toBe(true)
    expect(isPinnedIn(list, '/bids', null)).toBe(true)
  })

  it('matches a specific tab pin', () => {
    expect(isPinnedIn(list, '/bids', 'counts')).toBe(true)
    expect(isPinnedIn(list, '/jobs', 'billing')).toBe(true)
  })

  it('treats undefined and null tab as equivalent (no-tab pin)', () => {
    expect(isPinnedIn([{ path: '/bids', label: 'Bids' }], '/bids', null)).toBe(true)
    expect(isPinnedIn([{ path: '/bids', label: 'Bids', tab: undefined }], '/bids', undefined)).toBe(true)
  })

  it('does not match a different tab of the same path', () => {
    expect(isPinnedIn(list, '/bids', 'takeoffs')).toBe(false)
    expect(isPinnedIn(list, '/jobs', undefined)).toBe(false) // only the billing tab is pinned
  })

  it('does not match an unpinned path', () => {
    expect(isPinnedIn(list, '/customers', undefined)).toBe(false)
  })
})

describe('computeReorderedSort', () => {
  const rows = (xs: Array<[string, string | null, number]>) =>
    xs.map(([path, tab, sort_order]) => ({ path, tab, sort_order }))

  it('assigns contiguous sort_order 0..n-1 for the visible order when all rows are visible', () => {
    const all = rows([['/a', null, 0], ['/b', null, 1], ['/c', null, 2]])
    const result = computeReorderedSort([{ path: '/c' }, { path: '/a' }, { path: '/b' }], all)
    expect(result).toEqual([
      { path: '/c', tab: null, sort_order: 0 },
      { path: '/a', tab: null, sort_order: 1 },
      { path: '/b', tab: null, sort_order: 2 },
    ])
  })

  it('places hidden (filtered-out) rows AFTER the visible order, with no collisions', () => {
    // '/hidden' is not in the visible subset (e.g. role-filtered) — it must not collide at 0.
    const all = rows([['/a', null, 0], ['/hidden', null, 0], ['/b', null, 0]])
    const result = computeReorderedSort([{ path: '/b' }, { path: '/a' }], all)
    expect(result).toEqual([
      { path: '/b', tab: null, sort_order: 0 },
      { path: '/a', tab: null, sort_order: 1 },
      { path: '/hidden', tab: null, sort_order: 2 },
    ])
    // all sort_orders distinct
    expect(new Set(result.map((r) => r.sort_order)).size).toBe(result.length)
  })

  it('keeps multiple hidden rows in their existing relative order after the visible ones', () => {
    const all = rows([['/v', null, 5], ['/h2', null, 9], ['/h1', null, 3]])
    const result = computeReorderedSort([{ path: '/v' }], all)
    expect(result.map((r) => r.path)).toEqual(['/v', '/h1', '/h2']) // h1(3) before h2(9)
  })

  it('matches by path AND tab', () => {
    const all = rows([['/bids', null, 0], ['/bids', 'counts', 1]])
    const result = computeReorderedSort([{ path: '/bids', tab: 'counts' }, { path: '/bids', tab: null }], all)
    expect(result).toEqual([
      { path: '/bids', tab: 'counts', sort_order: 0 },
      { path: '/bids', tab: null, sort_order: 1 },
    ])
  })
})

describe('pinKey', () => {
  it('distinguishes tab vs no-tab and treats undefined/null tab the same', () => {
    expect(pinKey({ path: '/bids' })).toBe(pinKey({ path: '/bids', tab: null }))
    expect(pinKey({ path: '/bids', tab: 'counts' })).not.toBe(pinKey({ path: '/bids' }))
  })
})
