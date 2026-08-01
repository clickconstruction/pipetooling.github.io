import { supabase } from './supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

const CHUNK_SIZE = 150
const MAX_ROWS_PER_CHUNK = 8000

/** Minimum Stages search length before querying schedule blocks and clock sessions. */
export const STAGES_SCHEDULE_SESSION_SEARCH_MIN_CHARS = 2

/** localStorage key for the Stages tools-menu "Schedule & time in search" toggle. */
export const STAGES_INCLUDE_SCHEDULE_TIME_STORAGE_KEY = 'jobs-stages-search-include-schedule-time'

/**
 * Off unless the user explicitly opted in (v2.1184) — the schedule/clock lookup is the expensive
 * part of Stages search, so a missing/unreadable stored value means plain job-field search only.
 */
export function parseStagesIncludeScheduleTimePref(raw: string | null): boolean {
  return raw === 'true'
}

/**
 * Whether supplementary schedule/clock search should run (caller ensures Stages tab). Trims `query` for length checks.
 */
export function shouldFetchStagesScheduleSessionSearch(
  includeScheduleTimeInSearch: boolean,
  query: string,
): boolean {
  const q = query.trim()
  return (
    includeScheduleTimeInSearch &&
    q.length >= STAGES_SCHEDULE_SESSION_SEARCH_MIN_CHARS
  )
}

type BlockRow = {
  job_id: string
  note: string | null
  work_date: string
  users: { name: string | null } | null
}

type SessionRow = {
  job_ledger_id: string | null
  notes: string | null
  work_date: string | null
  users: { name: string | null } | null
}

function blockRowMatches(qLower: string, row: BlockRow): boolean {
  const note = (row.note ?? '').toLowerCase()
  const wd = (row.work_date ?? '').toLowerCase()
  const name = (row.users?.name ?? '').toLowerCase()
  return note.includes(qLower) || wd.includes(qLower) || name.includes(qLower)
}

function sessionRowMatches(qLower: string, row: SessionRow): boolean {
  if (!row.job_ledger_id) return false
  const notes = (row.notes ?? '').toLowerCase()
  const wd = (row.work_date ?? '').toLowerCase()
  const name = (row.users?.name ?? '').toLowerCase()
  return notes.includes(qLower) || wd.includes(qLower) || name.includes(qLower)
}

/**
 * Result of the server-side matcher RPC as a job-id set, or null when the payload
 * isn't the uuid[] shape (caller falls back to the legacy client-side path).
 */
export function scheduleClockSearchRpcJobIdSet(data: unknown): Set<string> | null {
  if (!Array.isArray(data)) return null
  return new Set(data.filter((v): v is string => typeof v === 'string'))
}

/**
 * Job IDs in `jobIds` that have a schedule block or non-revoked clock session matching `queryRaw`
 * (substring match on note/notes, assignee/puncher name, work_date).
 *
 * Prefers the server-side matcher RPC (v2.1185 — one round trip, matching in SQL under the
 * caller's RLS); falls back to the legacy chunked client-side path when the RPC isn't deployed
 * yet or errors, so client and migration are order-safe.
 */
export async function fetchJobIdsMatchingScheduleOrClockSessions(
  jobIds: string[],
  queryRaw: string,
): Promise<{ data: Set<string>; error: string | null }> {
  const trimmed = queryRaw.trim()
  if (jobIds.length === 0 || trimmed.length < STAGES_SCHEDULE_SESSION_SEARCH_MIN_CHARS) {
    return { data: new Set(), error: null }
  }

  try {
    const { data, error } = await supabase.rpc('search_job_ids_matching_schedule_or_clock', {
      p_job_ids: jobIds,
      p_query: trimmed,
    })
    if (!error) {
      const ids = scheduleClockSearchRpcJobIdSet(data)
      if (ids) return { data: ids, error: null }
    }
  } catch {
    // fall through to the legacy client-side path
  }
  return fetchJobIdsMatchingScheduleOrClockSessionsClientSide(jobIds, trimmed)
}

/** Legacy client-side matcher: chunked .in() fetches + substring matching in the browser. */
async function fetchJobIdsMatchingScheduleOrClockSessionsClientSide(
  jobIds: string[],
  trimmed: string,
): Promise<{ data: Set<string>; error: string | null }> {
  const qLower = trimmed.toLowerCase()

  const out = new Set<string>()
  let firstError: string | null = null

  for (let i = 0; i < jobIds.length; i += CHUNK_SIZE) {
    const chunk = jobIds.slice(i, i + CHUNK_SIZE)

    const blockPromise = withSupabaseRetry(
      async () =>
        await supabase
          .from('job_schedule_blocks')
          .select('job_id, note, work_date, users!job_schedule_blocks_assignee_user_id_fkey(name)')
          .in('job_id', chunk)
          .limit(MAX_ROWS_PER_CHUNK),
      'stages search job_schedule_blocks',
    ).then((rows) => ({ ok: true as const, rows: rows as BlockRow[] })).catch((e: unknown) => ({
      ok: false as const,
      err: formatErrorMessage(e),
    }))

    const sessionPromise = withSupabaseRetry(
      async () =>
        await supabase
          .from('clock_sessions')
          .select('job_ledger_id, notes, work_date, users!clock_sessions_user_id_fkey(name)')
          .in('job_ledger_id', chunk)
          .not('job_ledger_id', 'is', null)
          .is('revoked_at', null)
          .limit(MAX_ROWS_PER_CHUNK),
      'stages search clock_sessions',
    ).then((rows) => ({ ok: true as const, rows: rows as SessionRow[] })).catch((e: unknown) => ({
      ok: false as const,
      err: formatErrorMessage(e),
    }))

    const [bRes, sRes] = await Promise.all([blockPromise, sessionPromise])

    if (bRes.ok) {
      const rows = bRes.rows ?? []
      for (const row of rows) {
        if (blockRowMatches(qLower, row)) out.add(row.job_id)
      }
    } else {
      firstError = firstError ?? bRes.err
    }

    if (sRes.ok) {
      const rows = sRes.rows ?? []
      for (const row of rows) {
        if (sessionRowMatches(qLower, row) && row.job_ledger_id) out.add(row.job_ledger_id)
      }
    } else {
      firstError = firstError ?? sRes.err
    }
  }

  return { data: out, error: firstError }
}
