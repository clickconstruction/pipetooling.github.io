// @vitest-environment jsdom
/**
 * The app activity heartbeat while View as is on. A dev looking as a teammate is signed in as that
 * teammate, so every bump would land on the teammate's own activity row. The hook sends none of
 * them: not the one on mount, not the timed one, not the ones a page change, a hidden tab, a closed
 * page or an unmount flush. The flag is read at each send, so a minute scheduled before the
 * imitation began is held, and the sends start again once it is over.
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

import { IMPERSONATION_ORIGINAL_STORAGE_KEY } from '../lib/impersonationSession'
import { useAppActivityHeartbeat } from './useAppActivityHeartbeat'

let visibility: 'visible' | 'hidden' = 'visible'

function setVisibility(next: 'visible' | 'hidden') {
  visibility = next
  document.dispatchEvent(new Event('visibilitychange'))
}

const viewAs = (on: boolean) => {
  if (on) localStorage.setItem(IMPERSONATION_ORIGINAL_STORAGE_KEY, JSON.stringify({ access_token: 'a', refresh_token: 'r' }))
  else localStorage.removeItem(IMPERSONATION_ORIGINAL_STORAGE_KEY)
}

const mount = (page = 'dashboard') =>
  renderHook(({ pageKey }: { pageKey: string }) => useAppActivityHeartbeat('user-1', pageKey), { initialProps: { pageKey: page } })

describe('useAppActivityHeartbeat and View as', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-21T15:00:00Z'))
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

  it('as yourself: seen on mount, a minute a minute, and the part of a minute on a page change', () => {
    const view = mount('dashboard')
    expect(h.bumps).toEqual([{ fn: 'bump_user_app_activity', args: { p_seconds: 0 } }])

    vi.advanceTimersByTime(60_000)
    expect(h.bumps[1]).toEqual({ fn: 'bump_user_app_activity', args: { p_seconds: 60, p_page: 'dashboard' } })

    vi.advanceTimersByTime(20_000)
    view.rerender({ pageKey: 'jobs' })
    expect(h.bumps[2]).toEqual({ fn: 'bump_user_app_activity', args: { p_seconds: 20, p_page: 'dashboard' } })
    // The new page starts its own clock, and more than a minute after the last one sends a seen bump.
    expect(h.bumps[3]).toEqual({ fn: 'bump_user_app_activity', args: { p_seconds: 0 } })
    expect(h.bumps).toHaveLength(4)
  })

  it('while View as is on sends nothing: mount, the minute, a page change, a hidden tab, a closed page, an unmount', () => {
    viewAs(true)
    const view = mount('dashboard')
    expect(h.bumps).toEqual([])

    vi.advanceTimersByTime(60_000)
    vi.advanceTimersByTime(60_000)
    expect(h.bumps).toEqual([])

    // A page change flushes the part of a minute spent on the old page.
    vi.advanceTimersByTime(20_000)
    view.rerender({ pageKey: 'jobs' })
    expect(h.bumps).toEqual([])

    // The tab is hidden, then shown again more than a minute later: a flush, then a seen bump.
    vi.advanceTimersByTime(20_000)
    setVisibility('hidden')
    vi.advanceTimersByTime(90_000)
    setVisibility('visible')
    expect(h.bumps).toEqual([])

    // The page is closed, then the hook unmounts.
    vi.advanceTimersByTime(20_000)
    window.dispatchEvent(new Event('pagehide'))
    setVisibility('visible')
    vi.advanceTimersByTime(20_000)
    view.unmount()
    expect(h.bumps).toEqual([])
  })

  it('holds a minute that was scheduled before the imitation began, and sends again once it is over', () => {
    mount('dashboard')
    expect(h.bumps).toHaveLength(1)

    viewAs(true)
    vi.advanceTimersByTime(60_000)
    vi.advanceTimersByTime(60_000)
    expect(h.bumps).toHaveLength(1)

    viewAs(false)
    vi.advanceTimersByTime(60_000)
    expect(h.bumps).toHaveLength(2)
    expect(h.bumps[1]).toEqual({ fn: 'bump_user_app_activity', args: { p_seconds: 60, p_page: 'dashboard' } })
  })
})
