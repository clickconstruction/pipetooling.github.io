/**
 * GC mode, the real build, the schedule's PR 5: the refusal a plan write gets when someone saved first
 * (decision 5, G-134), read back from the error the io's `checkSupabaseError` throws. The database
 * raises it as `P0001` with one fixed phrase, and every change since as JSON in its DETAIL
 * (`gc_schedule_bump`); PostgREST hands the DETAIL on as `details`. The window that was saving (the
 * schedule's PR 8) shows the changes, reloads the chart behind it and keeps the person's words.
 */

/** The phrase every stale press is refused with, as `gc_schedule_bump` raises it. */
export const SCHEDULE_CHANGED = 'The schedule changed while you were working.'

/** One change made since the version a press read, as the database kept it. */
export interface ScheduleChange {
  version: number
  /** When it was saved: an ISO timestamp. */
  at: string
  /** Who saved it (`users.id`), and their name when the reader may see it. */
  by: string | null
  name: string | null
  /** The change's words: the line its press made. */
  words: string
}

/** A stale press's refusal: the version it read, the schedule's now, and every change since, oldest first. */
export interface ScheduleChangedRefusal {
  /** Null: the press was a first draft. */
  read: number | null
  version: number | null
  changes: ScheduleChange[]
}

function field(error: object, key: string): unknown {
  return (error as Record<string, unknown>)[key]
}

function numberOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function stringOrNull(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

/** One change from the DETAIL, or null when it is not one. */
function changeOf(v: unknown): ScheduleChange | null {
  if (!v || typeof v !== 'object') return null
  const version = numberOrNull(field(v, 'version'))
  const at = stringOrNull(field(v, 'at'))
  const words = stringOrNull(field(v, 'words'))
  if (version === null || at === null || words === null) return null
  return { version, at, by: stringOrNull(field(v, 'by')), name: stringOrNull(field(v, 'name')), words }
}

/**
 * The refusal a stale press got, or null when the error is anything else. It takes the `DatabaseError`
 * `checkSupabaseError` throws (its `serverMessage`, `code` and `details`), or PostgREST's own error
 * object (`message`, `code`, `details`). A change it cannot read is left out; the rest stay, oldest first.
 */
export function scheduleChangedRefusal(error: unknown): ScheduleChangedRefusal | null {
  if (!error || typeof error !== 'object') return null
  const serverMessage = field(error, 'serverMessage')
  const message = typeof serverMessage === 'string' ? serverMessage : stringOrNull(field(error, 'message')) ?? ''
  if (field(error, 'code') !== 'P0001' || !message.startsWith(SCHEDULE_CHANGED)) return null
  const details = field(error, 'details')
  let detail: unknown = details
  if (typeof details === 'string') {
    try {
      detail = JSON.parse(details)
    } catch {
      detail = null
    }
  }
  const raw = detail && typeof detail === 'object' ? field(detail, 'changes') : null
  const changes = (Array.isArray(raw) ? raw : []).map(changeOf).filter((c): c is ScheduleChange => c !== null).sort((a, b) => a.version - b.version)
  return {
    read: detail && typeof detail === 'object' ? numberOrNull(field(detail, 'read')) : null,
    version: detail && typeof detail === 'object' ? numberOrNull(field(detail, 'version')) : null,
    changes,
  }
}
