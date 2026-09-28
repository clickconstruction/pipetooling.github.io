// @vitest-environment jsdom
/**
 * One autosave slice on a fake clock: what `markSavedNow` does to a save that is waiting.
 * The Edit Job engine, Edit Bid and the estimate draft all run on this hook.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useJobFormAutosaveSlice } from './useJobFormAutosaveSlice'

type Props = { jobId: string | null; sliceJson: string }

function mount(initial: Props = { jobId: 'job-1', sliceJson: 'a' }) {
  const save = vi.fn(async () => true)
  const hook = renderHook((p: Props) => useJobFormAutosaveSlice({ ...p, save }), { initialProps: initial })
  return { ...hook, save }
}
const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useJobFormAutosaveSlice — markSavedNow', () => {
  it('takes what is on screen as saved and drops the save that was waiting', async () => {
    const { result, rerender, save } = mount()
    rerender({ jobId: 'job-1', sliceJson: 'b' })
    expect(result.current.isDirty()).toBe(true)
    act(() => result.current.markSavedNow())
    expect(result.current.isDirty()).toBe(false)
    expect(result.current.status).toBe('idle')
    await tick(5_000)
    expect(save).not.toHaveBeenCalled()
  })

  it('the next edit saves after its own wait', async () => {
    const { result, rerender, save } = mount()
    rerender({ jobId: 'job-1', sliceJson: 'b' })
    act(() => result.current.markSavedNow())
    rerender({ jobId: 'job-1', sliceJson: 'c' })
    await tick(1_199)
    expect(save).not.toHaveBeenCalled()
    await tick(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(result.current.isDirty()).toBe(false)
  })

  it('with nothing waiting, changes nothing but the status', async () => {
    const { result, save } = mount()
    act(() => result.current.markSavedNow())
    expect(result.current.isDirty()).toBe(false)
    await tick(5_000)
    expect(save).not.toHaveBeenCalled()
  })
})
