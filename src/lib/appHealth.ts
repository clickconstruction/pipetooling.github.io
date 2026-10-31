/**
 * App health (punch list #183, PR 1, v2.6009) — the one store that says whether the app is
 * answering. The strip at the top of every screen (`AppHealthStrip`) and the auth gate (`useAuth`,
 * `AuthGateLoadingScreen`) read it; #163's waiting bar will join the same strip.
 *
 * Fed by a third fetch wrapper on the Supabase client (`wrapFetchReportingHealth`, beside the
 * row-cap tripwire and the in-flight write count in `supabase.ts`): every request to the database
 * (`/rest/v1/`) or to auth (`/auth/v1/`) reports its start and its end — landed with a status, a
 * freeze code in its body, or failed at the fetch layer. The kernel turns that into one of four
 * states:
 *
 *   fine         nothing has waited past the bound, or a read landed since
 *   slow         something has waited 4 s and nothing landed in those 4 s; or a response in the
 *                last 30 s carried a freeze code — 57014 the statement timeout, 57P03, 53xxx,
 *                08xxx, PGRST000–003, or HTTP 502 / 503 / 504 / 522 / 524
 *   unreachable  a fetch-layer failure (status 0, a TypeError) while the browser says online and
 *                nothing has landed for 4 s; or 20 s with something waiting and no answer of any kind
 *   offline      navigator.onLine is false — #163's state, held here so one strip owns the words
 *
 * The two-part slow rule tells a stalled app from one slow read: on a good day the Dashboard's
 * slowest read is 4.8 s but 600 others land around it, so the strip stays off; during a lock
 * pileup nothing lands and the strip shows at 4 s. A freeze-coded response is an *answer* (the
 * server spoke, so the app is not unreachable) but not a *landing* (it never clears slow). A
 * landing clears slow and unreachable. Once shown the strip holds for 3 s, so it never flickers.
 *
 * Pure: every event and every read takes `now`, and `nextChangeAt` says when the reading could
 * change with no new event, so a reader sets one timer instead of polling. The singleton
 * `appHealth` is the app's; tests make their own with `createAppHealthStore`.
 */

import { formatKeptReadTime, type KeptReadTimeFormat } from './keptRead'
import { classifyResultError } from '../utils/errorHandling'

export type AppHealthState = 'fine' | 'slow' | 'unreachable' | 'offline'

/** Something has waited this long with nothing landing: slow. */
export const SLOW_AFTER_MS = 4_000
/** Something has waited this long with no answer of any kind: unreachable. */
export const UNREACHABLE_AFTER_MS = 20_000
/** How long a freeze code or a fetch-layer failure keeps its word, with nothing landing after it. */
export const SIGNAL_TTL_MS = 30_000
/** Once shown, the strip stays at least this long. */
export const STRIP_HOLD_MS = 3_000
/** A dev's screen slow for this long adds the runbook line. */
export const DEV_RUNBOOK_AFTER_MS = 60_000
/** The auth gate's loading screen changes its words past this (the 5 s of v2.1051's repair link). */
export const AUTH_GATE_SLOW_AFTER_MS = 5_000
/** The auth gate's watchdogs, once holding, look again this often. */
export const AUTH_GATE_RECHECK_MS = 2_000
/** A role read that failed in a freeze is read again after this. */
export const ROLE_READ_RETRY_MS = 5_000

export interface AppHealthReading {
  state: AppHealthState
  /** When the state last left fine and has not settled back; null while fine. */
  troubleSince: number | null
  /** The next instant the reading could change with no new event; null when it cannot. */
  nextChangeAt: number | null
}

export interface LandedResponse {
  status: number
  /** The PostgREST / Postgres code in the body, when the wrapper read one. */
  code?: string | null
}

export interface AppHealthStore {
  /** A watched request left; returns its id. */
  requestStarted(now: number): number
  /** The request got a response — landed, or a freeze signal by its status or code. */
  requestLanded(id: number, res: LandedResponse, now: number): void
  /** The request threw at the fetch layer. An abort is nobody's fault and leaves no mark. */
  requestFailed(id: number, error: unknown, now: number): void
  setOnline(online: boolean, now: number): void
  /** The page came back to the front: what was waiting starts its wait again, so a throttled tab never shows a stale strip. */
  resumed(now: number): void
  read(now: number): AppHealthReading
  subscribe(cb: () => void): () => void
  /** Bumps on every event; a reader keyed on it re-reads. */
  version(): number
  /** How many watched requests are in flight (for a console or a test). */
  inFlightCount(): number
}

