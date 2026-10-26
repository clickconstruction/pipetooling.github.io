// Punch list #61 (v2.5116, shared since v2.5120): every ZZ test job the caller can see, any status and any
// customer, read once and shared. A screen whose rows carry no names (an RPC's job ids, a lean read)
// drops ZZ jobs by these ids, and the Pipeline strip uses them for the paid ZZ jobs its active read never
// ships. The read itself lives in `zzTestJobReads.ts` with the client passed in (v2.5880), so the Bridge's
// weekly sheet can make it as the service role on the edge; this file binds the app's client and keeps the
// per-user cache. The sweep keeps its own strict filter (`ZZ_TEST_JOBS_OR_FILTER`), so its counts do not move.

import { supabase } from '../supabase'
import { readZzTestJobRows, type ZzTestJobRow } from './zzTestJobReads'

export { ZZ_TEST_JOBS_LOOSE_OR_FILTER, ZZ_TEST_JOB_ROWS_SELECT, type ZzTestJobRow } from './zzTestJobReads'

/** The read itself, every time (the Pipeline strip's stats carry their own 60-second freshness), as the app's client. */
export function fetchZzTestJobRows(): Promise<ZzTestJobRow[]> {
  return readZzTestJobRows(supabase)
}

/** How long the shared answer stands. A ZZ job made in that window can show on the Dashboard until it lapses. */
export const ZZ_TEST_JOB_ROWS_TTL_MS = 60_000

/**
 * One answer per signed-in user. RLS scopes the read, so the answer read as a sample assistant (View as)
 * is not the dev's after Exit, and nobody's after sign-out (review on #5241).
 */
let cached: { at: number; userId: string; rows: Promise<ZzTestJobRow[]> } | null = null

/** The shared answer for the Dashboard's readers: one read per minute per user, however many cards ask. */
export function loadZzTestJobRows(userId: string | null | undefined, now = Date.now()): Promise<ZzTestJobRow[]> {
  const key = userId ?? ''
  if (cached && cached.userId === key && now - cached.at < ZZ_TEST_JOB_ROWS_TTL_MS) return cached.rows
  const rows = fetchZzTestJobRows()
  const entry = { at: now, userId: key, rows }
  cached = entry
  rows.catch(() => {
    if (cached === entry) cached = null
  })
  return rows
}

/** Forget the shared answer, so the next reader reads again. The sweep calls it after it moves jobs. */
export function invalidateZzTestJobRows(): void {
  cached = null
}

/** The ids, for a screen that drops rows by id. */
export async function loadZzTestJobIds(userId: string | null | undefined, now = Date.now()): Promise<Set<string>> {
  return new Set((await loadZzTestJobRows(userId, now)).map((r) => r.id))
}
