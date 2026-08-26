import { describe, expect, it } from 'vitest'
import { computeReorderedSort, filterPinnedByRole, isPinnedIn, PATH_TO_LABEL, PINNABLE_PATHS, pinKey, type PinnedItem } from './pinnedTabs'

describe('front-door pins (v2.2330)', () => {
  it('makes /tally and /accounts-receivable pinnable with proper labels', () => {
    expect(PINNABLE_PATHS).toContain('/tally')
    expect(PINNABLE_PATHS).toContain('/accounts-receivable')
    expect(PATH_TO_LABEL['/tally']).toBe('Job Parts Tally')
    expect(PATH_TO_LABEL['/accounts-receivable']).toBe('Accounts Receivable')
  })

  it('role-filters through the layoutRouteAccess kernel (stale local sets removed)', () => {
    const pins: PinnedItem[] = [
      { path: '/tally', label: 'Job Parts Tally' },
      { path: '/accounts-receivable', label: 'Accounts Receivable' },
      { path: '/my-statement', label: 'Statement' },
    ]
    expect(filterPinnedByRole(pins, 'subcontractor').map((p) => p.path)).toEqual(['/tally', '/my-statement'])
    expect(filterPinnedByRole(pins, 'assistant').map((p) => p.path)).toEqual(pins.map((p) => p.path))
    // null role = primary stand-in while auth loads
    expect(filterPinnedByRole(pins, null).map((p) => p.path)).toEqual(['/tally', '/my-statement'])
  })
})

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
      { path: '/c', tab: null, sort_order: 0, bid_id: null },
      { path: '/a', tab: null, sort_order: 1, bid_id: null },
      { path: '/b', tab: null, sort_order: 2, bid_id: null },
    ])
  })

  it('places hidden (filtered-out) rows AFTER the visible order, with no collisions', () => {
    // '/hidden' is not in the visible subset (e.g. role-filtered) — it must not collide at 0.
    const all = rows([['/a', null, 0], ['/hidden', null, 0], ['/b', null, 0]])
    const result = computeReorderedSort([{ path: '/b' }, { path: '/a' }], all)
    expect(result).toEqual([
      { path: '/b', tab: null, sort_order: 0, bid_id: null },
      { path: '/a', tab: null, sort_order: 1, bid_id: null },
      { path: '/hidden', tab: null, sort_order: 2, bid_id: null },
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
      { path: '/bids', tab: 'counts', sort_order: 0, bid_id: null },
      { path: '/bids', tab: null, sort_order: 1, bid_id: null },
    ])
  })
})

describe('pinKey', () => {
  it('distinguishes tab vs no-tab and treats undefined/null tab the same', () => {
    expect(pinKey({ path: '/bids' })).toBe(pinKey({ path: '/bids', tab: null }))
    expect(pinKey({ path: '/bids', tab: 'counts' })).not.toBe(pinKey({ path: '/bids' }))
  })
})

describe('bid-aware pins (v2.1335)', () => {
  const bidPin = { path: '/bids', label: 'BP352', tab: 'pricing', bidId: 'bid-1' }
  const tabPin = { path: '/bids', label: 'Bids', tab: 'pricing' }

  it('isPinnedIn distinguishes a bid pin from the plain tab pin', () => {
    expect(isPinnedIn([bidPin], '/bids', 'pricing', 'bid-1')).toBe(true)
    expect(isPinnedIn([bidPin], '/bids', 'pricing')).toBe(false)
    expect(isPinnedIn([tabPin], '/bids', 'pricing', 'bid-1')).toBe(false)
    expect(isPinnedIn([tabPin, bidPin], '/bids', 'pricing')).toBe(true)
  })

  it('isPinnedIn separates two bids pinned on the same tab', () => {
    const other = { ...bidPin, bidId: 'bid-2', label: 'BP343' }
    expect(isPinnedIn([bidPin, other], '/bids', 'pricing', 'bid-2')).toBe(true)
    expect(isPinnedIn([bidPin], '/bids', 'pricing', 'bid-2')).toBe(false)
  })

  it('pinKey includes the bid (both bidId and bid_id row shapes)', () => {
    expect(pinKey(bidPin)).not.toBe(pinKey(tabPin))
    expect(pinKey({ path: '/bids', tab: 'pricing', bid_id: 'bid-1' })).toBe(pinKey(bidPin))
  })

  it('computeReorderedSort keeps two same-tab bid pins distinct', () => {
    const rows = [
      { path: '/bids', tab: 'pricing', bid_id: 'bid-1', sort_order: 0 },
      { path: '/bids', tab: 'pricing', bid_id: 'bid-2', sort_order: 1 },
      { path: '/jobs', tab: null, bid_id: null, sort_order: 2 },
    ]
    const out = computeReorderedSort(
      [
        { path: '/bids', tab: 'pricing', bidId: 'bid-2' },
        { path: '/jobs', tab: null },
      ],
      rows,
    )
    expect(out).toEqual([
      { path: '/bids', tab: 'pricing', bid_id: 'bid-2', sort_order: 0 },
      { path: '/jobs', tab: null, bid_id: null, sort_order: 1 },
      { path: '/bids', tab: 'pricing', bid_id: 'bid-1', sort_order: 2 },
    ])
  })
})
