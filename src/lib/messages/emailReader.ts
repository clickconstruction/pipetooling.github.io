/**
 * Messages, cut 6: Settings → Phone and texts → **Read bids@**, the switch for the `gmail-sync` reader and how it is
 * doing, in words. The switch is `app_settings.gmail_sync_on_v1` (`APP_SETTINGS_KEY_GMAIL_SYNC_ON_V1`): the cron posts to
 * the reader only while it reads 'true', and only the owner and a dev may change it. How it is doing is
 * `gmail_sync_state`'s one row: a run that ends well sets `last_ok_at` and clears `last_error`, and a run that stops
 * sets `last_error` and leaves `last_ok_at` as it was. Pure.
 */
import type { UserRole } from '../../hooks/useAuth'
import { lineWhen } from './thread'

/** How the reader is doing, as `gmail_sync_state` holds it. Null before its row is there. */
export interface ReaderHealth {
  last_ok_at: string | null
  last_error: string | null
}

export const READER_TITLE = 'Read bids@'
export const READER_WHAT = 'Every 3 minutes the app reads new email in bids@ and puts each one on its sender’s thread. In Gmail, each email it read gets the label In ClickTooling.'
export const READER_CONFIRM = {
  title: 'Turn on reading bids@?',
  message: 'Every 3 minutes the app reads new email in bids@ into Messages. It never deletes, moves or archives an email, and never marks one read.',
  confirmLabel: 'Turn it on',
} as const
export const READER_ON_TOAST = 'Reading bids@ is on. The first read comes within 3 minutes.'
export const READER_OFF_TOAST = 'Reading bids@ is off. Email to bids@ stays in Gmail only.'
export const READER_NOT_SAVED = 'The switch did not change. Only the owner or a dev can turn reading bids@ on or off.'

/** Who may turn the reader on or off: the owner and a dev, as the switch's UPDATE policy (`is_master_or_dev()`) allows. */
export function canSwitchReader(role: UserRole | null | undefined): boolean {
  return role === 'master_technician' || role === 'dev'
}

/** Whether the switch reads on: only 'true' lets the cron post, as its statement reads it. */
export function readerIsOn(valueText: string | null | undefined): boolean {
  return valueText === 'true'
}

/** "Last read today at 7:12 PM. Nothing wrong.", or the error's own words when the last run stopped on one. */
export function readerHealthWords(health: ReaderHealth | null, nowIso: string): string {
  const read = health?.last_ok_at ? `Last read ${lineWhen(health.last_ok_at, nowIso).replace(' · ', ' at ')}.` : 'Not read yet.'
  const error = health?.last_error?.trim()
  if (error) return `${read} The last run stopped: ${error}`
  return health?.last_ok_at ? `${read} Nothing wrong.` : read
}
