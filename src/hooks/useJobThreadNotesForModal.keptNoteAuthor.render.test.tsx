// @vitest-environment jsdom
/**
 * Punch list #163's live test (2026-10-30): a note written in the job window with no signal read *Unknown* as its
 * author until it landed. The kept note's row on the thread carries the name `useAuth` read, and an auth event with
 * no signal (the page coming back to the front, another tab renewing the sign-in) read that name again, failed at
 * the fetch layer and dropped it. A lost signal is not a missing name, so the row carries the signed-in person's.
 * The real `AuthProvider` runs here, under the job window's own wiring of the hook (`DetailJobModal`).
 */
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

const net = { up: true }
let authCallback: ((event: string, session: unknown) => void) | null = null
const SESSION = { user: { id: 'user-1' }, expires_at: Math.floor(Date.now() / 1000) + 3600 }

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  const usersRead = () => {
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.eq = () => b
    b.single = () =>
      Promise.resolve(
        net.up
          ? { data: { name: 'Robert', role: 'master_technician', estimator_prospects_access: false, team_prospects_access: false, read_only: false }, error: null, status: 200 }
          : // supabase-js's answer to a rejected fetch.
            { data: null, error: { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' }, status: 0 },
      )
    return b
  }
  return {
    supabase: {
      ...stub,
      from: (table: string) => (table === 'users' ? usersRead() : stub.from()),
      auth: {
        ...stub.auth,
        getSession: () => Promise.resolve({ data: { session: SESSION }, error: null }),
        onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
          authCallback = cb
          return { data: { subscription: { unsubscribe: () => {} } } }
        },
        signOut: () => Promise.resolve({ error: null }),
        refreshSession: () => Promise.resolve({ data: { session: null }, error: null }),
      },
    },
  }
})

import { AuthProvider, useAuth } from './useAuth'
import { useJobThreadNotesForModal } from './useJobThreadNotesForModal'

const wrapper = ({ children }: { children: ReactNode }) => createElement(AuthProvider, null, children)

/** Stable, as the toast context's is: the hook reads the thread again whenever it changes. */
const showToast = () => {}

/** The job window's wiring (`DetailJobModal`): the note's author is the signed-in person's name. */
function useJobWindowThread() {
  const { user, profileName } = useAuth()
  const thread = useJobThreadNotesForModal('job-1', true, {
    authUserId: user?.id,
    showToast,
    authorDisplayName: user?.id ? profileName : undefined,
  })
  return { profileName, thread }
}

afterEach(() => {
  net.up = true
  delete (window.navigator as { onLine?: boolean }).onLine
})

describe('a note kept on the phone', () => {
  it('carries the signed-in name on the thread after an auth event with no signal', async () => {
    const { result } = renderHook(() => useJobWindowThread(), { wrapper })
    await waitFor(() => expect(result.current.profileName).toBe('Robert'))

    // No signal: the browser says offline, and the auth event's read of the name fails at the fetch layer.
    net.up = false
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => false })
    await act(async () => {
      authCallback?.('SIGNED_IN', SESSION)
    })

    let kept = false
    await act(async () => {
      kept = await result.current.thread.submitNoteWithBody('Rough-in done in the kitchen', 'draft')
    })
    expect(kept).toBe(true)
    const row = result.current.thread.activity.find((i) => i.kind === 'note' && i.note.body === 'Rough-in done in the kitchen')
    // The panel draws `author.name`, or *Unknown* without one.
    expect(row?.kind === 'note' ? row.note.author?.name : 'no row').toBe('Robert')
  })
})
