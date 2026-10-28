/**
 * Punch list #141 PR 2: **Push me**, the block on the Push Notifications card (Settings → Your account). Each person
 * says the days and hours their phone is pushed, in the Office hours card's own shape said the right way round: the
 * hours you are pushed, not the hours you are quiet, so a day toggled off is a day with no pushes and the window never
 * crosses midnight. Pure. The row is `user_push_hours` (`pushHoursIo.ts`), one a person; no row is any time. The
 * check is `officeOpen` from `hasRule.ts`, the kernel the office's hours use and already on the edge, so PR 3 can hold
 * a push there with nothing new mirrored for the read. Until PR 3 nothing holds a push: the block saves and reads
 * back, and its last line says so.
 */
import { nextOpening, OFFICE_HOURS, officeOpen, type OfficeHours } from './hasRule'
import { daysWords, draftProblem, OFFICE_HOURS_WORDS, sameDraft, timeWords, type OfficeHoursDraft } from './officeHoursCard'

export const PUSH_HOURS_WORDS = {
  title: 'Push me',
  any: 'Push me any time',
  only: 'Push me only at these hours',
  days: 'Days',
  from: 'From',
  to: 'To',
  save: 'Save my hours',
  putBack: 'Put them back',
  /** The line that reads the hours back when there are none. */
  anyLine: 'Pushed any time.',
  noDays: 'Pick at least one day.',
  badTime: 'Pick a from time and a to time.',
  toBeforeFrom: 'To must come after From.',
  /** What the hours do. PR 3 holds the push and drops the first four words. */
  hold: 'From the next update, a push outside these hours waits for you. A customer’s reply still goes to the office at once. The Dashboard lists what waited when you are back.',
  notSaved: 'Your hours were not saved.',
  loading: 'Reading your hours…',
} as const

/** What a person starts from when they first pick Only at these hours: every day, 6 AM to 8 PM. Weekends off is two presses. */
export const PUSH_HOURS_DEFAULT: OfficeHours = { ...OFFICE_HOURS, days: [0, 1, 2, 3, 4, 5, 6], opens: '06:00', closes: '20:00', always: false }

const HM = /^([01]?\d|2[0-3]):([0-5]\d)$/

function minutesOf(hm: unknown): number | null {
  if (typeof hm !== 'string') return null
  const m = HM.exec(hm.trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

const pad = (hm: string): string => hm.trim().padStart(5, '0')

const sortedDays = (days: readonly number[]): number[] => [...new Set(days)].sort((a, b) => a - b)

/** The row as stored, or what the block is about to write. */
export interface PushHoursRow {
  days: number[]
  opens: string
  closes: string
}

/**
 * The person's hours as `hasRule.ts` reads hours: the switch off, the tech's fields the office defaults. Null for any
 * time: no row, or a row that cannot be read (no known day, a time that is not "HH:MM", to at or before from), so a
 * bad row never holds a push.
 */
export function parsePushHours(row: { days?: unknown; opens?: unknown; closes?: unknown } | null | undefined): OfficeHours | null {
  if (!row) return null
  const days = Array.isArray(row.days) ? sortedDays(row.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6)) : []
  const opens = minutesOf(row.opens)
  const closes = minutesOf(row.closes)
  if (days.length === 0 || opens === null || closes === null || opens >= closes) return null
  return { ...OFFICE_HOURS, days, opens: pad(row.opens as string), closes: pad(row.closes as string), always: false }
}

/** Whether a push reaches the person at this instant: always with no hours, else inside them. */
export function pushedNow(at: string, hours: OfficeHours | null): boolean {
  return hours === null || officeOpen(at, hours)
}

/** When the person's hours next open, ISO, or null when they are pushed now. */
export function backAt(at: string, hours: OfficeHours | null): string | null {
  if (pushedNow(at, hours)) return null
  return nextOpening(at, hours!)
}

/** The line that reads the hours back: "Pushed Mon to Fri, 6:00 AM to 8:00 PM." or "Pushed any time." */
export function pushHoursLine(hours: OfficeHours | null): string {
  if (!hours) return PUSH_HOURS_WORDS.anyLine
  return `Pushed ${daysWords(hours.days)}, ${timeWords(hours.opens)} to ${timeWords(hours.closes)}.`
}

/** What the block edits: the pick, and under Only at these hours the days and the two times as the inputs hold them. */
export interface PushHoursDraft {
  only: boolean
  days: number[]
  opens: string
  closes: string
}

const asOffice = (d: PushHoursDraft): OfficeHoursDraft => ({ always: false, days: d.days, opens: d.opens, closes: d.closes })

/** The draft the block starts from: the hours as they are, or any time over the default window. */
export function pushDraftFrom(hours: OfficeHours | null): PushHoursDraft {
  const h = hours ?? PUSH_HOURS_DEFAULT
  return { only: hours !== null, days: sortedDays(h.days), opens: h.opens, closes: h.closes }
}

/** Whether two drafts say the same thing, so Save knows nothing changed. Two any-time drafts always do. */
export function samePushDraft(a: PushHoursDraft, b: PushHoursDraft): boolean {
  if (a.only !== b.only) return false
  if (!a.only) return true
  return sameDraft(asOffice(a), asOffice(b))
}

/** What stops a save, in the block's words, or null. Nothing stops any time. The rule is the Office hours card's. */
export function pushDraftProblem(draft: PushHoursDraft): string | null {
  if (!draft.only) return null
  const p = draftProblem(asOffice(draft))
  if (p === OFFICE_HOURS_WORDS.noDays) return PUSH_HOURS_WORDS.noDays
  if (p === OFFICE_HOURS_WORDS.badTime) return PUSH_HOURS_WORDS.badTime
  if (p === OFFICE_HOURS_WORDS.closeBeforeOpen) return PUSH_HOURS_WORDS.toBeforeFrom
  return p
}

/** The hours a draft says: null for any time, and null for a draft a save would refuse. */
export function pushHoursOf(draft: PushHoursDraft): OfficeHours | null {
  if (!draft.only) return null
  return parsePushHours({ days: draft.days, opens: draft.opens, closes: draft.closes })
}

/** The row a save writes: the days sorted, the times zero-padded so the table's to-after-from check reads them. */
export function pushRowOf(hours: OfficeHours): PushHoursRow {
  return { days: sortedDays(hours.days), opens: pad(hours.opens), closes: pad(hours.closes) }
}
