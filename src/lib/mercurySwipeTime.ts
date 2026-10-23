// When a card was swiped, and which company day that was. Mercury creates a card transaction at the
// swipe (`raw.createdAt`) and posts it when it settles (`posted_at`): a median 8 hours later,
// overnight, and on a later company day for two charges in five (punch list #72, 2026-10-06). The
// job a charge belongs to is the job worked on the day of the swipe, so every window that offers a
// day's jobs reads the swipe. Lists and floors that count posted money stay on `posted_at`. Pure.

import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import { formatWeekdayAgoPhrase } from './relativeDayPhrase'

/** ISO with a T, whole seconds, an optional fraction, and Z or an offset: the server's own test. */
const ISO_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/

/**
 * True when `s` is an instant the database would also take as the purchase time
 * (`list_card_charges_window.purchased_at`, v2.4665): the ISO shape above, and a real calendar
 * day and clock time. `Date.parse` alone takes non-ISO forms and rolls Feb 30 into March.
 */
export function isMercuryIsoInstant(s: string): boolean {
  const m = ISO_INSTANT.exec(s)
  if (!m) return false
  const [y, mo, d, h, mi, se] = m.slice(1, 7).map(Number) as [number, number, number, number, number, number]
  const day = new Date(Date.UTC(y, mo - 1, d))
  if (day.getUTCFullYear() !== y || day.getUTCMonth() !== mo - 1 || day.getUTCDate() !== d) return false
  if (h > 23 || mi > 59 || se > 59) return false
  return Number.isFinite(Date.parse(s))
}

/** The swipe time: `raw.createdAt` when it is a valid ISO instant, else `posted_at`, else null. */
export function mercurySwipeAtIso(raw: unknown, postedAt: string | null | undefined): string | null {
  const created = raw && typeof raw === 'object' ? (raw as { createdAt?: unknown }).createdAt : null
  if (typeof created === 'string' && isMercuryIsoInstant(created)) return created
  return postedAt && calendarYmdInAppTzFromIso(postedAt) ? postedAt : null
}

/** The company day of the swipe, or null when neither time reads. */
export function mercurySwipeDayYmd(raw: unknown, postedAt: string | null | undefined): string | null {
  const at = mercurySwipeAtIso(raw, postedAt)
  return at ? calendarYmdInAppTzFromIso(at) || null : null
}

/** True when the charge posted on a later company day than it was swiped. */
export function mercuryPostedOnALaterDay(raw: unknown, postedAt: string | null | undefined): boolean {
  const swipeDay = mercurySwipeDayYmd(raw, postedAt)
  const postedDay = postedAt ? calendarYmdInAppTzFromIso(postedAt) : ''
  return Boolean(swipeDay && postedDay && postedDay !== swipeDay)
}

/** The columns an approval card reads for the charge's day. */
export type MercuryChargeDayRow = {
  raw: unknown
  created_at: string | null | undefined
  posted_at: string | null | undefined
  source?: string | null
}

/**
 * The instant the charge was made, for a row that may have been read without `raw`
 * (`MERCURY_TRANSACTIONS_BANKING_LIST_COLUMNS` leaves it out): `raw.createdAt` when it is
 * there, else the row's `created_at` (the sync stores Mercury's own `createdAt` in it, so a
 * synced charge keeps its swipe day before it posts), else `posted_at`. A manual row's
 * `created_at` is the upload, so it reads `posted_at` first. Null when nothing reads.
 */
export function mercuryChargeAtIso(tx: MercuryChargeDayRow): string | null {
  const fromRaw = mercurySwipeAtIso(tx.raw, null)
  if (fromRaw) return fromRaw
  const order = tx.source === 'manual' ? [tx.posted_at, tx.created_at] : [tx.created_at, tx.posted_at]
  for (const at of order) {
    if (at && calendarYmdInAppTzFromIso(at)) return at
  }
  return null
}

/** The company day of the charge, or null when no time reads. */
export function mercuryChargeDayYmd(tx: MercuryChargeDayRow): string | null {
  const at = mercuryChargeAtIso(tx)
  return at ? calendarYmdInAppTzFromIso(at) || null : null
}

/**
 * The day in the owner's shape for an approval card (v2.5804): `Tuesday · 3 days ago (10/20/26)`,
 * `Today (10/23/26)`, `Yesterday (10/22/26)`. `todayYmd` is the company day
 * (`todayYmdInAppTz()`), never the browser's. Null when no time reads.
 */
export function mercuryChargeDayPhrase(tx: MercuryChargeDayRow, todayYmd: string): string | null {
  const day = mercuryChargeDayYmd(tx)
  return day ? formatWeekdayAgoPhrase(day, todayYmd) : null
}
