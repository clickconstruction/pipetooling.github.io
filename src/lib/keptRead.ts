/**
 * The kept read (punch list #183 PR 2, v2.6031): the last read a device saw of a page, kept so a
 * slow morning shows the page as read at 7:52 AM, with a stamp and its figures muted, while the
 * live read runs. Lifted from the Pipeline's remembered board (v2.3610, `lib/jobs/boardSnapshot.ts`,
 * retired by this file): the Pipeline is the first page on it, and PRs 3 to 5 take the phone's day,
 * Quickfill and Messages through the same hook.
 *
 * Pure rules here. The IndexedDB adapter is `keptReadStore.ts`, the hook `hooks/useKeptRead.ts`,
 * the stamp `components/KeptReadStamp.tsx`, the muting the `[data-kept-read]` rules in `index.css`,
 * and the strip's sentence *The page you see was read at 7:52 AM.* reads `keptReadOnScreen` below.
 *
 * The owner's two answers for the board (2026-09-19) hold for every page: a kept read may be 24 h
 * old at most, and its money reads muted until the live read lands.
 */

/** Bump when the shape a page keeps changes: a read kept under an older number is not shown. */
export const KEPT_READ_SCHEMA = 1

/** A kept read older than this is not shown; the page loads as it would with nothing kept. */
export const KEPT_READ_MAX_AGE_MS = 24 * 60 * 60 * 1000

export type KeptRead<T = unknown> = {
  /** `buildKeptReadKey(userId, page, scope)`: whose read, of which page, under which lens. */
  key: string
  /** `KEPT_READ_SCHEMA` when written. */
  schema: number
  /** What the rows cover; a load wanting a scope outside this set does not use the read. */
  scopes: string[]
  /** Epoch ms when the rows were current. */
  readAt: number
  /** The rendered rows, the view model the page draws, never the raw tables. */
  rows: T[]
}

/**
 * The key: the acting user's id, the page's name and its scope (a customer filter, a Show lens,
 * the schedule's day). Another user, page or scope is another key, so a read is never shown to
 * the wrong person or under the wrong lens; an empty scope reads `all`.
 */
export function buildKeptReadKey(userId: string, page: string, scope?: string | null): string {
  const s = scope?.trim() ?? ''
  return `${userId}:${page}:${s || 'all'}`
}

/** Shape-check a stored value: anything off is `null` and the entry is ignored. `rowIsValid` is the page's own check on each row. */
export function parseKeptRead(raw: unknown, rowIsValid: (row: unknown) => boolean = (row) => row != null && typeof row === 'object'): KeptRead | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.key !== 'string' || o.key.length === 0) return null
  if (o.schema !== KEPT_READ_SCHEMA) return null
  if (typeof o.readAt !== 'number' || !Number.isFinite(o.readAt)) return null
  if (!Array.isArray(o.scopes) || o.scopes.some((s) => typeof s !== 'string')) return null
  if (!Array.isArray(o.rows)) return null
  for (const row of o.rows) if (!rowIsValid(row)) return null
  return { key: o.key, schema: KEPT_READ_SCHEMA, scopes: o.scopes as string[], readAt: o.readAt, rows: o.rows }
}

/** What the store keeps once every read of the page landed: the rows as rendered, stamped now. */
export function buildKeptRead<T>(args: { key: string; scopes: readonly string[]; rows: readonly T[]; now: number }): KeptRead<T> {
  return { key: args.key, schema: KEPT_READ_SCHEMA, scopes: [...args.scopes], readAt: args.now, rows: [...args.rows] }
}

/**
 * Whether a kept read may be shown for this load: same key, the schema of today, every wanted
 * scope covered, younger than the line, not from the future (a clock that moved back is stale).
 */
export function keptReadIsUsable(args: {
  kept: KeptRead | null
  key: string
  wantedScopes: readonly string[]
  now: number
  maxAgeMs?: number
}): boolean {
  const { kept, key, wantedScopes, now } = args
  if (!kept) return false
  if (kept.key !== key) return false
  if (kept.schema !== KEPT_READ_SCHEMA) return false
  const maxAge = args.maxAgeMs ?? KEPT_READ_MAX_AGE_MS
  const age = now - kept.readAt
  if (age < 0 || age >= maxAge) return false
  if (wantedScopes.some((s) => !kept.scopes.includes(s))) return false
  return true
}

