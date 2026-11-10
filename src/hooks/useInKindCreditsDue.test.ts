// @vitest-environment jsdom
/**
 * The Needs you line for in-kind credit (punch list #301, PR 3): quiet until asked and on a refused read, the months
 * with no line through the kernel, and read again when a deal or a line changes anywhere.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { IN_KIND_CHANGED_EVENT, type InKindDealForDue } from '../lib/inKind/inKindCreditsDue'
import { useInKindCreditsDue } from './useInKindCreditsDue'

const deal = (lines: InKindDealForDue['lines'] = []): InKindDealForDue => ({
  arrangement: { id: 'a1', customer_id: 'c1', partner_name: 'Calloway Holdings', what_given: 'Rent credit', note: '', monthly_amount: 1500, monthly_due: 3000, bank_payee: 'Calloway', starts_on: '2026-11-01', ended_at: null },
  lines,
  jobs: [{ id: 'j1', status: 'billed', revenue: 9000, payments_made: 0 }],
  bank: [{ id: 't1', day: '2026-11-03', amount: 1500, name: 'Calloway Holdings LLC' }],
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-10T18:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('useInKindCreditsDue', () => {
  it('reads nothing until it is enabled', () => {
    const loadDeals = vi.fn(() => Promise.resolve([deal()]))
    const io = { loadDeals }
    const { result } = renderHook(() => useInKindCreditsDue(false, io))
    expect(result.current.credits).toBeNull()
    expect(loadDeals).not.toHaveBeenCalled()
  })

  it('gives the months with no line and the credit each will suggest', async () => {
    const io = { loadDeals: () => Promise.resolve([deal()]) }
    const { result } = renderHook(() => useInKindCreditsDue(true, io))
    await waitFor(() => expect(result.current.credits).not.toBeNull())
    expect(result.current.credits).toEqual({ due: [{ arrangementId: 'a1', customerId: 'c1', partner: 'Calloway Holdings', month: '2026-11-01', amount: 1500 }], total: 1500 })
  })

  it('stays quiet on a refused read', async () => {
    const loadDeals = vi.fn(() => Promise.reject(new Error('permission denied')))
    const io = { loadDeals }
    const { result } = renderHook(() => useInKindCreditsDue(true, io))
    await waitFor(() => expect(loadDeals).toHaveBeenCalled())
    expect(result.current.credits).toBeNull()
  })

  it('reads again when a line lands anywhere in the app', async () => {
    const entered = [{ id: 'l1', arrangement_id: 'a1', given_on: '2026-11-03', amount: 1500, memo: 'Rent credit', cost_job_id: null, for_month: '2026-11-01', removed_at: null }]
    const loadDeals = vi.fn().mockResolvedValueOnce([deal()]).mockResolvedValueOnce([deal(entered)])
    const io = { loadDeals } // one object, as the app's own io is: a new one each render would read again each render
    const { result } = renderHook(() => useInKindCreditsDue(true, io))
    await waitFor(() => expect(result.current.credits?.due.length).toBe(1))
    act(() => {
      window.dispatchEvent(new Event(IN_KIND_CHANGED_EVENT))
    })
    await waitFor(() => expect(result.current.credits?.due.length).toBe(0))
    expect(loadDeals).toHaveBeenCalledTimes(2)
  })
})
