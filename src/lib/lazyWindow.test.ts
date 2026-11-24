import { describe, expect, it, vi } from 'vitest'
import {
  __forgetLostWindowsForTests,
  lazyWindow,
  lostWindowCount,
  rewarmLostWindows,
  subscribeLostWindows,
  warmWhenIdle,
  WARM_FALLBACK_DELAY_MS,
  WARM_IDLE_TIMEOUT_MS,
  type IdleClock,
} from './lazyWindow'

/** A clock the test turns by hand: every scheduled run waits in `queue` until `tick`. */
function handClock(withIdle: boolean) {
  const queue: Array<{ id: number; run: () => void; via: 'idle' | 'timer'; ms: number }> = []
  let seq = 0
  const cancelled: number[] = []
  const clock: IdleClock = {
    requestIdle: withIdle
      ? (run, options) => {
          queue.push({ id: ++seq, run, via: 'idle', ms: options.timeout })
          return seq
        }
      : undefined,
    cancelIdle: (id) => {
      cancelled.push(id)
    },
    setTimer: (run, ms) => {
      queue.push({ id: ++seq, run, via: 'timer', ms })
      return seq
    },
    clearTimer: (id) => {
      cancelled.push(id)
    },
  }
  const tick = async () => {
    const next = queue.shift()
    if (next && !cancelled.includes(next.id)) next.run()
    await Promise.resolve()
    await Promise.resolve()
  }
  return { clock, queue, cancelled, tick }
}

describe('lazyWindow', () => {
  it('keeps the loader beside the window and loads once, however often it is warmed', async () => {
    const Window = () => null
    const load = vi.fn(async () => ({ default: Window }))
    const lazyOne = lazyWindow(load)
    expect(load).not.toHaveBeenCalled()
    await lazyOne.preload()
    await lazyOne.preload()
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('asks again after a load that failed', async () => {
    const Window = () => null
    let calls = 0
    const load = vi.fn(async () => {
      calls += 1
      if (calls === 1) throw new Error('Failed to fetch dynamically imported module')
      return { default: Window }
    })
    const lazyOne = lazyWindow(load)
    await expect(lazyOne.preload()).rejects.toThrow('Failed to fetch')
    await expect(lazyOne.preload()).resolves.toBeTruthy()
    expect(load).toHaveBeenCalledTimes(2)
  })
})

describe('the lost windows', () => {
  const lostChunk = () => new TypeError('Failed to fetch dynamically imported module: https://x/assets/JobWindowModal-abc.js')

  it('a window whose load failed is lost, a warm-up’s failure too, until its code lands', async () => {
    __forgetLostWindowsForTests()
    const Window = () => null
    let fail = true
    const load = vi.fn(async () => {
      if (fail) throw lostChunk()
      return { default: Window }
    })
    const heard = vi.fn()
    const stop = subscribeLostWindows(heard)
    const lazyOne = lazyWindow(load)
    expect(lostWindowCount()).toBe(0)
    await expect(lazyOne.preload()).rejects.toThrow(/dynamically imported/)
    expect(lostWindowCount()).toBe(1)
    expect(heard).toHaveBeenCalledTimes(1)
    // It fails again: still one lost window, and nobody is told twice.
    await rewarmLostWindows()
    expect(load).toHaveBeenCalledTimes(2)
    expect(lostWindowCount()).toBe(1)
    expect(heard).toHaveBeenCalledTimes(1)
    // The code lands: no window is lost.
    fail = false
    await rewarmLostWindows()
    expect(load).toHaveBeenCalledTimes(3)
    expect(lostWindowCount()).toBe(0)
    expect(heard).toHaveBeenCalledTimes(2)
    stop()
  })

  it('a load cancelled by a recovery reload, which resolves to nothing, counts as lost', async () => {
    __forgetLostWindowsForTests()
    const lazyOne = lazyWindow((async () => undefined) as unknown as () => Promise<{ default: () => null }>)
    await expect(lazyOne.preload()).rejects.toThrow()
    expect(lostWindowCount()).toBe(1)
  })

  it('asking again never rejects, with nothing lost or with everything still lost', async () => {
    __forgetLostWindowsForTests()
    await expect(rewarmLostWindows()).resolves.toBeUndefined()
    const lazyOne = lazyWindow(async (): Promise<{ default: () => null }> => {
      throw lostChunk()
    })
    await lazyOne.preload().catch(() => undefined)
    await expect(rewarmLostWindows()).resolves.toBeUndefined()
    expect(lostWindowCount()).toBe(1)
  })
})

describe('warmWhenIdle', () => {
  it('loads nothing until the page is idle, then one window after another', async () => {
    const { clock, queue, tick } = handClock(true)
    const order: string[] = []
    const a = vi.fn(async () => void order.push('a'))
    const b = vi.fn(async () => void order.push('b'))
    warmWhenIdle([a, b], clock)
    expect(a).not.toHaveBeenCalled()
    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({ via: 'idle', ms: WARM_IDLE_TIMEOUT_MS })
    await tick()
    expect(order).toEqual(['a'])
    // The second waits for its own idle moment: two long scripts never share one.
    expect(b).not.toHaveBeenCalled()
    await tick()
    expect(order).toEqual(['a', 'b'])
    expect(queue).toHaveLength(0)
  })

  it('uses a timer where the browser has no idle callback', async () => {
    const { clock, queue, tick } = handClock(false)
    const a = vi.fn(async () => {})
    warmWhenIdle([a], clock)
    expect(queue[0]).toMatchObject({ via: 'timer', ms: WARM_FALLBACK_DELAY_MS })
    await tick()
    expect(a).toHaveBeenCalledTimes(1)
  })

  it('goes on to the next window when one fails to load, and never throws', async () => {
    const { clock, tick } = handClock(true)
    const lost = vi.fn(async () => {
      throw new Error('Failed to fetch dynamically imported module')
    })
    const thrown = vi.fn(() => {
      throw new Error('no loader')
    })
    const fine = vi.fn(async () => {})
    warmWhenIdle([lost, thrown as unknown as () => Promise<unknown>, fine], clock)
    await tick()
    await tick()
    await tick()
    expect(lost).toHaveBeenCalledTimes(1)
    expect(thrown).toHaveBeenCalledTimes(1)
    expect(fine).toHaveBeenCalledTimes(1)
  })

  it('the stop it hands back cancels what waits and loads nothing more', async () => {
    const { clock, queue, cancelled, tick } = handClock(true)
    const a = vi.fn(async () => {})
    const stop = warmWhenIdle([a], clock)
    const waiting = queue[0]!.id
    stop()
    expect(cancelled).toEqual([waiting])
    await tick()
    expect(a).not.toHaveBeenCalled()
  })

  it('does nothing with no page or no windows', () => {
    const { clock, queue } = handClock(true)
    expect(() => warmWhenIdle([async () => {}], null)()).not.toThrow()
    warmWhenIdle([], clock)
    expect(queue).toHaveLength(0)
  })
})
