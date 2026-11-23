import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CHUNK_RECOVERY_KEY,
  CHUNK_RECOVERY_MIN_INTERVAL_MS,
  CHUNK_RELOAD_SETTLE_MS,
  CHUNK_RELOAD_WAIT_MAX_MS,
  chunkBoundaryView,
  chunkRecoveryReloadStarted,
  decideChunkReloadWait,
  forgetChunkRecoveryReload,
  isChunkLoadError,
  startChunkRecoveryReload,
  tryClaimChunkRecoveryReload,
  type WriteWatch,
} from './chunkLoadRecovery'

function fakeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v)
    },
    dump: () => Object.fromEntries(store),
  }
}

describe('isChunkLoadError', () => {
  it('detects the Chrome/Edge dynamic import failure', () => {
    expect(
      isChunkLoadError(
        new TypeError('Failed to fetch dynamically imported module: https://x/assets/Jobs-abc123.js'),
      ),
    ).toBe(true)
  })

  it('detects the Firefox dynamic import failure', () => {
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true)
  })

  it('detects the Safari module script failure', () => {
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
  })

  it('detects the Vite CSS preload failure', () => {
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/Jobs-abc.css'))).toBe(true)
  })

  it('detects errors named ChunkLoadError regardless of message', () => {
    const err = new Error('Loading chunk 42 failed')
    err.name = 'ChunkLoadError'
    expect(isChunkLoadError(err)).toBe(true)
  })

  it('detects plain-string errors', () => {
    expect(isChunkLoadError('Failed to fetch dynamically imported module: x')).toBe(true)
  })

  it('rejects ordinary errors, null, and unrelated values', () => {
    expect(isChunkLoadError(new Error("Cannot read properties of undefined (reading 'map')"))).toBe(false)
    expect(isChunkLoadError(new TypeError('Failed to fetch'))).toBe(false) // plain network fetch, not an import
    expect(isChunkLoadError(null)).toBe(false)
    expect(isChunkLoadError(undefined)).toBe(false)
    expect(isChunkLoadError(42)).toBe(false)
    expect(isChunkLoadError({})).toBe(false)
  })
})

describe('tryClaimChunkRecoveryReload', () => {
  it('allows the first attempt and records the timestamp', () => {
    const storage = fakeStorage()
    expect(tryClaimChunkRecoveryReload(1_000_000, storage)).toBe(true)
    expect(storage.dump()[CHUNK_RECOVERY_KEY]).toBe('1000000')
  })

  it('blocks a second attempt inside the interval', () => {
    const storage = fakeStorage()
    expect(tryClaimChunkRecoveryReload(1_000_000, storage)).toBe(true)
    expect(tryClaimChunkRecoveryReload(1_000_000 + CHUNK_RECOVERY_MIN_INTERVAL_MS - 1, storage)).toBe(false)
    // The blocked attempt must not extend the window
    expect(storage.dump()[CHUNK_RECOVERY_KEY]).toBe('1000000')
  })

  it('allows again once the interval has elapsed', () => {
    const storage = fakeStorage()
    expect(tryClaimChunkRecoveryReload(1_000_000, storage)).toBe(true)
    expect(tryClaimChunkRecoveryReload(1_000_000 + CHUNK_RECOVERY_MIN_INTERVAL_MS, storage)).toBe(true)
    expect(storage.dump()[CHUNK_RECOVERY_KEY]).toBe(String(1_000_000 + CHUNK_RECOVERY_MIN_INTERVAL_MS))
  })

  it('ignores a corrupt stored value', () => {
    const storage = fakeStorage({ [CHUNK_RECOVERY_KEY]: 'not-a-number' })
    expect(tryClaimChunkRecoveryReload(1_000_000, storage)).toBe(true)
  })

  it('allows the reload when storage is missing or throwing', () => {
    expect(tryClaimChunkRecoveryReload(1_000_000, null)).toBe(true)
    expect(tryClaimChunkRecoveryReload(1_000_000, undefined)).toBe(true)
    const throwing = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    }
    expect(tryClaimChunkRecoveryReload(1_000_000, throwing)).toBe(true)
  })
})

