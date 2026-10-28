// @vitest-environment jsdom
/**
 * The kept reads' clearing (#183 PR 2, v2.6031): nobody signed in once auth settled, or another
 * account than before, clears the store; a cold open still loading, or the same person, never does.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const clearKept = vi.fn(async () => {})
vi.mock('../lib/keptReadStore', () => ({ clearKeptReads: () => clearKept() }))

const { useKeptReadsClearedOnAccountChange } = await import('./useKeptReadsCleared')

type P = { userId: string | null; settled: boolean }
const render = (p: P) => renderHook((x: P) => useKeptReadsClearedOnAccountChange(x.userId, x.settled), { initialProps: p })

beforeEach(() => clearKept.mockClear())

describe('useKeptReadsClearedOnAccountChange', () => {
  it('does nothing while auth is loading, nothing once the same person is in, and clears when they sign out', () => {
    const { rerender } = render({ userId: null, settled: false })
    expect(clearKept).not.toHaveBeenCalled()
    rerender({ userId: 'u1', settled: true })
    expect(clearKept).not.toHaveBeenCalled()
    rerender({ userId: 'u1', settled: true })
    expect(clearKept).not.toHaveBeenCalled()
    rerender({ userId: null, settled: true })
    expect(clearKept).toHaveBeenCalledTimes(1)
  })

  it('clears on the sign-in page, where nobody is signed in once auth settled', () => {
    render({ userId: null, settled: true })
    expect(clearKept).toHaveBeenCalledTimes(1)
  })

  it('clears on an account switch, which is what impersonation starting or ending is', () => {
    const { rerender } = render({ userId: 'dev', settled: true })
    rerender({ userId: 'assistant', settled: true })
    expect(clearKept).toHaveBeenCalledTimes(1)
    rerender({ userId: 'dev', settled: true })
    expect(clearKept).toHaveBeenCalledTimes(2)
  })
})