interface Inner {
  seq: number
  inFlight: Map<number, number>
  /** The latest response that was not a freeze signal. */
  lastLandedAt: number | null
  /** The latest response of any kind, freeze signals included. */
  lastAnsweredAt: number | null
  lastFreezeAt: number | null
  lastFailedAt: number | null
  online: boolean
  troubleSince: number | null
  shownState: Exclude<AppHealthState, 'fine'> | null
  shownSince: number | null
}

export const FREEZE_HTTP_STATUSES: ReadonlySet<number> = new Set([502, 503, 504, 522, 524])

/** The freeze's own codes (`docs/DB_FREEZE_RUNBOOK.md`): the statement timeout, the pool and connection families, PostgREST's own four. */
export function isFreezeCode(code: string | null | undefined): boolean {
  const c = (code ?? '').trim()
  if (!c) return false
  if (c === '57014' || c === '57P03') return true
  if (/^(53|08)/.test(c)) return true
  return /^PGRST00[0-3]$/.test(c)
}

export function isFreezeSignal(res: LandedResponse): boolean {
  return isFreezeCode(res.code) || FREEZE_HTTP_STATUSES.has(res.status)
}

function isAbort(error: unknown): boolean {
  if (error == null || typeof error !== 'object') return false
  const name = (error as { name?: unknown }).name
  return name === 'AbortError'
}

function oldestStart(inFlight: Map<number, number>): number | null {
  let oldest: number | null = null
  for (const at of inFlight.values()) if (oldest == null || at < oldest) oldest = at
  return oldest
}

/** The state the facts give at `now`, before the 3 s hold. */
function rawState(s: Inner, now: number): AppHealthState {
  if (!s.online) return 'offline'
  const oldest = oldestStart(s.inFlight)
  const waited = oldest == null ? 0 : now - oldest
  const within = (t: number | null, ms: number) => t != null && now - t < ms
  const after = (a: number | null, b: number | null) => a != null && (b == null || a > b)
  const failedUnanswered = within(s.lastFailedAt, SIGNAL_TTL_MS) && after(s.lastFailedAt, s.lastAnsweredAt) && !within(s.lastLandedAt, SLOW_AFTER_MS)
  const silent = waited >= UNREACHABLE_AFTER_MS && !within(s.lastAnsweredAt, UNREACHABLE_AFTER_MS)
  if (failedUnanswered || silent) return 'unreachable'
  const stalled = waited >= SLOW_AFTER_MS && !within(s.lastLandedAt, SLOW_AFTER_MS)
  const froze = within(s.lastFreezeAt, SIGNAL_TTL_MS) && after(s.lastFreezeAt, s.lastLandedAt)
  if (stalled || froze) return 'slow'
  return 'fine'
}

function nextChangeAt(s: Inner, now: number): number | null {
  const oldest = oldestStart(s.inFlight)
  const candidates: Array<number | null> = [
    oldest == null ? null : oldest + SLOW_AFTER_MS,
    oldest == null ? null : oldest + UNREACHABLE_AFTER_MS,
    s.lastLandedAt == null ? null : s.lastLandedAt + SLOW_AFTER_MS,
    s.lastAnsweredAt == null || oldest == null ? null : s.lastAnsweredAt + UNREACHABLE_AFTER_MS,
    s.lastFreezeAt == null ? null : s.lastFreezeAt + SIGNAL_TTL_MS,
    s.lastFailedAt == null ? null : s.lastFailedAt + SIGNAL_TTL_MS,
    s.shownSince == null ? null : s.shownSince + STRIP_HOLD_MS,
    s.troubleSince == null ? null : s.troubleSince + DEV_RUNBOOK_AFTER_MS,
  ]
  let next: number | null = null
  for (const c of candidates) {
    if (c == null || c <= now) continue
    if (next == null || c < next) next = c
  }
  return next
}