describe('startChunkRecoveryReload', () => {
  beforeEach(() => forgetChunkRecoveryReload())

  it('claims the guard, reloads once and remembers that the reload is on its way', () => {
    const storage = fakeStorage()
    let reloads = 0
    expect(chunkRecoveryReloadStarted()).toBe(false)
    expect(startChunkRecoveryReload(1_000_000, storage, () => reloads++)).toBe(true)
    expect(reloads).toBe(1)
    expect(storage.dump()[CHUNK_RECOVERY_KEY]).toBe('1000000')
    expect(chunkRecoveryReloadStarted()).toBe(true)
  })

  it('starts nothing when a reload already ran inside the interval', () => {
    const storage = fakeStorage({ [CHUNK_RECOVERY_KEY]: '1000000' })
    let reloads = 0
    expect(startChunkRecoveryReload(1_000_000 + 5_000, storage, () => reloads++)).toBe(false)
    expect(reloads).toBe(0)
    expect(chunkRecoveryReloadStarted()).toBe(false)
  })

  it('starts nothing while the browser says it is offline, and leaves the guard for when the signal is back', () => {
    const storage = fakeStorage()
    let reloads = 0
    expect(startChunkRecoveryReload(1_000_000, storage, () => reloads++, undefined, true)).toBe(false)
    expect(reloads).toBe(0)
    expect(chunkRecoveryReloadStarted()).toBe(false)
    expect(storage.dump()[CHUNK_RECOVERY_KEY]).toBeUndefined()
    // Back online a moment later: the one reload is still there to take.
    expect(startChunkRecoveryReload(1_000_000 + 2_000, storage, () => reloads++, undefined, false)).toBe(true)
    expect(reloads).toBe(1)
  })
})

describe('decideChunkReloadWait: the reload waits for a write', () => {
  const idle = { inFlightWrites: 0, msSinceStarted: 0, msSinceWriteSettled: null }

  it('reloads at once when nothing is in flight', () => {
    expect(decideChunkReloadWait(idle)).toEqual({ act: 'reload', reason: 'nothing in flight' })
  })
  it('waits for a write in flight, and looks again no later than the give-up', () => {
    expect(decideChunkReloadWait({ ...idle, inFlightWrites: 2, msSinceStarted: 4_000 })).toEqual({
      act: 'wait',
      reason: '2 write(s) in flight',
      lookAgainInMs: CHUNK_RELOAD_WAIT_MAX_MS - 4_000,
    })
  })
  it('stays a beat after a write comes back: the next one of a chain may follow', () => {
    expect(decideChunkReloadWait({ ...idle, msSinceStarted: 2_000, msSinceWriteSettled: 500 })).toEqual({
      act: 'wait',
      reason: 'a write just came back, another may follow',
      lookAgainInMs: CHUNK_RELOAD_SETTLE_MS - 500,
    })
    expect(decideChunkReloadWait({ ...idle, msSinceStarted: 3_000, msSinceWriteSettled: CHUNK_RELOAD_SETTLE_MS }).act).toBe('reload')
  })
  it('a lost page does not wait for ever: at the give-up it reloads whatever is in flight', () => {
    expect(decideChunkReloadWait({ ...idle, inFlightWrites: 1, msSinceStarted: CHUNK_RELOAD_WAIT_MAX_MS }).act).toBe('reload')
    // The beat never runs past the give-up either.
    const nearEnd = decideChunkReloadWait({ ...idle, msSinceStarted: CHUNK_RELOAD_WAIT_MAX_MS - 200, msSinceWriteSettled: 0 })
    expect(nearEnd).toMatchObject({ act: 'wait', lookAgainInMs: 200 })
  })
})

