// @vitest-environment jsdom
/**
 * The autosave slice's whole life on a fake clock (punch list #51, PR 1). Edit Job (through
 * `useJobFormAutosaveEngine`), the Estimates draft and Edit Bid all save through this hook;
 * until now only `markSavedNow` had cases of its own (`useJobFormAutosaveSlice.render.test.tsx`,
 * v2.4027 — kept there). These pin the rest of what the three forms rely on: the first
 * snapshot is the baseline, a change saves once after the debounce, a disabled slice never
 * saves, a failed save stays dirty, a change during a save queues one follow-up, the close
 * flush waits out a save in flight, and `clearBaseline` / `cancelPending` do what their names
 * say. The Bids page's Edit Bid controller moves out on top of this.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useJobFormAutosaveSlice } from './useJobFormAutosaveSlice'

type Props = { jobId: string | null; sliceJson: string; enabled?: boolean; debounceMs?: number }

/** A save the test resolves by hand, so "in flight" is a state the test can hold. */
function deferredSave() {
  const calls: Array<{ resolve: (ok: boolean) => void; json: string }> = []
  let current = ''
  const save = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        calls.push({ resolve, json: current })
      }),
  )
  return { save, calls, see: (json: string) => { current = json } }
}

function setup(initial: Props, save: () => Promise<boolean> = vi.fn(async () => true), onSaved = vi.fn()) {
  const hook = renderHook((p: Props) => useJobFormAutosaveSlice({ ...p, save, onSaved }), { initialProps: initial })
  return { ...hook, save, onSaved }
}

