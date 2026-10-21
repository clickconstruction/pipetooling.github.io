/**
 * Punch list #140 PR 1: Settings → Phone and texts → **Office hours**, the card that writes the hours `hasRule.ts` reads
 * (`app_settings` `messages_office_hours_v1`). Pure: the words, the draft the card edits, what is wrong with a draft,
 * the JSON a save writes (the tech's hour and the after-hours number kept as they are, `savedAt` added so the switch
 * card of PR 2 can say the hours were set at least once), and the one line that reads the hours back.
 * `hasRule.ts` is a mirrored kernel (`scripts/edge-kernels.mjs`), so nothing here touches it: `parseOfficeHours` reads
 * only its five fields and ignores `savedAt`.
 */
import type { OfficeHours } from './hasRule'

export const OFFICE_HOURS_WORDS = {
  title: 'Office hours',
  note: 'When the office is in. After hours a reply waits for the morning, and the office hears it first.',
  days: 'Days',
  opens: 'Opens',
  closes: 'Closes',
  save: 'Save the hours',
  putBack: 'Put them back',
  notAllowed: 'The owner or a dev sets the hours.',
  noDays: 'Pick at least one day.',
  closeBeforeOpen: 'Close must come after open.',
  badTime: 'Pick an open time and a close time.',
  saved: 'Office hours saved.',
  notSaved: 'The hours did not change. Only the owner or a dev can set the office hours.',
  loading: 'Reading the hours…',
} as const

/** The days as the toggles print them, Sunday first as `OfficeHours.days` counts them. */
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
/** The days' full names, for the toggles' accessible names. */
export const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

/** What the card edits: the open days and the two times, "HH:MM" as the inputs hold them. */
export interface OfficeHoursDraft {
  days: number[]
  opens: string
  closes: string
}

const HM = /^([01]?\d|2[0-3]):([0-5]\d)$/

function minutesOf(hm: string): number | null {
  const m = HM.exec(hm.trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

const sortedDays = (days: readonly number[]): number[] => [...new Set(days)].sort((a, b) => a - b)

/** The draft the card starts from: the hours as they are. */
export function draftFrom(hours: OfficeHours): OfficeHoursDraft {
  return { days: sortedDays(hours.days), opens: hours.opens, closes: hours.closes }
}

/** Whether two drafts say the same hours, so Save knows nothing changed. */
export function sameDraft(a: OfficeHoursDraft, b: OfficeHoursDraft): boolean {
  const da = sortedDays(a.days)
  const db = sortedDays(b.days)
  return da.length === db.length && da.every((d, i) => d === db[i]) && a.opens.trim() === b.opens.trim() && a.closes.trim() === b.closes.trim()
}

/** A day pressed on or off, the list kept sorted. */
export function toggleDay(days: readonly number[], day: number): number[] {
  return days.includes(day) ? days.filter((d) => d !== day) : sortedDays([...days, day])
}

/** What stops a save, in the card's words, or null when the draft is good. */
export function draftProblem(draft: OfficeHoursDraft): string | null {
  if (draft.days.length === 0) return OFFICE_HOURS_WORDS.noDays
  const opens = minutesOf(draft.opens)
  const closes = minutesOf(draft.closes)
  if (opens === null || closes === null) return OFFICE_HOURS_WORDS.badTime
  if (opens >= closes) return OFFICE_HOURS_WORDS.closeBeforeOpen
  return null
}

const pad = (hm: string): string => hm.trim().padStart(5, '0')

/**
 * The JSON a save writes: the draft's days and times, the tech's hour and the after-hours number as the row keeps
 * them, and when the card saved. `parseOfficeHours` reads it back and ignores `savedAt`.
 */
export function serializeOfficeHours(current: OfficeHours, draft: OfficeHoursDraft, savedAtIso: string): string {
  return JSON.stringify({
    days: sortedDays(draft.days),
    opens: pad(draft.opens),
    closes: pad(draft.closes),
    techUntil: current.techUntil,
    emergency: current.emergency,
    savedAt: savedAtIso,
  })
}

/** Whether the card has saved the hours at least once: the row carries a `savedAt` the card wrote. */
export function officeHoursSet(valueText: string | null | undefined): boolean {
  if (!valueText?.trim()) return false
  try {
    const parsed: unknown = JSON.parse(valueText)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return false
    const savedAt = (parsed as Record<string, unknown>).savedAt
    return typeof savedAt === 'string' && !Number.isNaN(Date.parse(savedAt))
  } catch {
    return false
  }
}

/** "7:30 AM", "5:00 PM", "12:00 AM": a 24-hour "HH:MM" in the office's words. A time it cannot read comes back as typed. */
export function timeWords(hm: string): string {
  const minutes = minutesOf(hm)
  if (minutes === null) return hm
  const h24 = Math.floor(minutes / 60)
  const m = minutes % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`
}

/** "Mon to Fri", "Mon, Wed and Fri", "Mon and Wed", "Sat", "Every day", or "No days" when none is on. */
export function daysWords(days: readonly number[]): string {
  const d = sortedDays(days).filter((x) => x >= 0 && x <= 6)
  if (d.length === 0) return 'No days'
  if (d.length === 7) return 'Every day'
  const names = d.map((x) => DAY_SHORT[x]!)
  const contiguous = d[d.length - 1]! - d[0]! + 1 === d.length
  if (contiguous && d.length >= 3) return `${names[0]} to ${names[names.length - 1]}`
  if (names.length === 1) return names[0]!
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** The line that reads the hours back: "Mon to Fri, 7:30 AM to 5:00 PM". */
export function hoursLine(hours: Pick<OfficeHours, 'days' | 'opens' | 'closes'>): string {
  return `${daysWords(hours.days)}, ${timeWords(hours.opens)} to ${timeWords(hours.closes)}`
}
