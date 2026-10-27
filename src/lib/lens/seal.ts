/**
 * The seal (punch list #194). The first import in main.tsx, so it runs before any other module.
 * In every window the lens did not name it returns at once and changes nothing. In a frame named
 * `pipetooling-lens:{...}` it swaps the browser's pieces before the app starts:
 *
 * - `localStorage` and `sessionStorage` become memory stores, seeded with the frame's invented
 *   session and its theme, so the dev's own session and settings are never read or written;
 * - `fetch` to the Supabase address goes to the invented world (`answer/lensEngine.ts`, loaded on
 *   the first request); every other address goes out as normal;
 * - a socket to the realtime address is a quiet one that only answers the handshake;
 * - IndexedDB and the cache store are hidden, so the Pipeline board's remembered copy and a hard
 *   reload stay the dev's own;
 * - BroadcastChannel, navigator.locks and document.cookie are the frame's own, and no real storage
 *   event reaches it, so the auth client can neither announce its session to the dev's window nor
 *   hear the dev's real one;
 * - location, notifications and the online flag answer from the frame's state;
 * - a new tab opened from the frame carries the name, so it stays sealed.
 *
 * A sealed frame never holds a real token, so nothing it sends could be authorized. The name is a
 * soft gate, not a lock: anyone who names a window sees the invented world, which holds no real row
 * and no secret.
 */
import { frameBroadcastChannel, frameCookieJar, frameLocks } from './frameChannels'
import { authStorageKey, lensSession } from './lensAuth'
import { formatLensName, parseLensName, type LensConfig } from './lensName'
import { LENS_PEOPLE } from './lensPeople'
import { memoryStorage } from './memoryStorage'
import { QuietSocket } from './quietSocket'
import type { LensAsk, LensEngine } from './answer/lensEngine'

export type LensFrameState = {
  config: LensConfig
  /** Every request the frame made and who answered it, in order. */
  asks: LensAsk[]
}

declare global {
  interface Window {
    __lens?: LensFrameState
  }
}

/** Kyle, Texas: where the sample homeowner lives. */
const LENS_POSITION = { latitude: 29.9891, longitude: -97.8772 }

function define(obj: object, key: string, value: unknown) {
  Object.defineProperty(obj, key, { configurable: true, enumerable: true, get: () => value })
}

async function bodyText(body: unknown): Promise<string | null> {
  if (body == null) return null
  if (typeof body === 'string') return body
  if (body instanceof URLSearchParams) return body.toString()
  return null
}

