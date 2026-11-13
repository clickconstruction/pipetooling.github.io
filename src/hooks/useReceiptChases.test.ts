// @vitest-environment jsdom
/**
 * The Needs you line's count for the receipt kind (punch list #299, the step after PR 2): the deck's own rows through
 * the same kernel, quiet until asked and on a refused read, and read again when a Got it lands anywhere.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { RECEIPT_CHASE_CHANGED_EVENT, type ReceiptChaseSource } from '../lib/needsYou/fillInReceipts'
import { useReceiptChases } from './useReceiptChases'

const source = (id: string, why: string): ReceiptChaseSource => ({ request_id: id, mercury_transaction_id: `c-${id}`, why, holder_user_id: null, holder_name: 'Jordan Vance', store: 'Ridgeway Supply', amount: 10, posted_at: null, texted_at: null, reminded_at: null, closes_at: null })

afterEach(cleanup)

describe('useReceiptChases', () => {
  it('counts the rows by reason and reads again when a Got it lands', async () => {
    let rows = [source('a', 'no_cell'), source('b', 'no_answer'), source('c', 'no_answer')]
    const io = { fetchSources: vi.fn(async () => rows) }
    const { result } = renderHook(() => useReceiptChases(true, io))
    await waitFor(() => expect(result.current.chases?.count).toBe(3))
    expect(result.current.chases?.byWhy).toMatchObject({ no_cell: 1, no_answer: 2 })
    rows = [source('a', 'no_cell')]
    act(() => {
      window.dispatchEvent(new Event(RECEIPT_CHASE_CHANGED_EVENT))
    })
    await waitFor(() => expect(result.current.chases?.count).toBe(1))
    expect(io.fetchSources).toHaveBeenCalledTimes(2)
  })

  it('is quiet until asked, and on a read the database refuses', async () => {
    const io = { fetchSources: vi.fn(async () => [source('a', 'no_cell')]) }
    const off = renderHook(() => useReceiptChases(false, io))
    await act(async () => {})
    expect(off.result.current.chases).toBeNull()
    expect(io.fetchSources).not.toHaveBeenCalled()
    // A database one step behind the app has no such function yet.
    const behind = { fetchSources: vi.fn(async () => Promise.reject(new Error('Could not find the function public.receipt_requests_to_chase'))) }
    const refused = renderHook(() => useReceiptChases(true, behind))
    await waitFor(() => expect(behind.fetchSources).toHaveBeenCalled())
    expect(refused.result.current.chases).toBeNull()
  })
})
