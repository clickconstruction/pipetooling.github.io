/**
 * The owner is told (v2.7068). When a developer saves a conversation out of someone's mailbox onto a job through the
 * dev seat, that person gets a notice of their own in `notification_history` (`gmail-mine`'s `noteSavedForYou`,
 * `MAIL_SAVED_TEMPLATE`, channel `app`). The owner chose the app alone: nothing is pushed and nothing is emailed, so
 * nothing lands in their inbox. The notice is a record and nothing more: its row under Settings → Activity logs, read
 * by the person alone. The Needs you card drew a line from it for seven days until the owner had the line taken off
 * (2026-11-19), and `dashboardNeedsYou.mailSaved.test.ts` holds that. These are the record's words.
 */
import { MAIL_SAVED_CHANNEL } from './savedForYouNames'

export { MAIL_SAVED_CHANNEL }

export const MAIL_SAVED_WORDS = {
  /** The badge on the record's row under Settings → Activity logs. */
  badge: 'In the app',
} as const
