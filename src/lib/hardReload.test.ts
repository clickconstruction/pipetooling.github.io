// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HARD_RELOAD_RESTORE_KEY, WIPE_DEADLINE_MS, hardReloadFromRoot, wipeBeforeLeaving } from './hardReload'

const realLocation = window.location
let went: string | null
/** How many times the page was told to leave. */
let leaves = 0

/** A location the test can read back: jsdom refuses a real navigation. */
function standAt(path: string) {
  const url = new URL(path, 'https://app.example.com')
  went = null
  leaves = 0
  const fake = {
    origin: url.origin,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    get href() {
      return url.href
    },
    set href(next: string) {
      went = next
      leaves++
    },
  }
  Object.defineProperty(window, 'location', { configurable: true, value: fake })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(1700))
  sessionStorage.clear()
})
afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
  delete window.__lens
  Reflect.deleteProperty(navigator, 'serviceWorker')
})

/** The reload waits on the wipe of the workers and the caches, which is a few promise turns. */
async function settle() {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

describe('hardReloadFromRoot', () => {
  it('goes to the root with the mark and keeps the page in sessionStorage for index.html to put back', async () => {
    standAt('/jobs?tab=stages#row')
    hardReloadFromRoot()
    await settle()
    expect(went).toBe('https://app.example.com/?nocache=1700')
    expect(JSON.parse(sessionStorage.getItem(HARD_RELOAD_RESTORE_KEY) ?? 'null')).toEqual({ pathname: '/jobs', search: '?tab=stages', hash: '#row' })
  })

  it('in a sealed lens frame reloads the frame’s own page, since its sessionStorage is memory and keeps nothing (punch list #426)', async () => {
    standAt('/dashboard')
    window.__lens = { config: { as: 'estimator', mood: 'full', theme: 'light' }, asks: [], errors: [] }
    hardReloadFromRoot()
    await settle()
    expect(went).toBe('https://app.example.com/dashboard?nocache=1700')
  })

  it('a sealed frame keeps its page’s own query', async () => {
    standAt('/bids?tab=bid-board')
    window.__lens = { config: { as: 'estimator', mood: 'full', theme: 'light' }, asks: [], errors: [] }
    hardReloadFromRoot()
    await settle()
    expect(went).toBe('https://app.example.com/bids?tab=bid-board&nocache=1700')
  })
})

/** A browser whose one registration answers `unregister()` only when the test says so, as one does behind an install. */
function standBehindAnInstall() {
  let finish: (gone: boolean) => void = () => undefined
  const unregister = vi.fn(() => new Promise<boolean>((resolve) => (finish = resolve)))
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistrations: async () => [{ unregister }] },
  })
  return { unregister, finish: (gone: boolean) => finish(gone) }
}

describe('wipeBeforeLeaving: the wipe never holds a page for good (punch list #406)', () => {
  it('answers as soon as the wipe is done, and leaves no timer behind', async () => {
    // jsdom's own storage events are timers too, so the count is read against what was already there.
    const before = vi.getTimerCount()
    await expect(wipeBeforeLeaving(async () => undefined)).resolves.toBe('wiped')
    expect(vi.getTimerCount()).toBe(before)
  })

  it('answers at the deadline when the wipe never settles', async () => {
    let answer: string | null = null
    void wipeBeforeLeaving(() => new Promise<void>(() => undefined)).then((how) => (answer = how))
    await vi.advanceTimersByTimeAsync(WIPE_DEADLINE_MS - 1)
    expect(answer).toBeNull()
    await vi.advanceTimersByTimeAsync(1)
    expect(answer).toBe('deadline')
  })

  it('a wipe that rejects or throws still answers, at once', async () => {
    const before = vi.getTimerCount()
    await expect(wipeBeforeLeaving(() => Promise.reject(new Error('blocked')))).resolves.toBe('wiped')
    await expect(
      wipeBeforeLeaving(() => {
        throw new Error('no such API')
      }),
    ).resolves.toBe('wiped')
    expect(vi.getTimerCount()).toBe(before)
  })

  it('waits three seconds at most', () => {
    expect(WIPE_DEADLINE_MS).toBe(3_000)
  })
})

describe('hardReloadFromRoot behind a worker that will not unregister (punch list #406)', () => {
  it('leaves at the deadline, with the page kept for index.html to put back', async () => {
    standAt('/jobs?tab=stages')
    const worker = standBehindAnInstall()
    hardReloadFromRoot()
    await settle()
    expect(worker.unregister).toHaveBeenCalledTimes(1)
    expect(went).toBeNull()
    await vi.advanceTimersByTimeAsync(WIPE_DEADLINE_MS - 1)
    expect(went).toBeNull()
    await vi.advanceTimersByTimeAsync(1)
    expect(went).toBe('https://app.example.com/?nocache=1700')
    expect(JSON.parse(sessionStorage.getItem(HARD_RELOAD_RESTORE_KEY) ?? 'null')).toEqual({ pathname: '/jobs', search: '?tab=stages', hash: '' })
  })

  it('leaves once, though the unregister answers after the deadline', async () => {
    standAt('/dashboard')
    const worker = standBehindAnInstall()
    hardReloadFromRoot()
    await vi.advanceTimersByTimeAsync(WIPE_DEADLINE_MS)
    expect(leaves).toBe(1)
    worker.finish(true)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(leaves).toBe(1)
  })

  it('leaves as soon as the unregister answers, with no wait for the deadline', async () => {
    standAt('/dashboard')
    const worker = standBehindAnInstall()
    hardReloadFromRoot()
    await settle()
    expect(went).toBeNull()
    worker.finish(true)
    await settle()
    expect(leaves).toBe(1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(leaves).toBe(1)
  })
})
