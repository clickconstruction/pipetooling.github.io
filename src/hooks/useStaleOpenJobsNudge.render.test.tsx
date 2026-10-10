// @vitest-environment jsdom
/**
 * The stale open jobs nudge and ZZ test jobs (punch list #61, v2.5122): a ZZ job leaves the count and the
 * contract dollars, by its name or the shared ids; without the option it counts as before. Made-up jobs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const idle = (id: string, name: string, customer: string, revenue: number) => ({
  id, hcp_number: id, click_number: null, job_name: name, customer_name: customer, status: 'working',
  last_work_date: '2026-08-01', created_at: '2026-07-01T00:00:00Z', revenue, master_user_id: 'u-m',
})
const ROWS = [idle('A', '101 Hill Street', 'Ann Lee', 900), idle('Z', 'ZZ TEST idle', 'Ann Lee', 2200), idle('Y', 'Hill Street remodel', 'ZZ Test Customer', 300)]
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => {
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'not']) chain[m] = () => chain
      chain.then = (resolve: (v: unknown) => void) => resolve({ data: ROWS, error: null })
      return chain
    },
  },
}))
const loadIds = vi.fn(async (_u: unknown) => new Set(['Z', 'Y']))
vi.mock('../lib/jobs/zzTestJobRows', () => ({ loadZzTestJobIds: (u: unknown) => loadIds(u) }))

const { useStaleOpenJobsNudge } = await import('./useStaleOpenJobsNudge')

beforeEach(() => loadIds.mockClear())

describe('useStaleOpenJobsNudge · ZZ test jobs', () => {
  it('without the option, counts every idle job and never asks for the ids', async () => {
    const { result } = renderHook(() => useStaleOpenJobsNudge(true, 'u-ann', false))
    await waitFor(() => expect(result.current.nudge).not.toBeNull())
    expect(result.current.nudge).toMatchObject({ count: 3, total: 3400 })
    expect(loadIds).not.toHaveBeenCalled()
  })

  it('with it, the ZZ jobs leave the count and the dollars', async () => {
    const { result } = renderHook(() => useStaleOpenJobsNudge(true, 'u-ann', true))
    await waitFor(() => expect(result.current.nudge).not.toBeNull())
    expect(result.current.nudge).toMatchObject({ count: 1, total: 900 })
    expect(loadIds).toHaveBeenCalledWith('u-ann')
  })
})
