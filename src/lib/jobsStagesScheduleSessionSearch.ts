import { supabase } from './supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

const CHUNK_SIZE = 150
const MAX_ROWS_PER_CHUNK = 8000

/** Minimum Stages search length before querying schedule blocks and clock sessions. */
export const STAGES_SCHEDULE_SESSION_SEARCH_MIN_CHARS = 2

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
 * Job IDs in `jobIds` that have a schedule block or non-revoked clock session matching `queryRaw`
 * (substring match on note/notes, assignee/puncher name, work_date).
 */
export async function fetchJobIdsMatchingScheduleOrClockSessions(
  jobIds: string[],
  queryRaw: string,
): Promise<{ data: Set<string>; error: string | null }> {
  const trimmed = queryRaw.trim()
  const qLower = trimmed.toLowerCase()
  if (jobIds.length === 0 || trimmed.length < STAGES_SCHEDULE_SESSION_SEARCH_MIN_CHARS) {
    return { data: new Set(), error: null }
  }

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
