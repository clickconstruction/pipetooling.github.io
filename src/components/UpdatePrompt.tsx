import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { shouldResurfaceUpdatePill } from '../lib/updatePillResurface'
import {
  IDLE_HIDDEN_MIN_MS,
  decideAutoReload,
  decideReloadLanding,
  isDialogOpen,
  isEditableFocused,
  msSinceLastAutoReload,
  recordAutoReload,
  routeMoveKey,
  type AutoReloadMoment,
} from '../lib/autoReload'
import { inFlightWriteCount, subscribeUnsavedWork, unsavedHoldCount } from '../lib/unsavedWork'
import { registerSW } from 'virtual:pwa-register'

/** Long-lived tabs poll for a new deploy this often. */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000
/** Extra check when a hidden tab becomes visible again (phones left open), throttled. */
const VISIBILITY_CHECK_MIN_GAP_MS = 15 * 60 * 1000

const INTERACTION_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const
/** v2.3741: while an update waits, a visible tab is checked for the idle moment this often. */
const IDLE_CHECK_INTERVAL_MS = 60 * 1000

function sessionStorageOrNull(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null
  } catch {
    return null
  }
}

/**
 * A reload that has been started and has not landed: the pill's press or a quiet moment's
 * decision. `land` reads it for the second look (`decideReloadLanding`).
 */
type PendingReload = {
  asked: boolean
  decidedAt: number
  touched: boolean
  lastWriteCount: number
  writeSettledAt: number | null
}

/**
 * One `controllerchange` listener for the page's life, added before `registerSW` adds
 * workbox-window's. The plugin's prompt mode reloads on every worker change once an update has
 * been announced (`controlling` with `isUpdate`, true for any page that loaded under a worker),
 * with no look at what the page is doing, in this tab and in every other open tab. While this
 * component knows of an update it takes the event and stops it there, so the second look owns
 * every reload. A page with no update known (a first install claiming it) is left to workbox.
 */
let workerChangeTaker: (() => boolean) | null = null
let workerChangeOwned = false
function ownWorkerChanges(): void {
  if (workerChangeOwned) return
  try {
    navigator.serviceWorker.addEventListener('controllerchange', (event) => {
      if (workerChangeTaker?.()) event.stopImmediatePropagation()
    })
    workerChangeOwned = true
  } catch {
    // serviceWorker API unavailable: nothing changes workers, the fallback timer still reloads
  }
}

/**
 * Owns the service-worker registration (prompt mode). When a new build's SW reaches
 * the waiting state, the app reloads itself at a quiet moment (v2.3740: first paint
 * before any interaction; a route change — a new page or a new `?tab=` (v2.4214) — with no
 * modal open and no field focused; idle —
 * hidden five minutes or untouched half an hour (v2.3741) — with nothing unsaved and no write
 * in flight; the decision lives in src/lib/autoReload.ts) and otherwise shows the persistent "new
 * version" pill; Reload posts SKIP_WAITING (listener in src/sw.ts) and this component reloads
 * the page once the new SW takes control. An automatic reload looks a second time at that
 * moment (`decideReloadLanding`): a write in flight is waited out, and a touch, a dialog, a
 * focused field or an unsaved hold hands it back to the pill. Also polls registration.update()
 * so tabs left open discover deploys.
 */
