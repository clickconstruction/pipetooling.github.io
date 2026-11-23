import { createElement, lazy, useState, type ComponentType } from 'react'

/**
 * A window loaded on demand (the main chunk's split, 2026-11-20).
 *
 * The app-wide providers in `App.tsx` used to import their windows, so the Job window, the Edit Job form
 * and everything those read sat in the entry's chunk whether or not anyone opened them. That chunk
 * crossed the precache cap in `vite.config.ts` four times, and each time every deploy failed. A provider
 * now holds its window through `lazyWindow`, so the window's code is a chunk of its own.
 *
 * Two things keep a first open from feeling slower. The service worker precaches every chunk, so an
 * installed app reads the window from the device. And `warmWhenIdle` loads it a moment after the app
 * has drawn, while nothing else wants the processor, so the open finds it ready.
 *
 * It does two things `React.lazy` alone does not. A window whose code has already loaded is drawn at
 * once, with no loading step in between, so a warmed window opens in the same frame as the press. And a
 * load that failed is asked for again on a later open, where `React.lazy` keeps the failure for good.
 *
 * Later, not at once. The render that was waiting gets the failure, so its boundary can say so. Until
 * v2.8327 the next ask began the moment a load failed: the waiting render drew again, asked again and
 * failed again, with no pause and no error for any boundary to catch, for as long as the file stayed away.
 */

type Loaded<P> = { default: ComponentType<P> }

/** A window loaded on demand, with its loader beside it so it can be warmed before anyone presses. */
export type LazyWindow<P> = ComponentType<P> & { preload: () => Promise<unknown> }

/**
 * How long a failed load stays failed for whoever mounts the window. Long enough for the render that was
 * waiting to draw again and hand the failure to its boundary; after it, the next mount asks afresh.
 */
export const FAILED_LOAD_HELD_MS = 2000

export function lazyWindow<P extends object>(load: () => Promise<Loaded<P>>): LazyWindow<P> {
  let loaded: ComponentType<P> | null = null
  let pending: Promise<Loaded<P>> | null = null
  /** True once a render has waited on `suspended`: from then on its fate is that load's. */
  let waitedOn = false
  /** When the load `suspended` waited on failed. `React.lazy` keeps that failure, so `suspended` is spent. */
  let failedAt: number | null = null
  const once = (): Promise<Loaded<P>> => {
    if (!pending) {
      pending = load()
        .then((module) => {
          // A lost chunk can resolve to nothing: `main.tsx` cancels Vite's throw when it starts the recovery
          // reload. Reading `default` then throws here, and the catch below treats it as the failure it is.
          loaded = module.default
          return module
        })
        .catch((error: unknown) => {
          pending = null
          // A load nobody rendered for (a warm-up) leaves `suspended` untouched, so the first open asks again.
          if (waitedOn) failedAt = Date.now()
          throw error
        })
    }
    return pending
  }
  const fresh = () =>
    lazy(() => {
      waitedOn = true
      return once()
    })
  let suspended = fresh()
  const current = () => {
    if (failedAt != null && Date.now() - failedAt >= FAILED_LOAD_HELD_MS) {
      suspended = fresh()
      waitedOn = false
      failedAt = null
    }
    return suspended
  }
  // One mount keeps the component it started with, so a window never remounts when its code lands.
  const Window = (props: P) => {
    const [Chosen] = useState<ComponentType<P>>(() => loaded ?? (current() as unknown as ComponentType<P>))
    return createElement(Chosen, props)
  }
  const out = Window as LazyWindow<P>
  out.preload = () => once()
  return out
}

/** What `warmWhenIdle` needs from the page: the browser's idle callback where there is one, a timer where not. */
export type IdleClock = {
  requestIdle?: ((run: () => void, options: { timeout: number }) => number) | undefined
  cancelIdle?: ((id: number) => void) | undefined
  setTimer: (run: () => void, ms: number) => number
  clearTimer: (id: number) => void
}

/** How long an idle callback may wait before the browser must run it anyway. */
export const WARM_IDLE_TIMEOUT_MS = 6000
/** The wait where the browser has no idle callback (Safari before 2024). */
export const WARM_FALLBACK_DELAY_MS = 3000

function pageClock(): IdleClock | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    requestIdleCallback?: (run: () => void, options: { timeout: number }) => number
    cancelIdleCallback?: (id: number) => void
  }
  return {
    requestIdle: w.requestIdleCallback?.bind(w),
    cancelIdle: w.cancelIdleCallback?.bind(w),
    setTimer: (run, ms) => w.setTimeout(run, ms),
    clearTimer: (id) => w.clearTimeout(id),
  }
}

/**
 * Loads each window once the page is idle, one after another, so a long script never lands on a busy
 * frame. A load that fails is left alone: the open asks again, and its own boundary says what went wrong.
 * Returns a stop for the caller's cleanup.
 */
export function warmWhenIdle(loads: ReadonlyArray<() => Promise<unknown>>, clock: IdleClock | null = pageClock()): () => void {
  if (!clock || loads.length === 0) return () => {}
  let stopped = false
  let pending: { kind: 'idle' | 'timer'; id: number } | null = null
  const schedule = (run: () => void) => {
    pending = clock.requestIdle
      ? { kind: 'idle', id: clock.requestIdle(run, { timeout: WARM_IDLE_TIMEOUT_MS }) }
      : { kind: 'timer', id: clock.setTimer(run, WARM_FALLBACK_DELAY_MS) }
  }
  const step = (index: number) => {
    pending = null
    if (stopped) return
    const load = loads[index]
    if (!load) return
    const next = () => {
      if (!stopped && index + 1 < loads.length) schedule(() => step(index + 1))
    }
    let loading: Promise<unknown>
    try {
      loading = load()
    } catch {
      next()
      return
    }
    void loading.then(next, next)
  }
  schedule(() => step(0))
  return () => {
    stopped = true
    if (!pending) return
    if (pending.kind === 'idle') clock.cancelIdle?.(pending.id)
    else clock.clearTimer(pending.id)
    pending = null
  }
}
