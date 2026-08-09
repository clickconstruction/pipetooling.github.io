// @vitest-environment jsdom
/**
 * Regression test for the sign-in role gate (v2.1485): the exported `loading`
 * must stay true from session-resolved until the role row lands, so the app
 * never renders a signed-in frame with role=null (the "flash of primary-role
 * pinned tabs" bug). Token refreshes for the same user must NOT re-raise the
 * gate mid-session.
 */
import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

type SessionPayload = { data: { session: { user: { id: string }; expires_at?: number } | null }; error: null }
type RolePayload = { data: Record<string, unknown> | null; error: { message: string } | null }

let resolveSession: (v: SessionPayload) => void = () => {}
let resolveRole: (v: RolePayload) => void = () => {}
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
