/**
 * The words of the two confirm windows on a clock session (punch list #443). **Reject** asked *Reject this clock
 * session?* and **Delete** asked *Delete this clock session permanently?*: neither said whose session or which day,
 * so a person matched the armed row by its place on the page before saying yes. A confirm names the act and the row
 * it acts on. Pure: the day is the session's own work day, and the times read in the company's zone.
 */
import { formatDenverTimeOnly, formatWorkDateYmdWeekdayShortFriendly } from '../../utils/dateUtils'

/** What the words need of a session's row. */
export type ClockSessionToName = {
  users?: { name: string | null } | null
  work_date: string
  clocked_in_at: string
  clocked_out_at: string | null
  /** Non-null on a quick add: minutes a person typed in, not a punch. */
  quick_add_minutes?: number | null
}

/** How long Settings → Data & recovery → Recently deleted keeps a deleted row (`deleted_records_archive`'s purge). */
export const DELETED_SESSION_KEPT_DAYS = 90

const timeOf = (iso: string | null): string | null => {
  const ms = iso ? Date.parse(iso) : NaN
  return Number.isFinite(ms) ? formatDenverTimeOnly(ms) : null
}

/** The session's hours: *8:23 PM to 8:24 PM*, *8:23 PM, still open*, or the minutes of a quick add. */
export function clockSessionHoursWords(s: ClockSessionToName): string {
  if (typeof s.quick_add_minutes === 'number') return s.quick_add_minutes === 1 ? '1 minute typed in' : `${s.quick_add_minutes} minutes typed in`
  const from = timeOf(s.clocked_in_at)
  const to = timeOf(s.clocked_out_at)
  if (!from) return 'no start time'
  return to ? `${from} to ${to}` : `${from}, still open`
}

/** The row in words: *Dana Whitfield's clock session of Wed, Nov 25, 8:23 PM to 8:24 PM*. */
export function clockSessionNamed(s: ClockSessionToName): string {
  const name = s.users?.name?.trim()
  const whose = name ? `${name}'s clock session` : 'the clock session with no name on it'
  return `${whose} of ${formatWorkDateYmdWeekdayShortFriendly(s.work_date)}, ${clockSessionHoursWords(s)}`
}

/** The Reject press's confirm window. A rejected session can be returned to pending, so the words promise nothing more. */
export function rejectSessionConfirm(s: ClockSessionToName): { message: string; confirmLabel: string } {
  const named = clockSessionNamed(s)
  return { message: `Reject ${named}?`, confirmLabel: 'Reject the session' }
}

/**
 * The Delete press's confirm window, on a rejected session. The delete is not the end of the row: the archive keeps a
 * copy for ninety days and a dev can bring it back from Recently deleted, so the words say that and not *permanently*.
 */
export function deleteSessionConfirm(s: ClockSessionToName): { message: string; confirmLabel: string; danger: true } {
  const named = clockSessionNamed(s)
  return {
    message: `Delete ${named}? A dev can bring it back from Recently deleted for ${DELETED_SESSION_KEPT_DAYS} days.`,
    confirmLabel: 'Delete the session',
    danger: true,
  }
}
