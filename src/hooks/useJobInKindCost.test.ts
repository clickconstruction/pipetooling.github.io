// @vitest-environment jsdom
/**
 * The in-kind lines put on a job (punch list #301, PR 4): empty with no job and on a refused read, the lines once
 * read, and read again when a line changes anywhere in the app.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { IN_KIND_CHANGED_EVENT } from '../lib/inKind/inKindCreditsDue'
import { useJobInKindCost } from './useJobInKindCost'

const line = { id: 'l1', givenOn: '2026-10-22', amount: 1475, memo: '10 yards', partner: 'Lone Oak Concrete', costJobId: 'oak' }

afterEach(() => cleanup())

describe('useJobInKindCost', () => {
  it('reads nothing with no job', () => {
    const load = vi.fn(() => Promise.resolve([line]))
    const { result } = renderHook(() => useJobInKindCost(null, load))
    expect(result.current.lines).toEqual([])
    expect(load).not.toHaveBeenCalled()
  })
  it('gives the lines put on the job', async () => {
    const load = vi.fn(() => Promise.resolve([line]))
    const { result } = renderHook(() => useJobInKindCost('oak', load))
    await waitFor(() => expect(result.current.lines).toEqual([line]))
    expect(load).toHaveBeenCalledWith('oak')
  })
  it('stays empty on a refused read', async () => {
    const load = vi.fn(() => Promise.reject(new Error('permission denied')))
    const { result } = renderHook(() => useJobInKindCost('oak', load))
    await waitFor(() => expect(load).toHaveBeenCalled())
    expect(result.current.lines).toEqual([])
  })
  it('reads again when a line changes anywhere in the app', async () => {
    const load = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([line])
    const { result } = renderHook(() => useJobInKindCost('oak', load))
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1))
    act(() => {
      window.dispatchEvent(new Event(IN_KIND_CHANGED_EVENT))
    })
    await waitFor(() => expect(result.current.lines).toEqual([line]))
  })
})