export function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [updating, setUpdating] = useState(false)
  /** v2.3740: an automatic reload is in flight — the pill reads "Updating…" with no buttons. */
  const [autoUpdating, setAutoUpdating] = useState(false)
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null)
  /** v2.1007: a dismissed pill re-surfaces on route navigation (throttled) while an update waits. */
  const updateWaitingRef = useRef(false)
  const dismissedAtRef = useRef<number | null>(null)
  const loadedAtRef = useRef(Date.now())
  const interactedRef = useRef(false)
  const lastInteractionAtRef = useRef(Date.now())
  const hiddenAtRef = useRef<number | null>(null)
  const reloadingRef = useRef(false)
  const pendingRef = useRef<PendingReload | null>(null)
  const landTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  /** The new worker controls this page: a reload from here on needs no wait. */
  const workerTookOverRef = useRef(false)
  const { pathname, search } = useLocation()
  /** v2.4214: a move is a new page or a new `?tab=` — a tab switch is a quiet moment too. */
  const moveKey = routeMoveKey(pathname, search)

  /**
   * The second look, asked whenever the pending reload could fire or something it reads
   * changed: the worker took over, the fallback ran out, a write began or came back, a touch.
   */
  const land = useCallback(() => {
    const pending = pendingRef.current
    if (!pending) return
    if (landTimerRef.current !== undefined) clearTimeout(landTimerRef.current)
    landTimerRef.current = undefined
    const now = Date.now()
    const landing = decideReloadLanding({
      asked: pending.asked,
      workerTookOver: workerTookOverRef.current,
      msSinceDecision: now - pending.decidedAt,
      touchedSinceDecision: pending.touched,
      editableFocused: isEditableFocused(document),
      dialogOpen: isDialogOpen(document),
      unsavedHolds: unsavedHoldCount(),
      inFlightWrites: inFlightWriteCount(),
      msSinceWriteSettled: pending.writeSettledAt == null ? null : now - pending.writeSettledAt,
    })
    if (landing.act === 'reload') {
      pendingRef.current = null
      // The loop guard's stamp lands with the reload, so a stood-down decision leaves none.
      if (!pending.asked) recordAutoReload(now, sessionStorageOrNull())
      window.location.reload()
      return
    }
    if (landing.act === 'stand-down') {
      pendingRef.current = null
      reloadingRef.current = false
      setAutoUpdating(false)
      setNeedRefresh(true)
      return
    }
    landTimerRef.current = setTimeout(land, landing.lookAgainInMs)
  }, [])

  /** Start a reload: post SKIP_WAITING and let `land` fire it. `asked` is the pill's own press. */
  const applyUpdate = useCallback(
    (asked: boolean) => {
      if (reloadingRef.current) return
      reloadingRef.current = true
      pendingRef.current = {
        asked,
        decidedAt: Date.now(),
        touched: false,
        lastWriteCount: inFlightWriteCount(),
        writeSettledAt: null,
      }
      void updateSWRef.current?.()
      land()
    },
    [land],
  )

  // What the second look reads can change under it: a write begins or comes back, a hold is
  // taken or released. Each change asks again.
  useEffect(() => {
    const unsubscribe = subscribeUnsavedWork(() => {
      const pending = pendingRef.current
      if (!pending) return
      const writes = inFlightWriteCount()
      if (writes === 0 && pending.lastWriteCount > 0) pending.writeSettledAt = Date.now()
      pending.lastWriteCount = writes
      land()
    })
    return () => {
      unsubscribe()
      if (landTimerRef.current !== undefined) clearTimeout(landTimerRef.current)
    }
  }, [land])

  /** Reload now if this moment is quiet; true when a reload was started. */
  const tryAutoReload = useCallback(
    (moment: AutoReloadMoment, idle?: { hiddenForMs?: number; idleForMs?: number }): boolean => {
      if (reloadingRef.current) return true
      const now = Date.now()
      const storage = sessionStorageOrNull()
      const decision = decideAutoReload({
        moment,
        updateWaiting: updateWaitingRef.current,
        framed: typeof window !== 'undefined' && window.self !== window.top,
        interacted: interactedRef.current,
        msSinceLoad: now - loadedAtRef.current,
        editableFocused: isEditableFocused(document),
        dialogOpen: isDialogOpen(document),
        unsavedHolds: unsavedHoldCount(),
        inFlightWrites: inFlightWriteCount(),
        msSinceLastAutoReload: msSinceLastAutoReload(now, storage),
        msSinceDismissed: dismissedAtRef.current == null ? null : now - dismissedAtRef.current,
        hiddenForMs: idle?.hiddenForMs,
        idleForMs: idle?.idleForMs,
      })
      if (!decision.reload) return false
      setAutoUpdating(true)
      setNeedRefresh(true)
      applyUpdate(false)
      return true
    },
    [applyUpdate],
  )

  // Any touch on the page ends the first-paint window, and stands down an automatic reload
  // that was decided and has not landed (capture phase: before the press's own handler runs).
  useEffect(() => {
    const mark = () => {
      interactedRef.current = true
      lastInteractionAtRef.current = Date.now()
      const pending = pendingRef.current
      if (pending && !pending.asked && !pending.touched) {
        pending.touched = true
        land()
      }
    }
    for (const ev of INTERACTION_EVENTS) window.addEventListener(ev, mark, { capture: true, passive: true })
    return () => {
      for (const ev of INTERACTION_EVENTS) window.removeEventListener(ev, mark, { capture: true })
    }
  }, [land])

  // v2.3741, the idle moment: a tab hidden five minutes reloads while hidden (timers are
  // throttled there, so the check is generous) or the instant it comes back; a visible tab
  // untouched half an hour reloads on the minute check. Both only while an update waits.
  useEffect(() => {
    let hiddenTimer: ReturnType<typeof setTimeout> | undefined
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
        if (hiddenTimer !== undefined) clearTimeout(hiddenTimer)
        hiddenTimer = setTimeout(() => {
          const at = hiddenAtRef.current
          if (at != null && updateWaitingRef.current) tryAutoReload('idle', { hiddenForMs: Date.now() - at })
        }, IDLE_HIDDEN_MIN_MS + 1000)
        return
      }
      if (hiddenTimer !== undefined) clearTimeout(hiddenTimer)
      hiddenTimer = undefined
      const at = hiddenAtRef.current
      hiddenAtRef.current = null
      if (at != null && updateWaitingRef.current) tryAutoReload('idle', { hiddenForMs: Date.now() - at })
    }
    document.addEventListener('visibilitychange', onVisibility)
    const minute = setInterval(() => {
      if (!updateWaitingRef.current || document.visibilityState !== 'visible') return
      tryAutoReload('idle', { idleForMs: Date.now() - lastInteractionAtRef.current })
    }, IDLE_CHECK_INTERVAL_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      if (hiddenTimer !== undefined) clearTimeout(hiddenTimer)
      clearInterval(minute)
    }
  }, [tryAutoReload])

  // Route change (a page or a tab): a quiet moment between tasks — reload if nothing is
  // open, else the dismissed pill re-surfaces (throttled).
  const firstRouteRef = useRef(true)
  useEffect(() => {
    if (firstRouteRef.current) {
      firstRouteRef.current = false
      return
    }
    if (!updateWaitingRef.current) return
    if (tryAutoReload('route-change')) return
    if (
      shouldResurfaceUpdatePill({
        updateWaiting: updateWaitingRef.current,
        dismissedAtMs: dismissedAtRef.current,
        nowMs: Date.now(),
      })
    ) {
      dismissedAtRef.current = null
      setNeedRefresh(true)
    }
  }, [moveKey, tryAutoReload])

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined
    let onVisible: (() => void) | undefined
    let lastCheck = Date.now()

    // A worker change while an update is known here is this component's to act on. With a
    // reload pending it is the moment to look again. With none (another tab took the update,
    // or this one stood down) nothing reloads: the pill and the next quiet moment have it.
    ownWorkerChanges()
    const takeWorkerChange = () => {
      if (!updateWaitingRef.current && !pendingRef.current) return false
      workerTookOverRef.current = true
      land()
      return true
    }
    workerChangeTaker = takeWorkerChange

    updateSWRef.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        updateWaitingRef.current = true
        // A newer worker is waiting: the one that took over before is not the build to land on.
        workerTookOverRef.current = false
        if (tryAutoReload('first-paint')) return
        setNeedRefresh(true)
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return
        const check = () => {
          lastCheck = Date.now()
          registration.update().catch(() => {
            // Offline or transient network failure — next tick retries
          })
        }
        intervalId = setInterval(check, UPDATE_CHECK_INTERVAL_MS)
        onVisible = () => {
          if (document.visibilityState === 'visible' && Date.now() - lastCheck > VISIBILITY_CHECK_MIN_GAP_MS) {
            check()
          }
        }
        document.addEventListener('visibilitychange', onVisible)
      },
    })

    return () => {
      if (workerChangeTaker === takeWorkerChange) workerChangeTaker = null
      if (intervalId !== undefined) clearInterval(intervalId)
      if (onVisible) document.removeEventListener('visibilitychange', onVisible)
    }
    // registerSW runs once per mount; tryAutoReload and land are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // v2.2772: a framed page (Settings → What customers see renders the public pages in iframes)
  // never shows the pill — the top window owns the reload.
  if (!needRefresh || (typeof window !== 'undefined' && window.self !== window.top)) return null

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        maxWidth: '92vw',
        padding: '0.5rem 0.625rem 0.5rem 1rem',
        borderRadius: '9999px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
      }}
    >
      <span style={{ fontSize: '0.875rem', color: 'var(--text-base)', whiteSpace: 'nowrap' }}>
        {autoUpdating ? 'Updating to the newest version…' : 'A new version is ready.'}
      </span>
      {autoUpdating ? null : (
        <>
          <button
            type="button"
            disabled={updating}
            onClick={() => {
              setUpdating(true)
              applyUpdate(true)
            }}
            style={{
              padding: '0.375rem 1rem',
              borderRadius: '9999px',
              border: 'none',
              background: '#f97316',
              color: '#ffffff',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: updating ? 'default' : 'pointer',
              opacity: updating ? 0.7 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {updating ? 'Updating…' : 'Reload'}
          </button>
          <button
            type="button"
            onClick={() => {
              dismissedAtRef.current = Date.now()
              setNeedRefresh(false)
            }}
            aria-label="Dismiss update notice until the next deploy"
            style={{
              padding: '0.375rem 0.5rem',
              border: 'none',
              background: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Not now
          </button>
        </>
      )}
    </div>
  )
}
