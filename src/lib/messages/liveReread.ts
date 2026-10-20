/**
 * v2.5572: one live bus for Messages. The page, the thread window, Follow up and the header's badge each read once and
 * again after their own presses; a line the webhook wrote stayed unseen until a reload. The bus holds one realtime
 * channel while anyone listens (`attach` on the first listener, `detach` after the last), settles a burst of events
 * (a line in, its delivery, the contact's stamp) into one read `settleMs` after the last, and fires every listener.
 * Pure: the hook (`useMessagesLive.ts`) binds it to Supabase; the tests run it on fake timers.
 */

export const LIVE_SETTLE_MS = 400

export interface LiveBusHooks {
  /** The first listener arrived: open the channel. */
  attach: () => void
  /** The last listener left: close it. A settle still pending is dropped first. */
  detach: () => void
  settleMs?: number
}

export interface LiveBus {
  /** Hears every settled change until the returned function is called. */
  subscribe(listener: () => void): () => void
  /** A change happened: read once, `settleMs` after the last bump. */
  bump(): void
  /** Read now, with nothing pending after. */
  fire(): void
  readonly size: number
}

export function makeLiveBus(hooks: LiveBusHooks): LiveBus {
  const listeners = new Set<() => void>()
  const settleMs = hooks.settleMs ?? LIVE_SETTLE_MS
  let pending: ReturnType<typeof setTimeout> | null = null
  const cancel = () => {
    if (pending !== null) clearTimeout(pending)
    pending = null
  }
  const fire = () => {
    cancel()
    for (const l of [...listeners]) l()
  }
  return {
    subscribe(listener) {
      const first = listeners.size === 0
      listeners.add(listener)
      if (first) hooks.attach()
      let on = true
      return () => {
        if (!on) return
        on = false
        listeners.delete(listener)
        if (listeners.size === 0) {
          cancel()
          hooks.detach()
        }
      }
    },
    bump() {
      if (listeners.size === 0) return
      cancel()
      pending = setTimeout(fire, settleMs)
    },
    fire,
    get size() {
      return listeners.size
    },
  }
}
