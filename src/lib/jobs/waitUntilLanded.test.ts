import { describe, expect, it, vi } from 'vitest'
import { waitUntilLanded } from './waitUntilLanded'

/** A clock the sleeps move, so the tests run in no time. */
function fakeClock() {
  let t = 0
  return { now: () => t, sleep: vi.fn(async (ms: number) => void (t += ms)) }
}

describe('waitUntilLanded', () => {
  it('answers at once when the write is already in', async () => {
    const clock = fakeClock()
    const read = vi.fn(async () => true)
    expect(await waitUntilLanded({ read, intervalMs: 350, timeoutMs: 10_000, ...clock })).toBe(true)
    expect(read).toHaveBeenCalledTimes(1)
    expect(clock.sleep).not.toHaveBeenCalled()
  })

  it('keeps asking until the write lands', async () => {
    const clock = fakeClock()
    const answers = [false, false, false, true]
    const read = vi.fn(async () => answers.shift() ?? true)
    expect(await waitUntilLanded({ read, intervalMs: 350, timeoutMs: 10_000, ...clock })).toBe(true)
    expect(read).toHaveBeenCalledTimes(4)
    expect(clock.now()).toBe(1050)
  })

  it('gives up when the time runs out, without sleeping past it', async () => {
    const clock = fakeClock()
    const read = vi.fn(async () => false)
    expect(await waitUntilLanded({ read, intervalMs: 400, timeoutMs: 1000, ...clock })).toBe(false)
    // Asked at 0, 400 and 800; a fourth ask would be at 1,200, past the 1,000 limit.
    expect(read).toHaveBeenCalledTimes(3)
    expect(clock.now()).toBe(800)
  })

  it('counts a read that throws as not yet', async () => {
    const clock = fakeClock()
    let n = 0
    const read = vi.fn(async () => {
      n += 1
      if (n === 1) throw new Error('network')
      return true
    })
    expect(await waitUntilLanded({ read, intervalMs: 350, timeoutMs: 10_000, ...clock })).toBe(true)
    expect(read).toHaveBeenCalledTimes(2)
  })
})
