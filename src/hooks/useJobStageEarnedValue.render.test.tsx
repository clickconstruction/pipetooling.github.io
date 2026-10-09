// @vitest-environment jsdom
/** One linked job's earned value by stage (v2.5046): the bid's hours by stage and the job's staged lines, through the kernel. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const rpc = vi.fn()
vi.mock('../lib/supabase', () => ({ supabase: { rpc: (fn: string, args: unknown) => rpc(fn, args) } }))

import { useJobStageEarnedValue } from './useJobStageEarnedValue'

beforeEach(() => {
  rpc.mockReset()
})

describe('useJobStageEarnedValue', () => {
  it('reads both, maps the lines and earns the hours', async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === 'bid_estimate_breakdown'
        ? { data: { labor_hours_by_stage: { rough: 120, top: 60, trim: 20 } }, error: null }
        : { data: [{ name: 'Rough in', weight_pct: '60', progress_pct: 50 }, { name: 'Plumbing per plans', weight_pct: 40, progress_pct: null }], error: null },
    )
    const { result } = renderHook(() => useJobStageEarnedValue(true, 'j1', 'b1', 80))
    expect(result.current.loading).toBe(true)
    expect(result.current.ev).toBeNull()
    await waitFor(() => expect(result.current.ev).not.toBeNull())
    expect(rpc).toHaveBeenCalledWith('bid_estimate_breakdown', { p_bid_id: 'b1' })
    expect(rpc).toHaveBeenCalledWith('list_job_stage_progress', { p_job_id: 'j1' })
    expect(result.current.ev).toMatchObject({ earnedHours: 60, recordedHours: 80, unmapped: ['Plumbing per plans'], read: 'partial' })
  })
  it('a read this role may not make says so', async () => {
    rpc.mockImplementation(async (fn: string) => (fn === 'list_job_stage_progress' ? { data: null, error: { message: 'list_job_stage_progress: not allowed' } } : { data: {}, error: null }))
    const { result } = renderHook(() => useJobStageEarnedValue(true, 'j1', 'b1', 0))
    await waitFor(() => expect(result.current.failed).toBe(true))
    expect(result.current.ev).toBeNull()
  })
  it('reads nothing until enabled', () => {
    const { result } = renderHook(() => useJobStageEarnedValue(false, 'j1', 'b1', 0))
    expect(rpc).not.toHaveBeenCalled()
    expect(result.current).toEqual({ loading: false, failed: false, ev: null })
  })
})
