import { deserializeJobDayLedger, serializeJobDayLedger, type JobDayLedger, type JobDayLedgerSerialized } from './jobDayLedger'

/**
 * The job day ledger's per-session cache (v2.3289) — lifted out of `useJobSummaryView`
 * so the job window's Costs tab (`useJobBurnOverhead`) shares it. The ledger scans
 * company-wide sessions for its window, so a window loaded once in the last hour is
 * served from sessionStorage, and two hosts asking for the same window while a load
 * is in flight share ONE request. Keys carry the user id because RLS scopes the scan.
 */
export const JOB_DAY_LEDGER_CACHE_TTL_MS = 60 * 60 * 1000
/** Bump when the serialized shape changes so older cached ledgers reload. */
export const JOB_DAY_LEDGER_CACHE_VERSION = 'v5'

export type JobDayLedgerCacheEntry = { cachedAtMs: number; ledger: JobDayLedgerSerialized }

export type JobDayLedgerCacheStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void }

export function jobDayLedgerCacheKey(userId: string, startYmd: string, endYmd: string): string {
  return `jobDayLedger:${JOB_DAY_LEDGER_CACHE_VERSION}:${userId}:${startYmd}:${endYmd}`
}

function defaultStorage(): JobDayLedgerCacheStorage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null
  } catch {
    return null
  }
}

/** The cached ledger for `key` when it is younger than the TTL; null otherwise (or when storage is unavailable / corrupt). */
export function readCachedJobDayLedger(
  key: string,
  opts: { storage?: JobDayLedgerCacheStorage | null; nowMs?: number; ttlMs?: number } = {},
): JobDayLedger | null {
  const storage = opts.storage === undefined ? defaultStorage() : opts.storage
  if (!storage) return null
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const entry = JSON.parse(raw) as JobDayLedgerCacheEntry
    if (!entry || typeof entry.cachedAtMs !== 'number' || !entry.ledger) return null
    if ((opts.nowMs ?? Date.now()) - entry.cachedAtMs >= (opts.ttlMs ?? JOB_DAY_LEDGER_CACHE_TTL_MS)) return null
    return deserializeJobDayLedger(entry.ledger)
  } catch {
    return null
  }
}

/** Best-effort write; a full or unavailable storage is silently skipped (the cache is a nicety). */
export function writeCachedJobDayLedger(key: string, ledger: JobDayLedger, opts: { storage?: JobDayLedgerCacheStorage | null; nowMs?: number } = {}): void {
  const storage = opts.storage === undefined ? defaultStorage() : opts.storage
  if (!storage) return
  try {
    const entry: JobDayLedgerCacheEntry = { cachedAtMs: opts.nowMs ?? Date.now(), ledger: serializeJobDayLedger(ledger) }
    storage.setItem(key, JSON.stringify(entry))
  } catch {
    /* per-session nicety only */
  }
}

const inFlight = new Map<string, Promise<JobDayLedger | null>>()

/**
 * Serve the window from the session cache, else run `load` once for every caller that
 * asks while it is in flight, then cache the result. `load` must not take a cancel
 * callback — a shared request finishes for whoever is still listening.
 */
export async function loadJobDayLedgerCached(args: {
  userId: string
  startYmd: string
  endYmd: string
  load: () => Promise<JobDayLedger | null>
  storage?: JobDayLedgerCacheStorage | null
  nowMs?: number
  /** Skip the cache read (a forced reload); the result is still written. */
  bypassRead?: boolean
}): Promise<JobDayLedger | null> {
  const key = jobDayLedgerCacheKey(args.userId, args.startYmd, args.endYmd)
  if (!args.bypassRead) {
    const hit = readCachedJobDayLedger(key, { storage: args.storage, nowMs: args.nowMs })
    if (hit) return hit
  }
  const pending = inFlight.get(key)
  if (pending) return pending
  const p = (async () => {
    try {
      const ledger = await args.load()
      if (ledger) writeCachedJobDayLedger(key, ledger, { storage: args.storage, nowMs: args.nowMs })
      return ledger
    } finally {
      inFlight.delete(key)
    }
  })()
  inFlight.set(key, p)
  return p
}