describe('startChunkRecoveryReload with a write in flight', () => {
  /** A stand-in for unsavedWork.ts: a count a test moves, and the listeners it tells. */
  function fakeWrites(start = 0) {
    let count = start
    const listeners = new Set<() => void>()
    const watch: WriteWatch = {
      count: () => count,
      subscribe: (cb) => {
        listeners.add(cb)
        return () => void listeners.delete(cb)
      },
    }
    return {
      watch,
      set(next: number) {
        count = next
        for (const cb of [...listeners]) cb()
      },
      listeners: () => listeners.size,
    }
  }

  beforeEach(() => {
    forgetChunkRecoveryReload()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('is started and on its way at once, but reloads only after the write is back and the beat has passed', () => {
    const writes = fakeWrites(1)
    let reloads = 0
    expect(startChunkRecoveryReload(Date.now(), fakeStorage(), () => reloads++, writes.watch)).toBe(true)
    // "Updating app…" draws from this, while the save finishes behind it.
    expect(chunkRecoveryReloadStarted()).toBe(true)
    vi.advanceTimersByTime(5_000)
    expect(reloads).toBe(0)
    writes.set(0)
    expect(reloads).toBe(0)
    vi.advanceTimersByTime(CHUNK_RELOAD_SETTLE_MS - 1)
    expect(reloads).toBe(0)
    vi.advanceTimersByTime(1)
    expect(reloads).toBe(1)
    expect(writes.listeners()).toBe(0)
  })

  it('a second write behind the first holds it too, and it reloads once', () => {
    const writes = fakeWrites(1)
    let reloads = 0
    startChunkRecoveryReload(Date.now(), fakeStorage(), () => reloads++, writes.watch)
    writes.set(0)
    vi.advanceTimersByTime(1_000)
    writes.set(1)
    vi.advanceTimersByTime(4_000)
    expect(reloads).toBe(0)
    writes.set(0)
    vi.advanceTimersByTime(CHUNK_RELOAD_SETTLE_MS)
    expect(reloads).toBe(1)
    vi.advanceTimersByTime(60_000)
    expect(reloads).toBe(1)
  })

  it('a write that never comes back does not hold a lost page past the give-up', () => {
    const writes = fakeWrites(1)
    let reloads = 0
    startChunkRecoveryReload(Date.now(), fakeStorage(), () => reloads++, writes.watch)
    vi.advanceTimersByTime(CHUNK_RELOAD_WAIT_MAX_MS - 1)
    expect(reloads).toBe(0)
    vi.advanceTimersByTime(1)
    expect(reloads).toBe(1)
  })

  it('a write that begins after the start does not matter once the reload has gone', () => {
    const writes = fakeWrites(0)
    let reloads = 0
    startChunkRecoveryReload(Date.now(), fakeStorage(), () => reloads++, writes.watch)
    expect(reloads).toBe(1)
    writes.set(1)
    writes.set(0)
    vi.advanceTimersByTime(60_000)
    expect(reloads).toBe(1)
  })
})

describe('chunkBoundaryView', () => {
  const lostChunk = new TypeError('Failed to fetch dynamically imported module: https://x/assets/BoxCode-abc123.js')
  // What React reports when the preload handler cancelled Vite's throw: the lazy page resolved to nothing.
  const emptyLazy = new TypeError("Cannot read properties of undefined (reading 'default')")

  it('draws the page while nothing is caught, a reload on its way or not', () => {
    expect(chunkBoundaryView(null, false)).toBe('page')
    expect(chunkBoundaryView(null, true)).toBe('page')
  })

  it('draws Updating for any error while a recovery reload is on its way', () => {
    expect(chunkBoundaryView(lostChunk, true)).toBe('updating')
    expect(chunkBoundaryView(emptyLazy, true)).toBe('updating')
  })

  it('names a lost chunk apart from any other error when no reload is on its way', () => {
    expect(chunkBoundaryView(lostChunk, false)).toBe('lost-chunk')
    expect(chunkBoundaryView(emptyLazy, false)).toBe('broken')
  })
})
