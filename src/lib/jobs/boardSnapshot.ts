import type { JobsBoardScope } from './boardScopes'
import type { JobWithDetails } from '../../types/jobWithDetails'

/**
 * Pipeline load speed PR 4 (v2.3610): the last board a device saw, remembered so the next cold
 * load paints at once while the live fetch runs. Pure rules here; the IndexedDB adapter is
 * `boardSnapshotStore.ts`, the wiring is `JobsListCacheContext.tsx`.
 *
 * The owner's two answers (2026-09-19): a remembered board may be 24 h old at most, and its
 * money reads muted until the live board lands.
 */

/** A remembered board older than this is not shown; the page loads blank as before. */
export const BOARD_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000

/** Never store the paid scope: hundreds of rows the board loads lazily anyway. */
export const BOARD_SNAPSHOT_SCOPES_EXCLUDED: readonly JobsBoardScope[] = ['paid']

export type BoardSnapshot = {
  /** `buildJobsListCacheKey(userId, customerFilter)` — user + customer filter. */
  key: string
  /** The scopes the rows cover; a load wanting a scope outside this set does not use the snapshot. */
  scopes: JobsBoardScope[]
  /** Epoch ms when the rows were current. */
  savedAt: number
  jobs: JobWithDetails[]
}

const SCOPE_NAMES: ReadonlySet<string> = new Set<JobsBoardScope>([
  'waiting',
  'working',
  'ready_to_bill',
  'billed_all',
  'paid',
])

/** Shape-check a stored value: anything off is `null` and the store entry is ignored. */
export function parseBoardSnapshot(raw: unknown): BoardSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.key !== 'string' || o.key.length === 0) return null
  if (typeof o.savedAt !== 'number' || !Number.isFinite(o.savedAt)) return null
  if (!Array.isArray(o.scopes) || o.scopes.some((s) => typeof s !== 'string' || !SCOPE_NAMES.has(s))) return null
  if (!Array.isArray(o.jobs)) return null
  for (const j of o.jobs) {
    if (!j || typeof j !== 'object' || typeof (j as { id?: unknown }).id !== 'string') return null
  }
  return { key: o.key, savedAt: o.savedAt, scopes: o.scopes as JobsBoardScope[], jobs: o.jobs as JobWithDetails[] }
}

/** Build what the store keeps from a successful load: the paid scope and its rows are dropped. */
export function buildBoardSnapshot(args: {
  key: string
  scopes: readonly JobsBoardScope[]
  jobs: readonly JobWithDetails[]
  now: number
}): BoardSnapshot {
  const scopes = args.scopes.filter((s) => !BOARD_SNAPSHOT_SCOPES_EXCLUDED.includes(s))
  const jobs = args.jobs.filter((j) => (j.status ?? 'working') !== 'paid')
  return { key: args.key, scopes, savedAt: args.now, jobs }
}

/**
 * Whether a stored board may be painted for this load: same key, every wanted scope covered,
 * not older than the line, not from the future (a clock that moved back is treated as stale).
 */
export function boardSnapshotIsUsable(args: {
  snapshot: BoardSnapshot | null
  key: string
  wantedScopes: readonly JobsBoardScope[]
  now: number
  maxAgeMs?: number
}): boolean {
  const { snapshot, key, wantedScopes, now } = args
  if (!snapshot) return false
  if (snapshot.key !== key) return false
  const maxAge = args.maxAgeMs ?? BOARD_SNAPSHOT_MAX_AGE_MS
  const age = now - snapshot.savedAt
  if (age < 0 || age >= maxAge) return false
  if (wantedScopes.some((s) => !BOARD_SNAPSHOT_SCOPES_EXCLUDED.includes(s) && !snapshot.scopes.includes(s))) return false
  return true
}

/** "just now" · "4 min ago" · "6 h ago" · "yesterday" — the chip beside *Updating jobs…*. */
export function describeBoardSnapshotAge(savedAt: number, now: number): string {
  const ms = Math.max(0, now - savedAt)
  const min = Math.round(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(ms / 3_600_000)
  if (h < 24) return `${h} h ago`
  return 'yesterday'
}
