import { describe, it, expect } from 'vitest'
import { createFrameFallbackScheduler, type FrameFallbackHost } from './frameFallbackScheduler'

/**
 * Host stub where frames and timers fire only when the test says so — the
 * "hidden document" leak path is a host whose frames never flush.
 */
function makeHost() {
  let nextId = 1
  const frames = new Map<number, () => void>()
  const timers = new Map<number, () => void>()
  const host: FrameFallbackHost = {
    requestAnimationFrame: (cb) => {
      const id = nextId++
      frames.set(id, cb)
      return id
    },
    cancelAnimationFrame: (id) => {
      frames.delete(id)
    },
    setTimeout: (cb) => {
      const id = nextId++
      timers.set(id, cb)
      return id
    },
    clearTimeout: (id) => {
      timers.delete(id)
    },
  }
  const flushFrames = () => {
    for (const [id, cb] of [...frames]) {
      frames.delete(id)
      cb()
    }
  }
  const flushTimers = () => {
    for (const [id, cb] of [...timers]) {
      timers.delete(id)
      cb()
    }
  }
  return { host, flushFrames, flushTimers, pending: () => frames.size + timers.size }
}

describe('createFrameFallbackScheduler', () => {
  it('runs once per schedule when frames flow, and disarms the timer', () => {
    const { host, flushFrames, flushTimers } = makeHost()
    let runs = 0
    const s = createFrameFallbackScheduler(host, () => {
      runs += 1
    })
    s.schedule()
    flushFrames()
    expect(runs).toBe(1)
    // The timer must have been disarmed by the frame — no double run.
    flushTimers()
    expect(runs).toBe(1)
  })

  it('still runs when frames never fire — the hidden-document leak path', () => {
    // rAF is suspended while document.visibilityState is 'hidden'; this is the
    // path that left the body scroll lock applied forever after a quick-link
    // navigation unmounted the bid preview modal.
    const { host, flushTimers, flushFrames } = makeHost()
    let runs = 0
    const s = createFrameFallbackScheduler(host, () => {
      runs += 1
    })
    s.schedule()
    flushTimers() // frames never flush
    expect(runs).toBe(1)
    // The late frame (e.g. tab becomes visible again) must not run it twice.
    flushFrames()
    expect(runs).toBe(1)
  })

  it('coalesces schedules issued before the run into one run', () => {
    const { host, flushFrames } = makeHost()
    let runs = 0
    const s = createFrameFallbackScheduler(host, () => {
      runs += 1
    })
    s.schedule()
    s.schedule()
    s.schedule()
    flushFrames()
    expect(runs).toBe(1)
  })

  it('can schedule again after a run', () => {
    const { host, flushFrames, flushTimers } = makeHost()
    let runs = 0
    const s = createFrameFallbackScheduler(host, () => {
      runs += 1
    })
    s.schedule()
    flushFrames()
    s.schedule()
    flushTimers()
    expect(runs).toBe(2)
  })

  it('cancel disarms both the frame and the timer', () => {
    const { host, flushFrames, flushTimers, pending } = makeHost()
    let runs = 0
    const s = createFrameFallbackScheduler(host, () => {
      runs += 1
    })
    s.schedule()
    s.cancel()
    flushFrames()
    flushTimers()
    expect(runs).toBe(0)
    expect(pending()).toBe(0)
  })

  it('a schedule from inside the run arms a fresh pass', () => {
    // The sentinel's recompute mutates body styles, which re-triggers its own
    // MutationObserver → schedule while the previous run is still on the stack.
    const { host, flushFrames } = makeHost()
    let runs = 0
    const s = createFrameFallbackScheduler(host, () => {
      runs += 1
      if (runs === 1) s.schedule()
    })
    s.schedule()
    flushFrames() // first run schedules the second
    flushFrames()
    expect(runs).toBe(2)
  })
})
