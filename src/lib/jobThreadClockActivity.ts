import type { JobDetailClockSessionRow } from './fetchClockSessionsForJobLedger'

/** Clock in/out session merged into Job activity / notes (read-only). */
export type JobClockSessionActivityRow = {
  /** Stable React key fragment: `cs:${sessionId}`. */
  dedupeKey: string
  /** ISO timestamp for timeline sort (`clocked_in_at`, fallback `work_date` midday). */
  sortAt: string
  personName: string
  /** ISO timestamp; null only on malformed rows. */
  clockedInAt: string | null
  /** ISO timestamp; null = still on the clock (no clock-out yet). */
  clockedOutAt: string | null
  /** Whole-session decimal hours (`out − in`); null when open or non-positive. */
  durationHours: number | null
  /** `approved_at` set → 'approved'; otherwise still awaiting approval. */
  status: 'approved' | 'pending'
  /** Trimmed session note (empty string when none). */
  note: string
}

export type JobThreadClockActivityItem = {
  kind: 'clock_session'
  clock: JobClockSessionActivityRow
}

function personLabel(row: JobDetailClockSessionRow): string {
  return row.users?.name?.trim() || row.user_id?.trim() || 'Unknown'
}

function sortAtFromSession(row: JobDetailClockSessionRow): string {
  const inAt = row.clocked_in_at?.trim()
  if (inAt) return inAt
  const wd = row.work_date?.trim()
  if (wd) return new Date(`${wd}T12:00:00`).toISOString()
  return new Date(0).toISOString()
}

function durationHours(inAt: string | null, outAt: string | null): number | null {
  if (!inAt || !outAt) return null
  const ms = new Date(outAt).getTime() - new Date(inAt).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return null
  return ms / 3_600_000
}

/**
 * Read-only clock-session activity rows for the Job activity / notes feed.
 *
 * The fetcher (`fetchClockSessionsForJobLedger`) already excludes revoked sessions;
 * here we also drop rejected ones (voided time). Open sessions (no clock-out) and
 * pending (unapproved) sessions are kept — surfacing clocked-but-unapproved time that
 * has not yet rolled into man-hours.
 */
export function clockSessionsToActivityItems(
  rows: JobDetailClockSessionRow[],
): JobThreadClockActivityItem[] {
  return rows
    .filter((r) => r.rejected_at == null)
    .map((r) => ({
      kind: 'clock_session' as const,
      clock: {
        dedupeKey: `cs:${r.id}`,
        sortAt: sortAtFromSession(r),
        personName: personLabel(r),
        clockedInAt: r.clocked_in_at,
        clockedOutAt: r.clocked_out_at,
        durationHours: durationHours(r.clocked_in_at, r.clocked_out_at),
        status: r.approved_at != null ? 'approved' : 'pending',
        note: (r.notes ?? '').trim(),
      },
    }))
}
