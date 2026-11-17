// @vitest-environment jsdom
/** The Lien desk's one press at a time, on its own (v2.7590). Every footer's press goes through it inside the desk. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useLienDeskRunner } from './useLienDeskRunner'

const toasts = vi.hoisted(() => [] as Array<[string, string]>)
vi.mock('../../contexts/ToastContext', () => ({ useToastContext: () => ({ showToast: (words: string, tone: string) => toasts.push([words, tone]) }) }))

afterEach(() => {
  cleanup()
  toasts.length = 0
})

describe('useLienDeskRunner', () => {
  it('runs the work, says the done words, has the desk re-read and answers yes', async () => {
    const onChanged = vi.fn()
    const beforeRun = vi.fn()
    const work = vi.fn(async () => {})
    const { result } = renderHook(() => useLienDeskRunner({ onChanged, beforeRun }))
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.run('Send it', work, 'Sent.')
    })
    expect(ok).toBe(true)
    expect(beforeRun).toHaveBeenCalledTimes(1)
    expect(work).toHaveBeenCalledTimes(1)
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(toasts).toEqual([['Sent.', 'success']])
    expect(result.current.busy).toBe(false)
    expect(result.current.busyRef.current).toBe(false)
  })

  it('with no done words it lands quietly', async () => {
    const onChanged = vi.fn()
    const { result } = renderHook(() => useLienDeskRunner({ onChanged }))
    await act(async () => {
      await result.current.run('Save', async () => {})
    })
    expect(toasts).toEqual([])
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('a throw names the press and its reason, answers no and does not re-read', async () => {
    const onChanged = vi.fn()
    const { result } = renderHook(() => useLienDeskRunner({ onChanged }))
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.run('Send it', async () => {
        throw new Error('the row is locked')
      }, 'Sent.')
    })
    expect(ok).toBe(false)
    expect(toasts).toEqual([['Send it: the row is locked', 'error']])
    expect(onChanged).not.toHaveBeenCalled()
    expect(result.current.busy).toBe(false)
  })

  it('a throw with no message says the press failed', async () => {
    const { result } = renderHook(() => useLienDeskRunner({ onChanged: () => {} }))
    await act(async () => {
      await result.current.run('Send it', async () => {
        throw { code: '42501' }
      })
    })
    expect(toasts).toEqual([['Send it failed.', 'error']])
  })

  it('is busy while the work is in flight, and refuses a second press until it lands', async () => {
    let land = () => {}
    const first = vi.fn(() => new Promise<void>((resolve) => { land = resolve }))
    const second = vi.fn(async () => {})
    const { result } = renderHook(() => useLienDeskRunner({ onChanged: () => {} }))
    let firstRun: Promise<boolean> = Promise.resolve(false)
    act(() => {
      firstRun = result.current.run('First', first)
    })
    expect(result.current.busy).toBe(true)
    expect(result.current.busyRef.current).toBe(true)
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.run('Second', second)
    })
    expect(ok).toBe(false)
    expect(second).not.toHaveBeenCalled()
    await act(async () => {
      land()
      await firstRun
    })
    expect(result.current.busy).toBe(false)
  })
})
