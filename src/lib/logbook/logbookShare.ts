/**
 * The logbook, shown to its teammate (punch list #255, v2.6483). The office presses Show on a teammate's logbook
 * (a `logbook_shares` row); the teammate then finds My logbook in the app's menu and reads the page through
 * `my_logbook()`, which answers for the person signed in and only once shown.
 *
 * Pure: the strip's words on the office's logbook, and the parse of `my_logbook()`'s answer.
 */
import type { LicenseHoursLogRow } from '../licenseHoursLog'
import { parseLicenseTargets, type LicenseTarget } from './logbook'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

export type LogbookShare = { userId: string; shownBy: string | null; shownAt: string }

export type ShareStrip = { shown: boolean; text: string; button: string }

/** The instant's day on the company calendar, as "Nov 4". */
function shortDay(iso: string): string {
  const ymd = calendarYmdInAppTzFromIso(iso)
  if (!ymd) return ''
  const [y = 1970, m = 1, d = 1] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** The strip under the logbook's header: who can see the page, and the press that changes it. */
export function shareStripWords(firstName: string, share: LogbookShare | null, shownByName: string | null): ShareStrip {
  const who = firstName.trim() || 'This teammate'
  if (!share) {
    return {
      shown: false,
      text: `${who} cannot see this logbook. Show it, and ${who} finds My logbook in the app’s menu.`,
      button: `Show ${who} this logbook`,
    }
  }
  const day = shortDay(share.shownAt)
  const by = shownByName?.trim()
  const when = day ? ` Shown ${day}${by ? ` by ${by}` : ''}.` : ''
  return { shown: true, text: `${who} sees this logbook in the app’s menu.${when}`, button: 'Stop showing' }
}

export type MyLogbookLicense = { id: string; license_type: string; date_of_expiry: string | null }
export type MyLogbookSigner = { person_name: string; license_type: string; date_of_expiry: string | null }
export type MyLogbook = {
  name: string
  hours: LicenseHoursLogRow[]
  licenses: MyLogbookLicense[]
  signers: MyLogbookSigner[]
  /** The office's targets for the teammate: the class, the board's number, the hours before the clock (v2.6626). */
  targets: LicenseTarget[]
  officeJobId: string | null
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[]) : [])

/** `my_logbook()`'s jsonb, typed. NULL (not shown) stays null. */
export function parseMyLogbook(raw: unknown): MyLogbook | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  return {
    name: str(o.name),
    hours: arr(o.hours).map((h) => ({
      session_id: str(h.session_id),
      work_date: str(h.work_date),
      clocked_in_at: str(h.clocked_in_at),
      clocked_out_at: str(h.clocked_out_at),
      hours: Number(h.hours) || 0,
      job_ledger_id: strOrNull(h.job_ledger_id),
      job_number: str(h.job_number),
      job_name: str(h.job_name),
      job_address: str(h.job_address),
      service_type_name: str(h.service_type_name),
      bid_id: strOrNull(h.bid_id),
      notes: str(h.notes),
    })),
    licenses: arr(o.licenses).map((l) => ({ id: str(l.id), license_type: str(l.license_type), date_of_expiry: strOrNull(l.date_of_expiry) })),
    signers: arr(o.signers).map((s) => ({ person_name: str(s.person_name), license_type: str(s.license_type), date_of_expiry: strOrNull(s.date_of_expiry) })),
    targets: parseLicenseTargets(o.targets),
    officeJobId: strOrNull(o.office_job_id),
  }
}
