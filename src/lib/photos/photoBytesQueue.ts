/**
 * The queue a picture's bytes come through (the Documents spike of 2026-11-01): Documents → Photos drew a hundred tiles
 * at once and asked `job-photos` for each at the same moment, so the gateway answered 429 to the burst and a fifth of the
 * tiles stayed grey. Every read of a thumbnail or a full picture now goes through one queue: a few in flight at a time,
 * a 429 waited out and asked again (Retry-After when the answer names it, else a short doubling wait), the bytes kept
 * so a second tile for the same file, a remount or the viewer never ask twice, and a refusal (a 404) kept too so a tile
 * does not ask again on every scroll. A 429 that never clears is not kept: the next look asks again.
 *
 * Pure: the fetch and the sleep come in, so the tests run it over fakes in no time.
 */

export interface BytesAnswer {
  status: number
  blob: Blob | null
  /** Retry-After in seconds, when a 429 named one. */
  retryAfterSec?: number | null
}

export interface BytesQueueOptions {
  /** How many reads run at once. */
  concurrency: number
  /** How many times a 429 is asked again before the read gives up. */
  retries: number
  /** How many answers are kept; 0 keeps only the reads in flight. */
  cacheSize: number
  sleep?: (ms: number) => Promise<void>
  /** The wait before the n-th retry (1-based) when the answer named no Retry-After. */
  backoffMs?: (attempt: number) => number
}

export interface BytesQueue {
  /** The bytes for a key, or null for a refusal or a 429 that never cleared. */
  get: (key: string, fetchOne: () => Promise<BytesAnswer>) => Promise<Blob | null>
  /** Forget every kept answer (tests, a sign-out). */
  reset: () => void
  /** How it stands, for a test or a probe. */
  stats: () => { running: number; waiting: number; kept: number }
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
/** 400 ms, 800 ms, 1.6 s … with a little jitter so a hundred tiles do not retry on the same tick. */
const defaultBackoff = (attempt: number) => 400 * 2 ** (attempt - 1) + Math.floor(Math.random() * 150)

export function makeBytesQueue(opts: BytesQueueOptions): BytesQueue {
  const sleep = opts.sleep ?? defaultSleep
  const backoff = opts.backoffMs ?? defaultBackoff
  const kept = new Map<string, Blob | null>()
  const inFlight = new Map<string, Promise<Blob | null>>()
  const waiting: Array<() => void> = []
  let running = 0

  const take = () =>
    new Promise<void>((resolve) => {
      if (running < opts.concurrency) {
        running += 1
        resolve()
      } else waiting.push(resolve)
    })
  const release = () => {
    const next = waiting.shift()
    if (next) next()
    else running -= 1
  }
  const keep = (key: string, blob: Blob | null) => {
    if (opts.cacheSize <= 0) return
    if (kept.size >= opts.cacheSize) {
      const oldest = kept.keys().next().value
      if (oldest !== undefined) kept.delete(oldest)
    }
    kept.set(key, blob)
  }

  const run = async (key: string, fetchOne: () => Promise<BytesAnswer>): Promise<Blob | null> => {
    await take()
    try {
      for (let attempt = 0; ; attempt += 1) {
        let answer: BytesAnswer
        try {
          answer = await fetchOne()
        } catch {
          // A lost signal: not kept, so the next look asks again.
          return null
        }
        if (answer.status === 429) {
          if (attempt >= opts.retries) return null
          const named = answer.retryAfterSec != null && Number.isFinite(answer.retryAfterSec) && answer.retryAfterSec > 0 ? answer.retryAfterSec * 1000 : null
          await sleep(named ?? backoff(attempt + 1))
          continue
        }
        const blob = answer.status >= 200 && answer.status < 400 && answer.blob && answer.blob.size > 0 ? answer.blob : null
        keep(key, blob)
        return blob
      }
    } finally {
      release()
    }
  }

  return {
    get(key, fetchOne) {
      if (kept.has(key)) return Promise.resolve(kept.get(key) ?? null)
      const open = inFlight.get(key)
      if (open) return open
      const p = run(key, fetchOne).finally(() => inFlight.delete(key))
      inFlight.set(key, p)
      return p
    },
    reset() {
      kept.clear()
    },
    stats: () => ({ running, waiting: waiting.length, kept: kept.size }),
  }
}
