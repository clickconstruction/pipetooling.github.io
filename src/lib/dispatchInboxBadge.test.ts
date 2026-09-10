import { describe, expect, it } from 'vitest'
import {
  addDispatchBadgeCounts,
  dispatchBadgeAriaLabel,
  dispatchBadgeCount,
  dispatchBadgeCounts,
  dispatchBadgeShownTarget,
  EMPTY_DISPATCH_BADGE_COUNTS,
} from './dispatchInboxBadge'

const rows = [
  { id: 'o1', status: 'open', priority: 'high' },
  { id: 'o2', status: 'open' },
  { id: 'o3', status: 'open' },
  { id: 'c1', status: 'closed' },
  { id: 'c2', status: 'closed' },
  { id: 'c3', status: 'closed' },
]

describe('dispatchBadgeCount', () => {
  it('counts open rows only — the J19 walk saw "7" over "3 open"', () => {
    expect(dispatchBadgeCount(rows)).toBe(3)
  })

  it('is zero for an empty or all-closed list', () => {
    expect(dispatchBadgeCount([])).toBe(0)
    expect(dispatchBadgeCount([{ status: 'closed' }, { status: null }])).toBe(0)
  })
})

describe('dispatchBadgeCounts', () => {
  it('ignores the viewer dismissals for open (dismissal never changes the badge)', () => {
    const dismissed = new Set(['o1', 'c1'])
    expect(dispatchBadgeCounts(rows, dismissed)).toEqual({ open: 3, closed: 2, high: 1 })
  })

  it('closed = closed rows the viewer has not dismissed (what the old badge over-counted)', () => {
    expect(dispatchBadgeCounts(rows)).toEqual({ open: 3, closed: 3, high: 1 })
    expect(dispatchBadgeCounts(rows, new Set(['c1', 'c2', 'c3']))).toEqual({ open: 3, closed: 0, high: 1 })
  })

  it('treats unknown statuses as neither', () => {
    expect(dispatchBadgeCounts([{ id: 'x', status: 'weird' }, { id: 'y', status: null }])).toEqual(EMPTY_DISPATCH_BADGE_COUNTS)
  })
})

describe('addDispatchBadgeCounts / label / telemetry target', () => {
  it('sums dispatch + estimator pairs', () => {
    expect(addDispatchBadgeCounts({ open: 3, closed: 3, high: 1 }, { open: 1, closed: 0, high: 1 })).toEqual({ open: 4, closed: 3, high: 2 })
  })

  it('says "N open", never "unread"', () => {
    expect(dispatchBadgeAriaLabel(4)).toBe('4 open')
    expect(dispatchBadgeAriaLabel(1)).toBe('1 open')
  })

  it('names the customers waiting when there are any (v2.3247)', () => {
    expect(dispatchBadgeAriaLabel(4, 1)).toBe('4 open · 1 customer waiting')
    expect(dispatchBadgeAriaLabel(4, 2)).toBe('4 open · 2 customers waiting')
  })

  it('encodes both counts in the ui_nav_clicks target and clamps junk', () => {
    expect(dispatchBadgeShownTarget({ open: 3, closed: 4, high: 0 })).toBe('#open=3&closed=4')
    expect(dispatchBadgeShownTarget({ open: -1, closed: Number.NaN, high: 0 })).toBe('#open=0&closed=0')
  })
})
