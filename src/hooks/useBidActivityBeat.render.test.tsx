// @vitest-environment jsdom
/**
 * The beat that says a person was at work on a bid (punch list #445). A minute at work on a bid sends a minute. A
 * tab left in front with nobody at it stops counting five minutes after the last press. Leaving the bid sends the
 * part of a minute, and a glance sends nothing. No bid in front, nobody signed in and View as send nothing at all.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'

const h = vi.hoisted(() => ({ bumps: [] as { fn: string; args: Record<string, unknown> }[] }))

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      h.bumps.push({ fn, args })
      return Promise.resolve({ data: null, error: null })
    },
  },
}))

import { bidInFrontKey, type BidInFront } from '../lib/bids/bidInFront'
import { IMPERSONATION_ORIGINAL_STORAGE_KEY } from '../lib/impersonationSession'
import { useBidActivityBeat } from './useBidActivityBeat'

const B1 = '0b1d0000-0000-4000-8000-00000000b412'
const B2 = '0b1d0000-0000-4000-8000-00000000b398'

let visibility: 'visible' | 'hidden' = 'visible'
function setVisibility(next: 'visible' | 'hidden') {
  visibility = next
  document.dispatchEvent(new Event('visibilitychange'))
}
const press = () => window.dispatchEvent(new Event('pointerdown'))
const beat = (bid: string, tab: string, seconds: number) => ({ fn: 'bump_user_bid_activity', args: { p_bid: bid, p_tab: tab, p_seconds: seconds } })

const mount = (front: BidInFront | null, signedIn = true) =>
  renderHook(({ f }: { f: BidInFront | null }) => useBidActivityBeat(signedIn ? 'user-1' : undefined, f, bidInFrontKey(f)), { initialProps: { f: front } })

describe('useBidActivityBeat', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-25T15:00:00Z'))
    h.bumps.length = 0
    localStorage.clear()
    visibility = 'visible'
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    localStorage.clear()
  })

  it('sends a minute for a minute at work on a bid, and nothing on opening it', () => {
    mount({ bidId: B1, tab: 'pricing' })
    expect(h.bumps).toEqual([])
    vi.advanceTimersByTime(60_000)
    expect(h.bumps).toEqual([beat(B1, 'pricing', 60)])
  })

  it('stops counting five minutes after the last press, and starts again on the next one', () => {
    mount({ bidId: B1, tab: 'pricing' })
    vi.advanceTimersByTime(5 * 60_000)
    expect(h.bumps).toHaveLength(5)
    vi.advanceTimersByTime(3 * 60_000)
    expect(h.bumps).toHaveLength(5)
    press()
    vi.advanceTimersByTime(60_000)
    expect(h.bumps).toHaveLength(6)
    expect(h.bumps[5]).toEqual(beat(B1, 'pricing', 60))
  })

  it('sends the part of a minute when the bid changes, to the bid that was in front', () => {
    const view = mount({ bidId: B1, tab: 'pricing' })
    vi.advanceTimersByTime(20_000)
    view.rerender({ f: { bidId: B2, tab: 'counts' } })
    expect(h.bumps).toEqual([beat(B1, 'pricing', 20)])
    vi.advanceTimersByTime(60_000)
    expect(h.bumps[1]).toEqual(beat(B2, 'counts', 60))
  })

  it('sends nothing for a glance under five seconds', () => {
    const view = mount({ bidId: B1, tab: 'pricing' })
    vi.advanceTimersByTime(4_000)
    view.rerender({ f: null })
    expect(h.bumps).toEqual([])
  })

  it('sends the part of a minute when the tab is hidden, and counts again when it is back', () => {
    mount({ bidId: B1, tab: 'takeoffs' })
    vi.advanceTimersByTime(30_000)
    setVisibility('hidden')
    expect(h.bumps).toEqual([beat(B1, 'takeoffs', 30)])
    vi.advanceTimersByTime(10 * 60_000)
    expect(h.bumps).toHaveLength(1)
    setVisibility('visible')
    vi.advanceTimersByTime(60_000)
    expect(h.bumps[1]).toEqual(beat(B1, 'takeoffs', 60))
  })

  it('sends nothing with no bid in front or nobody signed in', () => {
    mount(null)
    mount({ bidId: B1, tab: 'pricing' }, false)
    vi.advanceTimersByTime(5 * 60_000)
    expect(h.bumps).toEqual([])
  })

  it('sends nothing while View as is on', () => {
    localStorage.setItem(IMPERSONATION_ORIGINAL_STORAGE_KEY, JSON.stringify({ access_token: 'a', refresh_token: 'r' }))
    const view = mount({ bidId: B1, tab: 'pricing' })
    vi.advanceTimersByTime(2 * 60_000)
    view.unmount()
    expect(h.bumps).toEqual([])
  })
})