export function installSeal(win: Window & typeof globalThis, cfg: LensConfig, supabaseUrl: string, load: () => Promise<{ createLensEngine: (c: LensConfig, o: { report: (a: LensAsk) => void }) => LensEngine }> = () => import('./answer/lensEngine')): LensFrameState {
  const person = LENS_PEOPLE[cfg.as]
  const state: LensFrameState = { config: cfg, asks: [] }
  win.__lens = state

  // Storage: memory, seeded with the invented session and the frame's theme.
  const nowSec = Math.floor(Date.now() / 1000)
  define(win, 'localStorage', memoryStorage({ [authStorageKey(supabaseUrl)]: JSON.stringify(lensSession(person, nowSec)), themeOverride: cfg.theme }))
  define(win, 'sessionStorage', memoryStorage())
  define(win, 'indexedDB', undefined)
  define(win, 'caches', {
    keys: async () => [],
    has: async () => false,
    delete: async () => true,
    match: async () => undefined,
    open: async () => ({ match: async () => undefined, put: async () => undefined, add: async () => undefined, delete: async () => true, keys: async () => [] }),
  })

  // Cross-window channels: the frame's own. supabase-js's auth client opens a BroadcastChannel named
  // after its storage key in every window and takes navigator.locks under it, so without these the
  // frame would announce its invented session to the dev's window and hear the dev's real one.
  define(win, 'BroadcastChannel', frameBroadcastChannel(win))
  define(win.navigator, 'locks', frameLocks())
  const jar = frameCookieJar()
  Object.defineProperty(win.document, 'cookie', { configurable: true, get: jar.get, set: jar.set })
  // A write to the real localStorage in the dev's other windows fires a storage event here too.
  // The frame's own storage is memory and fires none, so a trusted storage event is never the frame's.
  win.addEventListener('storage', (e) => e.isTrusted && e.stopImmediatePropagation(), true)

  // The network: the Supabase address goes to the world.
  const realFetch = win.fetch.bind(win)
  let engine: Promise<LensEngine> | null = null
  const getEngine = () =>
    (engine ??= load().then((m) =>
      m.createLensEngine(cfg, {
        report: (a) => {
          state.asks.push(a)
          win.dispatchEvent(new win.CustomEvent('lens:ask', { detail: a }))
        },
      }),
    ))
  win.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!href.startsWith(supabaseUrl)) return realFetch(input, init)
    const req = typeof input === 'object' && !(input instanceof URL) ? input : null
    const method = (init?.method ?? req?.method ?? 'GET').toUpperCase()
    const headers = new Headers(init?.headers ?? req?.headers)
    const text = init?.body != null ? await bodyText(init.body) : req ? await req.clone().text() : null
    return (await getEngine()).handle(new URL(href), { method, headers, bodyText: text })
  }

  // Realtime: a socket that answers the handshake and stays quiet.
  const RealSocket = win.WebSocket
  const realtimeBase = supabaseUrl.replace(/^http/, 'ws')
  function SealedSocket(url: string | URL, protocols?: string | string[]) {
    return String(url).startsWith(realtimeBase) ? new QuietSocket(String(url)) : new RealSocket(url, protocols)
  }
  Object.assign(SealedSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 })
  win.WebSocket = SealedSocket as unknown as typeof WebSocket

  // Sensors: the frame's state answers.
  const offline = cfg.mood === 'offline'
  const position = () => ({ coords: { ...LENS_POSITION, accuracy: 25, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() })
  define(win.navigator, 'geolocation', {
    getCurrentPosition: (ok: (p: unknown) => void, fail?: (e: unknown) => void) => setTimeout(() => (offline ? fail?.({ code: 2, message: 'Position unavailable' }) : ok(position())), 0),
    watchPosition: (ok: (p: unknown) => void) => {
      setTimeout(() => !offline && ok(position()), 0)
      return 1
    },
    clearWatch: () => undefined,
  })
  define(win.navigator, 'onLine', !offline)
  define(win, 'Notification', Object.assign(function Notification() {}, { permission: 'denied', requestPermission: async () => 'denied' }))

  // New tabs from the frame carry its name, so they stay sealed.
  const realOpen = win.open.bind(win)
  const sealedName = () => formatLensName({ ...cfg, n: Math.random().toString(36).slice(2) })
  win.open = (url?: string | URL, target?: string, features?: string) => {
    const href = url == null ? '' : String(url)
    let sameOrigin = true
    try {
      sameOrigin = href === '' || new URL(href, win.location.href).origin === win.location.origin
    } catch {
      sameOrigin = false
    }
    if (!sameOrigin || target === '_self') return realOpen(url, target, features)
    return realOpen(url, sealedName(), features)
  }
  win.document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as Element | null)?.closest?.('a[target]') as HTMLAnchorElement | null
      if (!a || !a.href || a.target === '' || a.target === '_self') return
      let u: URL
      try {
        u = new URL(a.href, win.location.href)
      } catch {
        return
      }
      if (u.origin !== win.location.origin) return
      e.preventDefault()
      win.open(u.href, '_blank')
    },
    true,
  )

  // A small mark, so a sealed frame opened alone is never taken for the real app.
  const mark = () => {
    if (win.document.querySelector('[data-lens-mark]')) return
    const el = win.document.createElement('div')
    el.setAttribute('data-lens-mark', '')
    el.setAttribute('aria-hidden', 'true')
    el.textContent = `Lens · invented data · ${person.label}`
    Object.assign(el.style, { position: 'fixed', left: '8px', bottom: '8px', zIndex: '2147483647', pointerEvents: 'none', font: '600 11px/1.5 system-ui, sans-serif', padding: '1px 8px', borderRadius: '999px', background: 'var(--bg-violet-100)', color: 'var(--text-violet-700)', border: '1px solid currentColor', opacity: '0.92' })
    win.document.body.appendChild(el)
  }
  if (win.document.readyState === 'loading') win.document.addEventListener('DOMContentLoaded', mark)
  else mark()
  if (offline) setTimeout(() => win.dispatchEvent(new win.Event('offline')), 0)
  return state
}

// Runs on import. Without the lens's name this is the whole module's cost: one string check.
const config = typeof window === 'undefined' ? null : parseLensName(window.name)
if (config) installSeal(window, config, import.meta.env.VITE_SUPABASE_URL)
