// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HARD_RELOAD_RESTORE_KEY, hardReloadFromRoot } from './hardReload'

const realLocation = window.location
let went: string | null

/** A location the test can read back: jsdom refuses a real navigation. */
function standAt(path: string) {
  const url = new URL(path, 'https://app.example.com')
  went = null
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
