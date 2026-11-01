import { useCallback, useEffect, useRef } from 'react'
import { appHealth, type AppHealthStore } from '../lib/appHealth'
import { landFieldPress, type LandOutcome } from '../lib/offline/landFieldPress'
import { afterLanding, type AfterLandingIo } from '../lib/offline/afterLanding'
import {
  markDueNow,
  markRefused,
  markSending,
  markSent,
  markTryFailed,
  nextDueAt,
  nextToSend,
  settleDependents,
  type OutboxPress,
} from '../lib/offline/outbox'
import { outbox, type OutboxStateStore } from '../lib/offline/outboxState'
import { KEPT_PHOTO_MAX_AGE_MS, keptPhotos, sendKeptPhotos, unsentKeptPhotos, type SendKeptIo } from '../lib/offline/keptPhotos'

/**
 * The replay (punch list #163 PR 2): the one sender, mounted once in `Layout`. It sends the queue
 * in the order pressed, one press at a time, whenever the queue changes, the browser's `online`
 * event fires, the app-health kernel turns fine again, the page comes back to the front, or the
 * oldest waiting press's try comes due by the retry rule. A send that fails at the fetch layer
 * stops the run (one lost signal costs one request); a refusal keeps the press with the server's
 * reason and the run goes on to the next; a landing fires `OUTBOX_LANDED_EVENT` on `window`, so
 * the clock and the Job Mode card read again.
 */

export const OUTBOX_LANDED_EVENT = 'pipetooling:outbox-landed'

export interface OutboxLandedDetail {
  pressId: string
  kind: OutboxPress['kind']
  result: unknown
}

export function dispatchLanded(detail: OutboxLandedDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<OutboxLandedDetail>(OUTBOX_LANDED_EVENT, { detail }))
}

function browserOnline(): boolean {
  return typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean' ? true : navigator.onLine
}

/** Refuse what depends on a refused press; the same list back when nothing changed. */
function settled(presses: readonly OutboxPress[]): readonly OutboxPress[] {
  const next = settleDependents(presses)
  return next.some((p, i) => p !== presses[i]) ? next : presses
}

export interface OutboxReplayIo {
  store?: OutboxStateStore
  land?: (press: OutboxPress) => Promise<LandOutcome>
  /** What follows a landing (a report's notifications and stamps); the app's unless a test passes its own. */
  after?: AfterLandingIo
  health?: AppHealthStore
  online?: () => boolean
  now?: () => number
  /** The kept photos' send (punch list #229, PR 6); the app's unless a test passes its own. */
  sendKept?: (press: OutboxPress, store: OutboxStateStore) => Promise<{ ok: true } | { ok: false; error: unknown }>
}

/**
 * Send what is due, in order, until the queue is empty, a try fails, or the browser says offline.
 * Exported for the hook and for a test; the hook keeps one run at a time.
 */
export async function replayOutbox(io: OutboxReplayIo = {}): Promise<void> {
  const store = io.store ?? outbox
  const land = io.land ?? landFieldPress
  const online = io.online ?? browserOnline
  const now = io.now ?? Date.now
  for (;;) {
    const current = settled(store.presses())
    if (current !== store.presses()) store.replace(current)
    if (!online()) return
    const next = nextToSend(current, now())
    if (!next) return
    let sending = markSending(next, now())
    store.put(sending)
    // A kept report's photos go first (punch list #229, PR 6), each marked sent on the press as it lands; a photo
    // that does not send counts as the press's failed try, and the report waits with it.
    if (sending.kind === 'field-report' && unsentKeptPhotos(sending).length > 0) {
      const photosOut = await (io.sendKept ?? ((p, s) => sendKeptPhotos(p, s, {} as SendKeptIo)))(sending, store)
      const fresh = store.presses().find((p) => p.id === sending.id)
      if (!fresh) return
      sending = { ...fresh, state: 'sending' }
      if (!photosOut.ok) {
        store.put(markTryFailed(sending, now()))
        return
      }
    }
    const outcome = await land(sending)
    // The press may have been dropped from the list while in flight (a sign-out): nothing to record.
    if (!store.presses().some((p) => p.id === sending.id)) return
    if (outcome.kind === 'landed') {
      store.put(markSent(sending, outcome.result, now()))
      dispatchLanded({ pressId: sending.id, kind: sending.kind, result: outcome.result })
      await afterLanding(sending, outcome.result, io.after)
      continue
    }
    if (outcome.kind === 'refused') {
      store.put(markRefused(sending, outcome.refusal))
      continue
    }
    store.put(markTryFailed(sending, now()))
    return
  }
}

export function useOutboxReplay(userId: string | null | undefined, io: OutboxReplayIo = {}): { tryNow: () => void } {
  const store = io.store ?? outbox
  const health = io.health ?? appHealth
  const ioRef = useRef(io)
  ioRef.current = io
  const runningRef = useRef(false)
  const againRef = useRef(false)

  const run = useCallback(() => {
    if (!userId) return
    if (runningRef.current) {
      againRef.current = true
      return
    }
    runningRef.current = true
    void replayOutbox(ioRef.current).finally(() => {
      runningRef.current = false
      if (againRef.current) {
        againRef.current = false
        // Something changed mid-run: look once more.
        queueMicrotask(run)
      }
    })
  }, [userId])

  // The queue changed: send what is due, and set one timer for the next due press.
  useEffect(() => {
    if (!userId) return
    let timer: number | null = null
    const arm = () => {
      if (timer != null) window.clearTimeout(timer)
      timer = null
      const due = nextDueAt(store.presses(), Date.now())
      if (due == null) return
      timer = window.setTimeout(() => {
        timer = null
        run()
      }, Math.max(1, due - Date.now() + 1))
    }
    const onChange = () => {
      run()
      arm()
    }
    onChange()
    const unsub = store.subscribe(onChange)
    return () => {
      unsub()
      if (timer != null) window.clearTimeout(timer)
    }
  }, [store, userId, run])

  // Bytes kept for a photo whose press is long gone leave the device (punch list #229, PR 6), once a sign-in.
  useEffect(() => {
    if (!userId) return
    void keptPhotos.sweep(Date.now() - KEPT_PHOTO_MAX_AGE_MS)
  }, [userId])

  // The signal came back, the app turned fine, the page came to the front: at once.
  useEffect(() => {
    if (!userId || typeof window === 'undefined') return
    const onOnline = () => run()
    const onVisible = () => {
      if (document.visibilityState === 'visible') run()
    }
    let wasFine = health.read(Date.now()).state === 'fine'
    const onHealth = () => {
      const fine = health.read(Date.now()).state === 'fine'
      if (fine && !wasFine) run()
      wasFine = fine
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    const unsub = health.subscribe(onHealth)
    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
      unsub()
    }
  }, [health, userId, run])

  const tryNow = useCallback(() => {
    const presses = store.presses().map((p) => (p.state === 'waiting' ? markDueNow(p) : p))
    store.replace(presses)
    run()
  }, [store, run])

  return { tryNow }
}
