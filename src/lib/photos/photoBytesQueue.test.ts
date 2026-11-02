import { describe, expect, it } from 'vitest'
import { makeBytesQueue, type BytesAnswer } from './photoBytesQueue'

const blob = (s: string) => new Blob([s], { type: 'image/jpeg' })
const ok = (s = 'jpeg'): BytesAnswer => ({ status: 200, blob: blob(s) })
const tooMany = (retryAfterSec: number | null = null): BytesAnswer => ({ status: 429, blob: null, retryAfterSec })
const noSleep = async () => {}

describe('the bytes queue', () => {
  it('runs a few reads at once and the rest wait their turn', async () => {
    const q = makeBytesQueue({ concurrency: 2, retries: 0, cacheSize: 10, sleep: noSleep })
    let open = 0
    let peak = 0
    const releases: Array<() => void> = []
    const fetchOne = () =>
      new Promise<BytesAnswer>((resolve) => {
        open += 1
        peak = Math.max(peak, open)
        releases.push(() => {
          open -= 1
          resolve(ok())
        })
      })
    let done = false
    const all = Promise.all(['a', 'b', 'c', 'd'].map((k) => q.get(k, fetchOne))).then(() => void (done = true))
    await new Promise((r) => setTimeout(r, 0))
    expect(q.stats()).toMatchObject({ running: 2, waiting: 2 })
    // The reads finish two at a time; each release lets the next waiting read start.
    while (!done) {
      while (releases.length) releases.shift()!()
      await new Promise((r) => setTimeout(r, 0))
    }
    await all
    expect(peak).toBe(2)
    expect(q.stats()).toMatchObject({ running: 0, waiting: 0, kept: 4 })
  })

  it('waits a 429 out and asks again, honouring Retry-After when it is named', async () => {
    const slept: number[] = []
    const q = makeBytesQueue({ concurrency: 4, retries: 3, cacheSize: 10, sleep: async (ms) => void slept.push(ms), backoffMs: (n) => n * 100 })
    const answers = [tooMany(2), tooMany(), ok('late')]
    const got = await q.get('x', async () => answers.shift()!)
    expect(await got!.text()).toBe('late')
    expect(slept).toEqual([2000, 200])
  })

  it('gives up after the retries, keeps nothing for it, and asks again on the next look', async () => {
    const q = makeBytesQueue({ concurrency: 4, retries: 1, cacheSize: 10, sleep: noSleep })
    let calls = 0
    const always429 = async () => {
      calls += 1
      return tooMany()
    }
    expect(await q.get('x', always429)).toBeNull()
    expect(calls).toBe(2)
    expect(q.stats().kept).toBe(0)
    expect(await q.get('x', async () => ok('now'))).not.toBeNull()
  })

  it('keeps an answer and a refusal, so a second tile, a remount or the viewer never ask twice', async () => {
    const q = makeBytesQueue({ concurrency: 4, retries: 0, cacheSize: 10, sleep: noSleep })
    let calls = 0
    const once = async () => {
      calls += 1
      return ok()
    }
    const [a, b] = await Promise.all([q.get('k', once), q.get('k', once)])
    expect(a).toBe(b)
    expect(await q.get('k', once)).toBe(a)
    expect(calls).toBe(1)
    let refused = 0
    const gone = async () => {
      refused += 1
      return { status: 404, blob: null }
    }
    expect(await q.get('gone', gone)).toBeNull()
    expect(await q.get('gone', gone)).toBeNull()
    expect(refused).toBe(1)
  })

  it('an empty answer is null, a lost signal is null and not kept, and the oldest kept answer makes room', async () => {
    const q = makeBytesQueue({ concurrency: 4, retries: 0, cacheSize: 2, sleep: noSleep })
    expect(await q.get('empty', async () => ({ status: 200, blob: blob('') }))).toBeNull()
    let tries = 0
    const lost = async () => {
      tries += 1
      throw new TypeError('Failed to fetch')
    }
    expect(await q.get('lost', lost)).toBeNull()
    expect(await q.get('lost', lost)).toBeNull()
    expect(tries).toBe(2)
    await q.get('one', async () => ok())
    await q.get('two', async () => ok())
    expect(q.stats().kept).toBe(2)
    q.reset()
    expect(q.stats().kept).toBe(0)
  })
})
