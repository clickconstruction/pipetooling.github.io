/**
 * The way back from View as: the dev's session is put back, or this browser is signed out. On no
 * path does the flag come off while the page is still signed in as the person.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: {} }))

import { leaveViewAs, VIEW_AS_SIGN_IN_PATH, VIEW_AS_SIGNED_OUT_WORDS, type ViewAsExitIo } from './impersonationExit'

const ORIGIN = 'https://app.example'
const TOKENS = { access_token: 'a', refresh_token: 'r' }
const STASH = JSON.stringify({ ...TOKENS, returnTo: `${ORIGIN}/jobs?tab=stages` })

/** An io that records the order of what the kernel does. */
function rig(over: Partial<ViewAsExitIo> = {}) {
  const calls: string[] = []
  const io: ViewAsExitIo = {
    raw: STASH,
    origin: ORIGIN,
    setSession: async () => {
      calls.push('setSession')
      return { error: null }
    },
    signOutHere: async () => {
      calls.push('signOutHere')
      return { error: null }
    },
    forgetSessionHere: () => calls.push('forgetSessionHere'),
    clearStash: () => calls.push('clearStash'),
    leaveReason: () => calls.push('leaveReason'),
    go: (path) => calls.push(`go ${path}`),
    ...over,
  }
  return { io, calls }
}

describe('leaveViewAs', () => {
  it('does nothing when nobody is being viewed as', async () => {
    const { io, calls } = rig({ raw: null })
    expect(await leaveViewAs(io)).toEqual({ kind: 'not_viewing' })
    expect(calls).toEqual([])
  })

  it('puts the dev’s session back, then takes the flag off, then returns to the page left', async () => {
    const setSession = vi.fn(async () => ({ error: null }))
    const { io, calls } = rig({ setSession })
    expect(await leaveViewAs(io)).toEqual({ kind: 'back', path: '/jobs?tab=stages' })
    expect(setSession).toHaveBeenCalledWith(TOKENS)
    expect(calls).toEqual(['clearStash', 'go /jobs?tab=stages'])
  })

  it('keeps the flag on while the swap has not answered', async () => {
    let answer: (v: { error: unknown }) => void = () => {}
    const { io, calls } = rig({ setSession: () => new Promise((resolve) => (answer = resolve)) })
    const leaving = leaveViewAs(io)
    await Promise.resolve()
    expect(calls).toEqual([])
    answer({ error: null })
    await leaving
    expect(calls).toEqual(['clearStash', 'go /jobs?tab=stages'])
  })

  it('signs this browser out when the swap answers with a refusal', async () => {
    const { io, calls } = rig({
      setSession: async () => ({ error: { message: 'Invalid Refresh Token: Already Used' } }),
    })
    expect(await leaveViewAs(io)).toEqual({ kind: 'signed_out' })
    // Never the page left: the session there would still be the person's.
    expect(calls).toEqual(['signOutHere', 'forgetSessionHere', 'clearStash', 'leaveReason', `go ${VIEW_AS_SIGN_IN_PATH}`])
  })

  it('signs this browser out when the swap throws', async () => {
    const { io, calls } = rig({
      setSession: async () => {
        throw new TypeError('Failed to fetch')
      },
    })
    expect(await leaveViewAs(io)).toEqual({ kind: 'signed_out' })
    expect(calls).toEqual(['signOutHere', 'forgetSessionHere', 'clearStash', 'leaveReason', `go ${VIEW_AS_SIGN_IN_PATH}`])
  })

  it('signs this browser out when the stash holds no session to put back', async () => {
    const setSession = vi.fn(async () => ({ error: null }))
    const { io, calls } = rig({ raw: JSON.stringify({ returnTo: `${ORIGIN}/jobs` }), setSession })
    expect(await leaveViewAs(io)).toEqual({ kind: 'signed_out' })
    expect(setSession).not.toHaveBeenCalled()
    expect(calls).toEqual(['signOutHere', 'forgetSessionHere', 'clearStash', 'leaveReason', `go ${VIEW_AS_SIGN_IN_PATH}`])
  })

  it('signs this browser out when the stash cannot be read', async () => {
    const { io, calls } = rig({ raw: '{not json' })
    expect(await leaveViewAs(io)).toEqual({ kind: 'signed_out' })
    expect(calls).toEqual(['signOutHere', 'forgetSessionHere', 'clearStash', 'leaveReason', `go ${VIEW_AS_SIGN_IN_PATH}`])
  })

  it('leaves the sign-in page its reason on a sign-out, and none when the dev is back', async () => {
    const leaveReason = vi.fn()
    const out = rig({ setSession: async () => ({ error: new Error('refused') }), leaveReason })
    await leaveViewAs(out.io)
    expect(leaveReason).toHaveBeenCalledWith(VIEW_AS_SIGNED_OUT_WORDS)
    expect(VIEW_AS_SIGNED_OUT_WORDS).toContain('Sign in again.')

    const kept = vi.fn()
    const back = rig({ leaveReason: kept })
    await leaveViewAs(back.io)
    expect(kept).not.toHaveBeenCalled()
  })

  it('still loads the sign-in page when the reason cannot be left', async () => {
    const { io, calls } = rig({
      setSession: async () => ({ error: new Error('refused') }),
      leaveReason: () => {
        throw new Error('QuotaExceededError')
      },
    })
    expect(await leaveViewAs(io)).toEqual({ kind: 'signed_out' })
    expect(calls).toEqual(['signOutHere', 'forgetSessionHere', 'clearStash', `go ${VIEW_AS_SIGN_IN_PATH}`])
  })

  it('still drops the stored sign-in when the sign-out itself fails', async () => {
    const refused = rig({
      setSession: async () => ({ error: new Error('refused') }),
      signOutHere: async () => {
        refused.calls.push('signOutHere')
        return { error: new Error('offline') }
      },
    })
    expect(await leaveViewAs(refused.io)).toEqual({ kind: 'signed_out' })
    expect(refused.calls).toEqual(['signOutHere', 'forgetSessionHere', 'clearStash', 'leaveReason', `go ${VIEW_AS_SIGN_IN_PATH}`])

    const thrown = rig({
      setSession: async () => ({ error: new Error('refused') }),
      signOutHere: async () => {
        thrown.calls.push('signOutHere')
        throw new TypeError('Failed to fetch')
      },
    })
    expect(await leaveViewAs(thrown.io)).toEqual({ kind: 'signed_out' })
    expect(thrown.calls).toEqual(['signOutHere', 'forgetSessionHere', 'clearStash', 'leaveReason', `go ${VIEW_AS_SIGN_IN_PATH}`])
  })
})