/** Let the timers and the promise chain after them run. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useJobFormAutosaveSlice — the baseline', () => {
  it('the first snapshot of a record is what is saved: not dirty, nothing written', async () => {
    const { result, save } = setup({ jobId: 'job-1', sliceJson: '{"a":1}' })
    await advance(5000)
    expect(result.current.isDirty()).toBe(false)
    expect(result.current.needsFlush()).toBe(false)
    expect(result.current.status).toBe('idle')
    expect(save).not.toHaveBeenCalled()
  })

  it('with no record open nothing is dirty and nothing saves, whatever the slice says', async () => {
    const { result, rerender, save } = setup({ jobId: null, sliceJson: '{"a":1}' })
    rerender({ jobId: null, sliceJson: '{"a":2}' })
    await advance(5000)
    expect(result.current.isDirty()).toBe(false)
    await act(async () => { await result.current.flush() })
    expect(save).not.toHaveBeenCalled()
  })

  it('opening a record after a blank form takes that record’s snapshot as its baseline', async () => {
    const { result, rerender, save } = setup({ jobId: null, sliceJson: '' })
    rerender({ jobId: 'job-1', sliceJson: '{"a":1}' })
    await advance(5000)
    expect(result.current.isDirty()).toBe(false)
    expect(save).not.toHaveBeenCalled()
  })
})

describe('useJobFormAutosaveSlice — the debounce', () => {
  it('a change saves once, 1.2 s after it, and becomes the new baseline', async () => {
    const { result, rerender, save, onSaved } = setup({ jobId: 'job-1', sliceJson: '{"a":1}' })
    rerender({ jobId: 'job-1', sliceJson: '{"a":2}' })
    expect(result.current.isDirty()).toBe(true)
    await advance(1199)
    expect(save).not.toHaveBeenCalled()
    await advance(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('saved')
    expect(result.current.isDirty()).toBe(false)
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('each change restarts the clock: a run of edits saves once, after the last', async () => {
    const { rerender, save } = setup({ jobId: 'job-1', sliceJson: 'v0' })
    for (const v of ['v1', 'v2', 'v3']) {
      rerender({ jobId: 'job-1', sliceJson: v })
      await advance(1000)
    }
    expect(save).not.toHaveBeenCalled()
    await advance(200)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('changing back to the saved value before the clock runs out saves nothing', async () => {
    const { result, rerender, save } = setup({ jobId: 'job-1', sliceJson: 'v0' })
    rerender({ jobId: 'job-1', sliceJson: 'v1' })
    await advance(500)
    rerender({ jobId: 'job-1', sliceJson: 'v0' })
    await advance(5000)
    expect(save).not.toHaveBeenCalled()
    expect(result.current.isDirty()).toBe(false)
  })

  it('honours its own debounce', async () => {
    const { rerender, save } = setup({ jobId: 'job-1', sliceJson: 'v0', debounceMs: 300 })
    rerender({ jobId: 'job-1', sliceJson: 'v1', debounceMs: 300 })
    await advance(299)
    expect(save).not.toHaveBeenCalled()
    await advance(1)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('shows saving while the write is in flight', async () => {
    const d = deferredSave()
    const { result, rerender } = setup({ jobId: 'job-1', sliceJson: 'v0' }, d.save)
    rerender({ jobId: 'job-1', sliceJson: 'v1' })
    await advance(1200)
    expect(result.current.status).toBe('saving')
    expect(result.current.isRunning()).toBe(true)
    await act(async () => { d.calls[0]!.resolve(true) })
    expect(result.current.status).toBe('saved')
    expect(result.current.isRunning()).toBe(false)
  })

  it('leaving the form drops a pending save', async () => {
    const { rerender, unmount, save } = setup({ jobId: 'job-1', sliceJson: 'v0' })
    rerender({ jobId: 'job-1', sliceJson: 'v1' })
    unmount()
    await advance(5000)
    expect(save).not.toHaveBeenCalled()
  })

  it('switching to another record drops the first one’s pending save and baselines the second', async () => {
    const { result, rerender, save } = setup({ jobId: 'job-1', sliceJson: 'a0' })
    rerender({ jobId: 'job-1', sliceJson: 'a1' })
    rerender({ jobId: 'job-2', sliceJson: 'b0' })
    await advance(5000)
    expect(save).not.toHaveBeenCalled()
    expect(result.current.isDirty()).toBe(false)
  })
})

describe('useJobFormAutosaveSlice — disabled', () => {
  it('a disabled slice stays dirty and never saves — not on the clock, not on flush, not on close', async () => {
    const { result, rerender, save } = setup({ jobId: 'job-1', sliceJson: 'v0', enabled: false })
    rerender({ jobId: 'job-1', sliceJson: 'v1', enabled: false })
    await advance(5000)
    expect(result.current.isDirty()).toBe(true)
    expect(result.current.needsFlush()).toBe(false)
    await act(async () => { await result.current.flush() })
    let outcome = ''
    await act(async () => { outcome = await result.current.flushForClose() })
    expect(outcome).toBe('clean')
    expect(save).not.toHaveBeenCalled()
  })

  it('enabling it again starts the clock', async () => {
    const { rerender, save } = setup({ jobId: 'job-1', sliceJson: 'v0', enabled: false })
    rerender({ jobId: 'job-1', sliceJson: 'v1', enabled: false })
    await advance(5000)
    rerender({ jobId: 'job-1', sliceJson: 'v1', enabled: true })
    await advance(1200)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('disabling it before the clock runs out cancels the save', async () => {
    const { rerender, save } = setup({ jobId: 'job-1', sliceJson: 'v0' })
    rerender({ jobId: 'job-1', sliceJson: 'v1' })
    await advance(600)
    rerender({ jobId: 'job-1', sliceJson: 'v1', enabled: false })
    await advance(5000)
    expect(save).not.toHaveBeenCalled()
  })
})

describe('useJobFormAutosaveSlice — a failed save', () => {
  it('says error, stays dirty, and the next change tries again', async () => {
    const save = vi.fn(async () => false)
    const { result, rerender } = setup({ jobId: 'job-1', sliceJson: 'v0' }, save)
    rerender({ jobId: 'job-1', sliceJson: 'v1' })
    await advance(1200)
    expect(result.current.status).toBe('error')
    expect(result.current.isDirty()).toBe(true)
    save.mockImplementation(async () => true)
    rerender({ jobId: 'job-1', sliceJson: 'v2' })
    await advance(1200)
    expect(save).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('saved')
    expect(result.current.isDirty()).toBe(false)
  })

  it('does not call onSaved', async () => {
    const onSaved = vi.fn()
    const { rerender } = setup({ jobId: 'job-1', sliceJson: 'v0' }, vi.fn(async () => false), onSaved)
    rerender({ jobId: 'job-1', sliceJson: 'v1' })
    await advance(1200)
    expect(onSaved).not.toHaveBeenCalled()
  })
})

describe('useJobFormAutosaveSlice — a change during a save', () => {
  it('queues one follow-up, which saves the latest', async () => {
    const d = deferredSave()
    const { result, rerender } = setup({ jobId: 'job-1', sliceJson: 'v0' }, d.save)
    rerender({ jobId: 'job-1', sliceJson: 'v1' })
    d.see('v1')
    await advance(1200)
    expect(d.save).toHaveBeenCalledTimes(1)
    // Two more edits land while v1 is in flight; each debounce asks to save and is queued.
    rerender({ jobId: 'job-1', sliceJson: 'v2' })
    await advance(1200)
    rerender({ jobId: 'job-1', sliceJson: 'v3' })
    d.see('v3')
    await advance(1200)
    expect(d.save).toHaveBeenCalledTimes(1)
    await act(async () => { d.calls[0]!.resolve(true) })
    // v1 is saved but v3 is on screen: still dirty, and one follow-up is running.
    expect(result.current.isDirty()).toBe(true)
    expect(d.save).toHaveBeenCalledTimes(2)
    expect(d.calls[1]!.json).toBe('v3')
    await act(async () => { d.calls[1]!.resolve(true) })
    expect(result.current.isDirty()).toBe(false)
    expect(d.save).toHaveBeenCalledTimes(2)
  })

  it('the baseline is what was on screen when the save started, not when it ended', async () => {
    const d = deferredSave()
    const { result, rerender } = setup({ jobId: 'job-1', sliceJson: 'v0' }, d.save, vi.fn())
    rerender({ jobId: 'job-1', sliceJson: 'v1' })
    await advance(1200)
    rerender({ jobId: 'job-1', sliceJson: 'v2' })
    await act(async () => { d.calls[0]!.resolve(true) })
    expect(result.current.isDirty()).toBe(true)
  })
})

describe('useJobFormAutosaveSlice — flush', () => {
  it('saves a pending change now and cancels its clock', async () => {
    const { result, rerender, save } = setup({ jobId: 'job-1', sliceJson: 'v0' })
    rerender({ jobId: 'job-1', sliceJson: 'v1' })
    await act(async () => { await result.current.flush() })
    expect(save).toHaveBeenCalledTimes(1)
    await advance(5000)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('with nothing changed, writes nothing', async () => {
    const { result, save } = setup({ jobId: 'job-1', sliceJson: 'v0' })
    await act(async () => { await result.current.flush() })
    expect(save).not.toHaveBeenCalled()
  })
})

describe('useJobFormAutosaveSlice — the close flush', () => {
  it('clean when nothing changed', async () => {
    const { result, save } = setup({ jobId: 'job-1', sliceJson: 'v0' })
    let outcome = ''
    await act(async () => { outcome = await result.current.flushForClose() })
    expect(outcome).toBe('clean')
    expect(save).not.toHaveBeenCalled()
  })

  it('saved when a pending change was written', async () => {
    const { result, rerender, save } = setup({ jobId: 'job-1', sliceJson: 'v0' })
    rerender({ jobId: 'job-1', sliceJson: 'v1' })
    let outcome = ''
    await act(async () => { outcome = await result.current.flushForClose() })
    expect(outcome).toBe('saved')
    expect(save).toHaveBeenCalledTimes(1)
    expect(result.current.isDirty()).toBe(false)
  })

  it('failed when the write is refused — the form must not close silently', async () => {
    const { result, rerender } = setup({ jobId: 'job-1', sliceJson: 'v0' }, vi.fn(async () => false))
    rerender({ jobId: 'job-1', sliceJson: 'v1' })
    let outcome = ''
    await act(async () => { outcome = await result.current.flushForClose() })
    expect(outcome).toBe('failed')
    expect(result.current.isDirty()).toBe(true)
  })

  it('waits out a save in flight, then writes what is still unsaved', async () => {
    const d = deferredSave()
    const { result, rerender } = setup({ jobId: 'job-1', sliceJson: 'v0' }, d.save)
    rerender({ jobId: 'job-1', sliceJson: 'v1' })
    d.see('v1')
    await advance(1200)
    rerender({ jobId: 'job-1', sliceJson: 'v2' })
    d.see('v2')
    let outcome: string | null = null
    let closing: Promise<void> = Promise.resolve()
    await act(async () => {
      closing = result.current.flushForClose().then((o) => { outcome = o })
    })
    await advance(500)
    expect(outcome).toBeNull()
    expect(d.save).toHaveBeenCalledTimes(1)
    await act(async () => { d.calls[0]!.resolve(true) })
    await advance(200)
    expect(d.save).toHaveBeenCalledTimes(2)
    expect(d.calls[1]!.json).toBe('v2')
    await act(async () => { d.calls[1]!.resolve(true) })
    await advance(200)
    await act(async () => { await closing })
    expect(outcome).toBe('saved')
    expect(result.current.isDirty()).toBe(false)
  })
})

describe('useJobFormAutosaveSlice — clearBaseline and cancelPending', () => {
  it('clearBaseline: nothing is dirty, the clock is dropped, and the next snapshot is the new baseline', async () => {
    const { result, rerender, save } = setup({ jobId: 'job-1', sliceJson: 'v0' })
    rerender({ jobId: 'job-1', sliceJson: 'v1' })
    act(() => result.current.clearBaseline())
    expect(result.current.isDirty()).toBe(false)
    await advance(5000)
    expect(save).not.toHaveBeenCalled()
    rerender({ jobId: 'job-1', sliceJson: 'v2' })
    await advance(5000)
    expect(save).not.toHaveBeenCalled()
    expect(result.current.isDirty()).toBe(false)
  })

  it('cancelPending: the clock is dropped but the change is still unsaved', async () => {
    const { result, rerender, save } = setup({ jobId: 'job-1', sliceJson: 'v0' })
    rerender({ jobId: 'job-1', sliceJson: 'v1' })
    act(() => result.current.cancelPending())
    await advance(5000)
    expect(save).not.toHaveBeenCalled()
    expect(result.current.isDirty()).toBe(true)
    expect(result.current.needsFlush()).toBe(true)
  })
})
