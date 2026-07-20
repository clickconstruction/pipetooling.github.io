import { describe, expect, it } from 'vitest'
import {
  CHUNK_RECOVERY_KEY,
  CHUNK_RECOVERY_MIN_INTERVAL_MS,
  isChunkLoadError,
  tryClaimChunkRecoveryReload,
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