export function createAppHealthStore(init: { online?: boolean } = {}): AppHealthStore {
  const s: Inner = {
    seq: 0,
    inFlight: new Map(),
    lastLandedAt: null,
    lastAnsweredAt: null,
    lastFreezeAt: null,
    lastFailedAt: null,
    online: init.online ?? true,
    troubleSince: null,
    shownState: null,
    shownSince: null,
  }
  let version = 0
  const listeners = new Set<() => void>()
  const notify = () => {
    version += 1
    for (const cb of listeners) cb()
  }
  return {
    requestStarted(now) {
      s.seq += 1
      s.inFlight.set(s.seq, now)
      notify()
      return s.seq
    },
    requestLanded(id, res, now) {
      s.inFlight.delete(id)
      s.lastAnsweredAt = now
      if (isFreezeSignal(res)) s.lastFreezeAt = now
      else s.lastLandedAt = now
      notify()
    },
    requestFailed(id, error, now) {
      s.inFlight.delete(id)
      if (!isAbort(error) && s.online) s.lastFailedAt = now
      notify()
    },
    setOnline(online, _now) {
      if (s.online === online) return
      s.online = online
      notify()
    },
    resumed(now) {
      for (const id of [...s.inFlight.keys()]) s.inFlight.set(id, now)
      notify()
    },
    read(now) {
      const raw = rawState(s, now)
      let state: AppHealthState
      if (raw === 'fine') {
        if (s.shownSince != null && s.shownState != null && now - s.shownSince < STRIP_HOLD_MS) {
          state = s.shownState
        } else {
          s.shownSince = null
          s.shownState = null
          s.troubleSince = null
          state = 'fine'
        }
      } else {
        if (s.shownSince == null) s.shownSince = now
        if (s.troubleSince == null) s.troubleSince = now
        s.shownState = raw
        state = raw
      }
      return { state, troubleSince: s.troubleSince, nextChangeAt: nextChangeAt(s, now) }
    },
    subscribe(cb) {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    version: () => version,
    inFlightCount: () => s.inFlight.size,
  }
}

/** The app's one store. */
export const appHealth: AppHealthStore = createAppHealthStore({
  online: typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean' ? true : navigator.onLine,
})

// ---------------------------------------------------------------------------
// The words. Plain words (`plainWords.ts`): one idea a sentence, the control's exact name.
// "Nothing you pressed is lost." waits on #163's queue. "The page you see was read at 7:52 AM." is on
// since PR 2 (v2.6031): the strip reads `keptReadOnScreen` (`lib/keptRead.ts`), which a page's
// `useKeptRead` fills while the rows on screen are the read this device kept.

export const SLOW_WORDS = 'The app is slow right now.'
export const UNREACHABLE_WORDS = 'Could not reach the app.'
export const OFFLINE_WORDS = 'No signal.'
export const DEV_RUNBOOK_WORDS = 'Run /db-freeze before anyone restarts.'
export const RETRY_LABEL = 'Retry'
export const AUTH_GATE_SLOW_WORDS = 'The app is slow right now. Keep this open.'
export const KEPT_PAGE_WORDS_LEAD = 'The page you see was read at'

/** "The page you see was read at 7:52 AM." — the strip's second sentence while the page on screen is a kept one. */
export function keptPageWords(readAt: number, format?: KeptReadTimeFormat): string {
  return `${KEPT_PAGE_WORDS_LEAD} ${formatKeptReadTime(readAt, format)}.`
}

export interface AppHealthStripWords {
  tone: 'amber' | 'red' | 'grey'
  /** The first words, bold. */
  lead: string
  /** Sentences after the lead. */
  lines: string[]
  /** Offer Retry, which reloads the page. */
  retry: boolean
}

/**
 * What the strip reads for a reading, or null when it is gone. `keptReadAt` (the page on screen is a
 * kept one, read then) adds *The page you see was read at 7:52 AM.* right after the lead; `dev` adds
 * the runbook line last once the trouble is a minute old.
 */
export function appHealthStripWords(
  reading: AppHealthReading,
  opts: { dev: boolean; now: number; keptReadAt?: number | null; format?: KeptReadTimeFormat },
): AppHealthStripWords | null {
  const keptLine = opts.keptReadAt != null ? [keptPageWords(opts.keptReadAt, opts.format)] : []
  const devLine =
    opts.dev && reading.troubleSince != null && opts.now - reading.troubleSince >= DEV_RUNBOOK_AFTER_MS ? [DEV_RUNBOOK_WORDS] : []
  switch (reading.state) {
    case 'fine':
      return null
    case 'slow':
      return { tone: 'amber', lead: SLOW_WORDS, lines: [...keptLine, ...devLine], retry: false }
    case 'unreachable':
      return { tone: 'red', lead: UNREACHABLE_WORDS, lines: [...keptLine, ...devLine], retry: true }
    case 'offline':
      return { tone: 'grey', lead: OFFLINE_WORDS, lines: keptLine, retry: false }
  }
}

/** The auth gate's watchdogs wait while the app is slow or unreachable: a freeze is not a signed-out person. */
export function gateHoldsFor(state: AppHealthState): boolean {
  return state === 'slow' || state === 'unreachable'
}

export function appHealthHoldsGate(now: number = Date.now(), store: AppHealthStore = appHealth): boolean {
  return gateHoldsFor(store.read(now).state)
}

/**
 * A role row that failed to read is read again when the failure is the freeze's, when the read never reached the
 * server, or while the app is slow; a plain refusal is final. A lost signal is not a missing role (punch list #163's
 * live test, v2.6198): an auth event with no signal re-read the role, and settling that failure as null dropped the
 * clock row and the header's buttons until a reload.
 */
export function shouldRetryRoleRead(
  error: { code?: string | null; message?: string | null; status?: number | null } | null | undefined,
  now: number = Date.now(),
  store: AppHealthStore = appHealth,
): boolean {
  if (error && isFreezeCode(error.code)) return true
  if (error && classifyResultError(error) === 'network') return true
  return appHealthHoldsGate(now, store)
}

// ---------------------------------------------------------------------------
// The fetch wrapper and the window binding.

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (typeof URL !== 'undefined' && input instanceof URL) return input.href
  return (input as { url?: string }).url ?? ''
}

