// @vitest-environment jsdom
/**
 * Regression test for the sign-in role gate (v2.1485): the exported `loading`
 * must stay true from session-resolved until the role row lands, so the app
 * never renders a signed-in frame with role=null (the "flash of primary-role
 * pinned tabs" bug). Token refreshes for the same user must NOT re-raise the
 * gate mid-session, and one that finds no signal must not drop the role the
 * app already has (punch list #163's live test, v2.6198).
 */
import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

type SessionPayload = { data: { session: { user: { id: string }; expires_at?: number } | null }; error: null }
type RolePayload = { data: Record<string, unknown> | null; error: { message: string; code?: string } | null; status?: number }

let resolveSession: (v: SessionPayload) => void = () => {}
let resolveRole: (v: RolePayload) => void = () => {}
let roleReads = 0
let authCallback: ((event: string, session: unknown) => void) | null = null

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
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
          single: () => {
            roleReads += 1
            return new Promise((res) => {
              resolveRole = res
            })
          },
        }),
      }),
    }),
  },
}))

import { AuthProvider, useAuth } from './useAuth'
import { ROLE_READ_RETRY_MS } from '../lib/appHealth'

const wrapper = ({ children }: { children: ReactNode }) => createElement(AuthProvider, null, children)

const SESSION: SessionPayload = {
  data: { session: { user: { id: 'user-1' }, expires_at: Math.floor(Date.now() / 1000) + 3600 } },
  error: null,
}
const ROLE_ROW: RolePayload = {
  data: { name: 'Robert', role: 'dev', estimator_prospects_access: false, team_prospects_access: false, read_only: false },
  error: null,
}

describe('useAuth role gate', () => {
  it('holds loading through the role fetch, then releases; same-user auth events do not re-raise it', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    // 1. Session pending → loading.
    expect(result.current.loading).toBe(true)

    // 2. Session resolves → user is known but the role row is in flight: still loading.
    await act(async () => {
      resolveSession(SESSION)
    })
    await waitFor(() => expect(result.current.user?.id).toBe('user-1'))
    expect(result.current.role).toBeNull()
    expect(result.current.loading).toBe(true)

    // 3. Role lands → gate drops.
    await act(async () => {
      resolveRole(ROLE_ROW)
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.role).toBe('dev')

    // 4. A token-refresh auth event for the same user refetches in the
    //    background without flashing the loading screen.
    await act(async () => {
      authCallback?.('TOKEN_REFRESHED', SESSION.data.session)
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.role).toBe('dev')
  })

  it('an auth event with no signal keeps the role and the name, and reads them again (punch list #163 live test)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await act(async () => {
        resolveSession(SESSION)
      })
      await waitFor(() => expect(result.current.user?.id).toBe('user-1'))
      await act(async () => {
        resolveRole(ROLE_ROW)
      })
      await waitFor(() => expect(result.current.role).toBe('dev'))
      expect(result.current.profileName).toBe('Robert')

      // The page comes back to the front, or another tab renews the sign-in: auth-js announces the session
      // again and the role is read again. The phone has no signal, so the read fails at the fetch layer,
      // the way supabase-js answers a rejected fetch.
      const readsBefore = roleReads
      await act(async () => {
        authCallback?.('SIGNED_IN', SESSION.data.session)
      })
      expect(roleReads).toBe(readsBefore + 1)
      await act(async () => {
        resolveRole({ data: null, error: { message: 'TypeError: Failed to fetch', code: '' }, status: 0 })
      })
      // The Dashboard's clock row and the header's role buttons hang on the role, a note's author on the name.
      expect(result.current.role).toBe('dev')
      expect(result.current.profileName).toBe('Robert')
      expect(result.current.loading).toBe(false)

      // It reads again by itself, and the read that lands stands.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ROLE_READ_RETRY_MS)
      })
      expect(roleReads).toBe(readsBefore + 2)
      await act(async () => {
        resolveRole({ data: { ...ROLE_ROW.data, name: 'Robert Douglas' }, error: null })
      })
      await waitFor(() => expect(result.current.profileName).toBe('Robert Douglas'))
      expect(result.current.role).toBe('dev')
    } finally {
      vi.useRealTimers()
    }
  })

  it('another person signing in with no signal never wears the last person’s role or name', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      resolveSession(SESSION)
    })
    await waitFor(() => expect(result.current.user?.id).toBe('user-1'))
    await act(async () => {
      resolveRole(ROLE_ROW)
    })
    await waitFor(() => expect(result.current.role).toBe('dev'))

    await act(async () => {
      authCallback?.('SIGNED_IN', { user: { id: 'user-2' }, expires_at: SESSION.data.session?.expires_at })
    })
    expect(result.current.user?.id).toBe('user-2')
    expect(result.current.role).toBeNull()
    expect(result.current.profileName).toBeNull()
    await act(async () => {
      resolveRole({ data: null, error: { message: 'TypeError: Failed to fetch', code: '' }, status: 0 })
    })
    expect(result.current.role).toBeNull()
    expect(result.current.profileName).toBeNull()
  })

  it('does not gate the signed-out path', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      resolveSession({ data: { session: null }, error: null })
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeNull()
    expect(result.current.role).toBeNull()
  })
})
