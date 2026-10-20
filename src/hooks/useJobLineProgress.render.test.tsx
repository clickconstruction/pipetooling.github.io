// @vitest-environment jsdom
/** Report by line (punch list #130, v2.5663): the hook behind every percent door reads the lines, keeps the picks, says what they add up to. */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
let jobRow: { pct_complete: number | null } | null = { pct_complete: 46 }
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (fn: string, args: unknown) => rpc(fn, args),
    from: () => {
      const builder: Record<string, unknown> = {}
      for (const m of ['select', 'eq']) builder[m] = () => builder
      builder.maybeSingle = () => Promise.resolve({ data: jobRow, error: null })
      return builder
    },
  },
}))

import { stampMovedLines, useJobLineProgress } from './useJobLineProgress'

const fourLines = [
  { fixture_id: 'u', name: 'Underground', stage_kind: 'any', sequence_order: 1, weight_pct: '20', progress_pct: null, draw_paid: true },
  { fixture_id: 'r', name: 'Rough In', stage_kind: 'any', sequence_order: 2, weight_pct: '35', progress_pct: 35, draw_paid: false },
  { fixture_id: 't', name: 'Top Out', stage_kind: 'any', sequence_order: 3, weight_pct: '25', progress_pct: null, draw_paid: false },
  { fixture_id: 'w', name: 'Water heater', stage_kind: 'any', sequence_order: 4, weight_pct: '20', progress_pct: null, draw_paid: false },
]

beforeEach(() => {
  rpc.mockReset()
  jobRow = { pct_complete: 46 }
})

describe('useJobLineProgress', () => {
  it('reads the lines and the recorded number, opens the first line not done, and adds the picks up', async () => {
    rpc.mockResolvedValue({ data: fourLines, error: null })
    const { result } = renderHook(() => useJobLineProgress('j1', true))
    await waitFor(() => expect(result.current.lines).not.toBeNull())
    expect(rpc).toHaveBeenCalledWith('list_job_stage_progress', { p_job_id: 'j1' })
    expect(result.current.hasLines).toBe(true)
    expect(result.current.recordedPct).toBe(46)
    // Rough In · Top Out · Trim Set read as a plan (v2.3417), so the first not done is numbered 2.
    expect(result.current.openId).toBe('r')
    expect(result.current.derivedPct).toBe(32)
    expect(result.current.moved).toEqual([])
    act(() => result.current.setPick('r', 50))
    act(() => result.current.setPick('w', 100))
    expect(result.current.derivedPct).toBe(58)
    expect(result.current.moved).toEqual([
      { fixtureId: 'r', name: 'Rough In', from: 35, to: 50 },
      { fixtureId: 'w', name: 'Water heater', from: null, to: 100 },
    ])
    act(() => result.current.setLinesMode(false))
    expect(result.current.lines).toBeNull()
    expect(result.current.hasLines).toBe(true)
    expect(result.current.derivedPct).toBeNull()
  })

  it('one line, a refused read, or a closed window is no list', async () => {
    rpc.mockResolvedValue({ data: [fourLines[1]], error: null })
    const one = renderHook(() => useJobLineProgress('j1', true))
    await waitFor(() => expect(rpc).toHaveBeenCalled())
    await act(async () => {})
    expect(one.result.current.lines).toBeNull()
    expect(one.result.current.hasLines).toBe(false)

    rpc.mockReset()
    rpc.mockResolvedValue({ data: null, error: { message: 'list_job_stage_progress: not allowed' } })
    const refused = renderHook(() => useJobLineProgress('j1', true))
    await waitFor(() => expect(rpc).toHaveBeenCalled())
    await act(async () => {})
    expect(refused.result.current.lines).toBeNull()

    rpc.mockReset()
    const closed = renderHook(() => useJobLineProgress('j1', false))
    expect(rpc).not.toHaveBeenCalled()
    expect(closed.result.current.lines).toBeNull()
  })

  it('a failed read of the recorded number keeps the list', async () => {
    rpc.mockResolvedValue({ data: fourLines, error: null })
    jobRow = null
    const { result } = renderHook(() => useJobLineProgress('j1', true))
    await waitFor(() => expect(result.current.lines).not.toBeNull())
    expect(result.current.recordedPct).toBeNull()
  })

  it('stampMovedLines writes one row a line and swallows a refusal', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null }).mockRejectedValueOnce(new Error('no such stage'))
    await stampMovedLines('j1', [{ fixtureId: 'r', name: 'Rough In', from: 35, to: 50 }, { fixtureId: 'w', name: 'Water heater', from: null, to: 100 }], 'rep-1')
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc).toHaveBeenNthCalledWith(1, 'record_stage_progress', { p_job_id: 'j1', p_fixture_id: 'r', p_pct: 50, p_report_id: 'rep-1' })
    expect(rpc).toHaveBeenNthCalledWith(2, 'record_stage_progress', { p_job_id: 'j1', p_fixture_id: 'w', p_pct: 100, p_report_id: 'rep-1' })
  })
})