/** The database and auth answer from the same frozen Postgres; a function or a file upload has its own clock. */
export function isWatchedRequestUrl(url: string): boolean {
  return /\/(rest|auth)\/v1\//.test(url)
}

async function bodyCode(res: Response): Promise<string | null> {
  try {
    const text = await res.clone().text()
    const parsed: unknown = JSON.parse(text)
    const code = parsed && typeof parsed === 'object' ? (parsed as { code?: unknown }).code : null
    return typeof code === 'string' ? code : null
  } catch {
    return null
  }
}

/** Wrap a fetch so every watched request reports its start and its end to the store. */
export function wrapFetchReportingHealth(inner: FetchLike, store: AppHealthStore = appHealth, clock: () => number = Date.now): FetchLike {
  return async (input, init) => {
    if (!isWatchedRequestUrl(requestUrl(input))) return inner(input, init)
    const id = store.requestStarted(clock())
    let res: Response
    try {
      res = await inner(input, init)
    } catch (error) {
      store.requestFailed(id, error, clock())
      throw error
    }
    if (res.ok) {
      store.requestLanded(id, { status: res.status }, clock())
    } else {
      // The freeze code rides in the body of a 5xx; reading it never delays the caller's copy.
      const at = clock()
      void bodyCode(res).then((code) => store.requestLanded(id, { status: res.status, code }, at))
    }
    return res
  }
}

interface WindowLike {
  navigator: { onLine?: boolean }
  document: { visibilityState?: string; addEventListener: (type: string, cb: () => void) => void; removeEventListener: (type: string, cb: () => void) => void }
  addEventListener: (type: string, cb: () => void) => void
  removeEventListener: (type: string, cb: () => void) => void
}

/** Keep the store's `online` on the browser's word and restart the waits when the page comes back to the front. */
export function bindAppHealthToWindow(win: WindowLike, store: AppHealthStore = appHealth, clock: () => number = Date.now): () => void {
  store.setOnline(win.navigator.onLine !== false, clock())
  const up = () => store.setOnline(true, clock())
  const down = () => store.setOnline(false, clock())
  const resume = () => {
    if (win.document.visibilityState === 'visible') store.resumed(clock())
  }
  win.addEventListener('online', up)
  win.addEventListener('offline', down)
  win.addEventListener('pageshow', resume)
  win.document.addEventListener('visibilitychange', resume)
  return () => {
    win.removeEventListener('online', up)
    win.removeEventListener('offline', down)
    win.removeEventListener('pageshow', resume)
    win.document.removeEventListener('visibilitychange', resume)
  }
}
