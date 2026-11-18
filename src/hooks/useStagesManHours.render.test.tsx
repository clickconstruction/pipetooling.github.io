// @vitest-environment jsdom
/**
 * The Pipeline's man-hours read (the Stages map's step 15): once per visit, a moment after the board shows, for
 * whoever is signed in; a refusal leaves no hours and lets the next showing try again.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'

const rpc = vi.hoisted(() => ({
  calls: [] as string[],
  answer: { data: [] as unknown, error: null as unknown },
  hold: null as null | Promise<void>,
}))
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: async (name: string) => {
      rpc.calls.push(name)
      if (rpc.hold) await rpc.hold
      return rpc.answer
    },
  },
}))

import { STAGES_MAN_HOURS_DELAY_MS, useStagesManHours } from './useStagesManHours'

const ROWS = [
  { job_id: 'j1', person_name: 'Ana Made', man_hours: 4.5 },
  { job_id: 'j1', person_name: 'Ben Up', man_hours: 8 },
  { job_id: 'j2', person_name: 'Ana Made', man_hours: '2' },
]
const pass = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

beforeEach(() => {
  vi.useFakeTimers()
  rpc.calls = []
  rpc.answer = { data: ROWS, error: null }
  rpc.hold = null
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useStagesManHours', () => {
  it('waits its moment, reads once and folds the rows by job and by person', async () => {
    const { result } = renderHook(() => useStagesManHours(true, 'u1'))
    expect(result.current.stagesManHoursByJobId.size).toBe(0)
    await pass(STAGES_MAN_HOURS_DELAY_MS - 1)
    expect(rpc.calls).toEqual([])
    await pass(1)
    expect(rpc.calls).toEqual(['get_man_hours_by_job'])
    expect([...result.current.stagesManHoursByJobId]).toEqual([['j1', 12.5], ['j2', 2]])
    expect(result.current.stagesLaborBreakdownByJobId.get('j1')).toEqual([
      { personName: 'Ben Up', hours: 8 },
      { personName: 'Ana Made', hours: 4.5 },
    ])
    expect(result.current.stagesManHoursLoading).toBe(false)
  })

  it('says it is loading while the read is out, and not before or after', async () => {
    let release = () => {}
    rpc.hold = new Promise<void>((r) => (release = r))
    const { result } = renderHook(() => useStagesManHours(true, 'u1'))
    expect(result.current.stagesManHoursLoading).toBe(false)
    await pass(STAGES_MAN_HOURS_DELAY_MS)
    expect(result.current.stagesManHoursLoading).toBe(true)
    await act(async () => {
      release()
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.stagesManHoursLoading).toBe(false)
    expect(result.current.stagesManHoursByJobId.get('j1')).toBe(12.5)
  })

  it('reads nothing while the board is hidden or nobody is signed in', async () => {
    renderHook(() => useStagesManHours(false, 'u1'))
    renderHook(() => useStagesManHours(true, null))
    renderHook(() => useStagesManHours(true, undefined))
    await pass(500)
    expect(rpc.calls).toEqual([])
  })

  it('a board hidden before its moment is up never reads', async () => {
    const { rerender } = renderHook(({ active }) => useStagesManHours(active, 'u1'), { initialProps: { active: true } })
    await pass(STAGES_MAN_HOURS_DELAY_MS - 10)
    rerender({ active: false })
    await pass(500)
    expect(rpc.calls).toEqual([])
  })

  it('reads once per visit: hiding and showing the board again reads nothing more', async () => {
    const { rerender } = renderHook(({ active }) => useStagesManHours(active, 'u1'), { initialProps: { active: true } })
    await pass(STAGES_MAN_HOURS_DELAY_MS)
    rerender({ active: false })
    rerender({ active: true })
    await pass(500)
    expect(rpc.calls).toHaveLength(1)
  })

  it('a refusal leaves no hours, stops loading, and the next showing tries again', async () => {
    rpc.answer = { data: null, error: { message: 'refused', code: '42501' } }
    const { result, rerender } = renderHook(({ active }) => useStagesManHours(active, 'u1'), { initialProps: { active: true } })
    await pass(STAGES_MAN_HOURS_DELAY_MS)
    expect(rpc.calls).toHaveLength(1)
    expect(result.current.stagesManHoursByJobId.size).toBe(0)
    expect(result.current.stagesManHoursLoading).toBe(false)
    rpc.answer = { data: ROWS, error: null }
    rerender({ active: false })
    rerender({ active: true })
    await pass(STAGES_MAN_HOURS_DELAY_MS)
    expect(rpc.calls).toHaveLength(2)
    expect(result.current.stagesManHoursByJobId.get('j1')).toBe(12.5)
  })

  it('an empty answer is no hours, not an error', async () => {
    rpc.answer = { data: null, error: null }
    const { result } = renderHook(() => useStagesManHours(true, 'u1'))
    await pass(STAGES_MAN_HOURS_DELAY_MS)
    expect(result.current.stagesManHoursByJobId.size).toBe(0)
    expect(rpc.calls).toHaveLength(1)
  })
})
