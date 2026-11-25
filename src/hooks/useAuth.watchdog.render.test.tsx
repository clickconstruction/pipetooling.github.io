// @vitest-environment jsdom
/**
 * The sign-in gate's 8-second watchdog (v2.1051) and a session the auth listener has already handed over
 * (punch list #406). The simulator's sitting of 2026-11-25 pressed Hard Reload while signed in and was drawn the
 * sign-in page at 8.3 s, then the Dashboard and not the page it was on. `getSession()` was still waiting on the
 * sign-in lock, which a renewal held, while auth-js had already told the listener the session. The watchdog
 * knew only `getSession()`'s own answer, so at 8 s it wiped the person the listener had delivered.
 */
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

type SessionPayload = { data: { session: { user: { id: string }; expires_at?: number } | null }; error: null }
type RolePayload = { data: Record<string, unknown> | null; error: null }

let resolveSession: (v: SessionPayload) => void = () => {}
let resolveRole: (v: RolePayload) => void = () => {}
let authCallback: ((event: string, session: unknown) => void) | null = null

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      // The sign-in lock is held: this answers only when a case says so.
      getSession: () =>
        new Promise((res) => {
          resolveSession = res
        }),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        authCallback = cb
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
      signOut: () => Promise.resolve({ error: null }),
      refreshSession: () => Promise.resolve({ data: { session: null }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () =>
            new Promise((res) => {
              resolveRole = res
            }),
        }),
      }),
    }),
  },
}))

import { AuthProvider, useAuth } from './useAuth'

const wrapper = ({ children }: { children: ReactNode }) => createElement(AuthProvider, null, children)
const SESSION = { user: { id: 'user-1' }, expires_at: Math.floor(Date.now() / 1000) + 3600 }
const ROLE_ROW: RolePayload = { data: { name: 'Robert', role: 'dev', estimator_prospects_access: false, team_prospects_access: false, read_only: false }, error: null }

const run = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useAuth, the 8-second watchdog', () => {
  it('leaves a person the listener has already signed in, though getSession() has not answered', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.loading).toBe(true)

    // 1 s: auth-js recovers the stored session and tells the listener. getSession() still waits on the lock.
    await run(1000)
    await act(async () => {
      authCallback?.('SIGNED_IN', SESSION)
    })
    await act(async () => {
      resolveRole(ROLE_ROW)
    })
    expect(result.current.user?.id).toBe('user-1')
    expect(result.current.role).toBe('dev')

    // 8 s: the watchdog fires. The person stays, with their role, and the gate opens on the app.
    await run(7500)
    expect(result.current.user?.id).toBe('user-1')
    expect(result.current.role).toBe('dev')
    expect(result.current.profileName).toBe('Robert')
    expect(result.current.loading).toBe(false)

    // The lock lets go and getSession() answers at last: nothing flashes, nobody changes.
    await act(async () => {
      resolveSession({ data: { session: SESSION }, error: null })
    })
    expect(result.current.user?.id).toBe('user-1')
    expect(result.current.role).toBe('dev')
    expect(result.current.loading).toBe(false)
  })

  it('still gives up on a start-up that told it nothing: signed out at 8 s, and a late session signs the person in behind the role gate', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await run(7900)
    expect(result.current.loading).toBe(true)
    await run(200)
    expect(result.current.user).toBeNull()
    expect(result.current.loading).toBe(false)

    // getSession() answers late with the person: they are signed in, and the app waits for their role.
    await act(async () => {
      resolveSession({ data: { session: SESSION }, error: null })
    })
    expect(result.current.user?.id).toBe('user-1')
    expect(result.current.role).toBeNull()
    expect(result.current.loading).toBe(true)
    await act(async () => {
      resolveRole(ROLE_ROW)
    })
    expect(result.current.role).toBe('dev')
    expect(result.current.loading).toBe(false)
  })

  it('a listener that said signed in and then signed out leaves nobody for the watchdog to keep', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await run(1000)
    await act(async () => {
      authCallback?.('SIGNED_IN', SESSION)
    })
    await act(async () => {
      resolveRole(ROLE_ROW)
    })
    await act(async () => {
      authCallback?.('SIGNED_OUT', null)
    })
    await run(7500)
    expect(result.current.user).toBeNull()
    expect(result.current.role).toBeNull()
    expect(result.current.loading).toBe(false)
  })
})
