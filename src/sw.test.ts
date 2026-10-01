// The service worker's notificationclick wiring (v2.4323), run against the real
// src/sw.ts with workbox mocked; the URL rules live in lib/notificationClick.test.ts.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('workbox-precaching', () => ({
  cleanupOutdatedCaches: vi.fn(),
  createHandlerBoundToURL: vi.fn(() => vi.fn()),
  precacheAndRoute: vi.fn(),
}))
vi.mock('workbox-routing', () => ({ NavigationRoute: vi.fn(), registerRoute: vi.fn() }))
vi.mock('workbox-core', () => ({ clientsClaim: vi.fn() }))

const listeners = new Map<string, (event: unknown) => void>()
const clients = { matchAll: vi.fn(), openWindow: vi.fn(async () => null) }

beforeAll(async () => {
  vi.stubGlobal('self', {
    __WB_MANIFEST: [],
    location: new URL('https://clicktooling.com/sw.js'),
    addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener),
    clients,
    registration: { showNotification: vi.fn() },
    skipWaiting: vi.fn(),
  })
  await import('./sw')
})

afterAll(() => {
  vi.unstubAllGlobals()
})

function appWindow(url: string) {
  return { url, focus: vi.fn(async () => undefined), navigate: vi.fn(async () => undefined) }
}

/** Taps a notification carrying `url` and waits out the event's lifetime (a throw fails the test). */
async function tap(url: unknown, windows: ReturnType<typeof appWindow>[]) {
  clients.matchAll.mockResolvedValueOnce(windows)
  clients.openWindow.mockClear()
  const onClick = listeners.get('notificationclick')
  expect(onClick).toBeTypeOf('function')
  let lifetime: Promise<unknown> = Promise.resolve()
  onClick?.({
    notification: { close: vi.fn(), data: { url } },
    waitUntil: (promise: Promise<unknown>) => {
      lifetime = promise
    },
  })
  await lifetime
}

describe('notificationclick', () => {
  it('a path, with the app already open: focuses that window and navigates it to the page', async () => {
    const win = appWindow('https://clicktooling.com/dashboard')
    await tap('/bids?tab=counts&bidId=b1', [win])
    expect(win.focus).toHaveBeenCalledTimes(1)
    expect(win.navigate).toHaveBeenCalledWith('https://clicktooling.com/bids?tab=counts&bidId=b1')
    expect(clients.openWindow).not.toHaveBeenCalled()
  })

  it('a full workflow link, with the app already open: the same', async () => {
    const win = appWindow('https://clicktooling.com/dashboard')
    await tap('https://clicktooling.com/workflows/p1#step-s2', [win])
    expect(win.focus).toHaveBeenCalledTimes(1)
    expect(win.navigate).toHaveBeenCalledWith('https://clicktooling.com/workflows/p1#step-s2')
    expect(clients.openWindow).not.toHaveBeenCalled()
  })

  it('no app window open: opens one on the page', async () => {
    await tap('/checklist', [])
    expect(clients.openWindow).toHaveBeenCalledWith('https://clicktooling.com/checklist')
  })
})