/** "just now" · "4 min ago" · "6 h ago" · "yesterday": the age chip beside *Updating jobs…*. */
export function describeKeptReadAge(readAt: number, now: number): string {
  const ms = Math.max(0, now - readAt)
  const min = Math.round(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(ms / 3_600_000)
  if (h < 24) return `${h} h ago`
  return 'yesterday'
}

export interface KeptReadTimeFormat {
  locale?: string
  /** The device's own zone when unset: a kept read is this device's moment. */
  timeZone?: string
}

/** "7:52 AM": the clock time a stamp and the strip name. */
export function formatKeptReadTime(readAt: number, fmt: KeptReadTimeFormat = {}): string {
  return new Date(readAt).toLocaleTimeString(fmt.locale ?? 'en-US', { hour: 'numeric', minute: '2-digit', timeZone: fmt.timeZone })
}

// ---------------------------------------------------------------------------
// The stamp's words. One line at the top of a kept page, in the age chip's amber, in the page's
// own words: the Dashboard's "Read at", Quickfill's "Counts from", Messages' "Who was waiting at",
// the phone's "Your day as read at".

export const KEPT_READ_DEFAULT_LEAD = 'Read at'
/** The phone's day (My Schedule and Job Mode, #183 PR 3): *Your day as read at 7:52 AM · reading again…*. */
export const PHONE_DAY_KEPT_LEAD = 'Your day as read at'
export const READING_AGAIN_WORDS = 'reading again…'
export const COULD_NOT_READ_AGAIN_WORDS = 'could not read again'
export const KEPT_READ_RETRY_LABEL = 'Retry'

export interface KeptReadStampWords {
  /** "Read at 7:52 AM", bold. */
  stamp: string
  /** "reading again…" while the live read runs; "could not read again" once it failed. */
  state: string
  /** Offer Retry: the live read failed. */
  retry: boolean
  /** The whole line as read aloud. */
  text: string
}

export function keptReadStampWords(args: { readAt: number; lead?: string; failed: boolean; format?: KeptReadTimeFormat }): KeptReadStampWords {
  const stamp = `${args.lead ?? KEPT_READ_DEFAULT_LEAD} ${formatKeptReadTime(args.readAt, args.format)}`
  const state = args.failed ? COULD_NOT_READ_AGAIN_WORDS : READING_AGAIN_WORDS
  const text = args.failed ? `${stamp} · ${state} · ${KEPT_READ_RETRY_LABEL}` : `${stamp} · ${state}`
  return { stamp, state, retry: args.failed, text }
}

// ---------------------------------------------------------------------------
// Which page on screen is a kept one. The hook registers while it hands back kept rows, and the
// strip (`AppHealthStrip`) reads the oldest stamp to say *The page you see was read at 7:52 AM.*
// Pure, no browser globals; the singleton is the app's, tests make their own.

export interface KeptReadOnScreenStore {
  /** A kept page (or a kept part of one) is on screen, read at `readAt`. */
  show(id: string, readAt: number): void
  hide(id: string): void
  /** The earliest `readAt` among the kept parts on screen; null when the page is live. */
  read(): number | null
  subscribe(cb: () => void): () => void
}

export function createKeptReadOnScreenStore(): KeptReadOnScreenStore {
  const shown = new Map<string, number>()
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const cb of listeners) cb()
  }
  return {
    show(id, readAt) {
      if (shown.get(id) === readAt) return
      shown.set(id, readAt)
      notify()
    },
    hide(id) {
      if (!shown.delete(id)) return
      notify()
    },
    read() {
      let earliest: number | null = null
      for (const at of shown.values()) if (earliest == null || at < earliest) earliest = at
      return earliest
    },
    subscribe(cb) {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
  }
}

/** The app's one registry. */
export const keptReadOnScreen: KeptReadOnScreenStore = createKeptReadOnScreenStore()
