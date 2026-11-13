/**
 * The owner is told (v2.7068). When a developer saves a conversation out of someone's mailbox onto a job through the
 * dev seat, that person gets a notice of their own in `notification_history` (`gmail-mine`'s `noteSavedForYou`,
 * `MAIL_SAVED_TEMPLATE`, channel `app`). The owner chose the app alone: nothing is pushed and nothing is emailed, so
 * nothing lands in their inbox. This is the line the Needs you card draws from those notices, for every role, the
 * field roles included, who have no My email tab. Pure; the read is `savedForYouIo.ts`.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { dayLabel } from '../messages/owed'
import { clockTime } from '../messages/thread'
import { MAIL_SAVED_CHANNEL, MAIL_SAVED_TEMPLATE } from './savedForYouNames'

export { MAIL_SAVED_CHANNEL, MAIL_SAVED_TEMPLATE }

/** How long a notice stays on the Needs you card. Its record under Settings → Activity logs stays for good. */
export const MAIL_SAVED_SHOWN_DAYS = 7

export const MAIL_SAVED_WORDS = {
  kicker: 'Your mail',
  action: 'See the record',
  /** The badge on the record's row under Settings → Activity logs. */
  badge: 'In the app',
} as const

/** Where the line's press goes: the person's own record, which every role can open. */
export const MAIL_SAVED_DOOR = '/settings?tab=settings-recent-push#settings-recent-push'

/** A notice as the person's own read hands it over. */
export interface MailSavedRow {
  id: string
  title: string
  sentAt: string
}

/** The line as the Needs you card draws it. */
export interface MailSavedNeed {
  count: number
  title: string
  detail: string
}

/** When the notices the card shows begin: `MAIL_SAVED_SHOWN_DAYS` back from now, as an ISO time. */
export function mailSavedShownSince(now: string): string {
  return new Date(Date.parse(now) - MAIL_SAVED_SHOWN_DAYS * 86_400_000).toISOString()
}

/** "today at 4:12 PM", "Tuesday at 9 AM": when a notice was written, in the app's own time. */
function whenWords(at: string, now: string): string {
  const time = clockTime(at).replace(':00 ', ' ')
  const day = calendarYmdInAppTzFromIso(at)
  return `${day === calendarYmdInAppTzFromIso(now) ? 'today' : dayLabel(day)} at ${time}`
}

/**
 * The line: the newest notice in its own words, when it was written, and how many more the last week holds. Null when
 * the week holds none. A notice older than `MAIL_SAVED_SHOWN_DAYS` is left to the record.
 */
export function mailSavedNeed(rows: readonly MailSavedRow[], now: string): MailSavedNeed | null {
  const from = Date.parse(mailSavedShownSince(now))
  const shown = rows.filter((r) => r.title.trim() !== '' && Date.parse(r.sentAt) >= from).sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt))
  const newest = shown[0]
  if (!newest) return null
  const more = shown.length - 1
  const sentences = [`It was ${whenWords(newest.sentAt, now)}.`]
  if (more > 0) sentences.push(`${more} more ${more === 1 ? 'notice' : 'notices'} in the last ${MAIL_SAVED_SHOWN_DAYS} days.`)
  sentences.push('Nothing changed in your Gmail.')
  return { count: shown.length, title: newest.title.trim(), detail: sentences.join(' ') }
}
