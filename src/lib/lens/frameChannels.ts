/**
 * The cross-window channels a sealed frame keeps to itself (punch list #194). Same-origin windows
 * share more than storage: supabase-js's auth client opens a BroadcastChannel named after its
 * storage key in every window, so a frame would announce its invented session to the dev's own
 * window and hear the dev's real one; it takes `navigator.locks` under the same name, so a frame
 * would hold the dev's lock; and a write to the real localStorage fires a `storage` event in every
 * other window. A sealed frame gets channels and locks of its own, a cookie jar of its own, and
 * hears no real storage event. Pure, apart from what it is handed.
 */

type Listener = (ev: MessageEvent) => void

/** A BroadcastChannel whose messages reach only channels of the same name in the same frame. */
export function frameBroadcastChannel(win: Window & typeof globalThis): typeof BroadcastChannel {
  const open = new Map<string, Set<FrameChannel>>()
  class FrameChannel {
    onmessage: Listener | null = null
    onmessageerror: Listener | null = null
    private closed = false
    private listeners = new Set<Listener>()
    constructor(public readonly name: string) {
      if (!open.has(name)) open.set(name, new Set())
      open.get(name)!.add(this)
    }
    addEventListener(type: string, fn: Listener) {
      if (type === 'message') this.listeners.add(fn)
    }
    removeEventListener(type: string, fn: Listener) {
      if (type === 'message') this.listeners.delete(fn)
    }
    postMessage(data: unknown) {
      if (this.closed) throw new win.DOMException('BroadcastChannel is closed', 'InvalidStateError')
      for (const other of open.get(this.name) ?? []) {
        if (other === this) continue
        win.setTimeout(() => other.deliver(data), 0)
      }
    }
    private deliver(data: unknown) {
      if (this.closed) return
      const ev = new win.MessageEvent('message', { data })
      this.onmessage?.(ev)
      for (const fn of this.listeners) fn(ev)
    }
    close() {
      this.closed = true
      open.get(this.name)?.delete(this)
    }
  }
  return FrameChannel as unknown as typeof BroadcastChannel
}

type LockFn = (lock: { name: string; mode: 'exclusive' | 'shared' } | null) => unknown
type LockOptions = { ifAvailable?: boolean; mode?: 'exclusive' | 'shared'; signal?: AbortSignal }

/**
 * `navigator.locks` for one frame: exclusive locks, queued per name, never shared with another
 * window. As the real one does, a lock is held from the moment it is granted, its callback runs a
 * tick later, `ifAvailable` answers null while the name is held or waited for, and an abort while
 * waiting leaves the queue with an AbortError.
 */
export function frameLocks() {
  const held = new Set<string>()
  const waiting = new Map<string, (() => void)[]>()
  const next = (name: string) => {
    const q = waiting.get(name)
    const start = q?.shift()
    if (q && q.length === 0) waiting.delete(name)
    start?.()
  }
  return {
    request(name: string, a: LockFn | LockOptions, b?: LockFn): Promise<unknown> {
      const fn = (typeof a === 'function' ? a : b) as LockFn
      const opts: LockOptions = typeof a === 'function' ? {} : a
      const busy = held.has(name) || (waiting.get(name)?.length ?? 0) > 0
      if (opts.ifAvailable && busy) return Promise.resolve().then(() => fn(null))
      return new Promise((resolve, reject) => {
        if (opts.signal?.aborted) return reject(new DOMException('The lock request was aborted', 'AbortError'))
        const start = () => {
          held.add(name)
          Promise.resolve()
            .then(() => fn({ name, mode: opts.mode ?? 'exclusive' }))
            .then(resolve, reject)
            .finally(() => {
              held.delete(name)
              next(name)
            })
        }
        if (!busy) return start()
        const q = waiting.get(name) ?? []
        q.push(start)
        waiting.set(name, q)
        opts.signal?.addEventListener('abort', () => {
          const at = q.indexOf(start)
          if (at < 0) return
          q.splice(at, 1)
          reject(new DOMException('The lock request was aborted', 'AbortError'))
        })
      })
    },
    query: async () => ({ held: [...held].map((name) => ({ name, mode: 'exclusive' as const })), pending: [...waiting.entries()].flatMap(([name, q]) => q.map(() => ({ name, mode: 'exclusive' as const }))) }),
  }
}

/** `document.cookie` for one frame: a jar in memory that reads and writes as the real one. */
export function frameCookieJar() {
  const jar = new Map<string, string>()
  return {
    get: () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; '),
    set: (raw: string) => {
      const [pair, ...attrs] = String(raw).split(';')
      const eq = (pair ?? '').indexOf('=')
      if (eq <= 0) return
      const key = pair!.slice(0, eq).trim()
      const value = pair!.slice(eq + 1).trim()
      const expires = attrs.map((x) => x.trim()).find((x) => /^expires=/i.test(x))
      const maxAge = attrs.map((x) => x.trim()).find((x) => /^max-age=/i.test(x))
      const gone = (maxAge && Number(maxAge.split('=')[1]) <= 0) || (expires && Date.parse(expires.slice(8)) < Date.now())
      if (gone) jar.delete(key)
      else jar.set(key, value)
    },
  }
}
