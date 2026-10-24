/**
 * Quickfill's Email station (punch list #159, v2.5824, PR 3 of 5): the two Settings cards' rules and words.
 * Settings → Phone and texts → **Mail the app counts** is the owner's and a dev's: the switch (`email_count_on_v1`),
 * the limit in days (`email_count_limit_days_v1`), the shared boxes and the people the sweep counts (`email_box_watch`),
 * each row's labels, switch and health, and the one lead who sees everyone's rows (`email_count_lead_v1`). Settings →
 * Your account → **Mail Quickfill counts** is each listed person's own: their labels, the words that say what is kept
 * and who sees it, and their own switch. Pure; the reads and writes are `countCardIo.ts`.
 */
import type { UserRole } from '../../hooks/useAuth'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { lineWhen } from '../messages/thread'
import { cleanLabels, type WatchRow } from './countedBoxes'

export const COUNT_TITLE = 'Mail the app counts'
export const COUNT_WHAT = 'Every 15 minutes the app counts the mail sitting in the labels below, for Quickfill’s Email station. It keeps each thread’s sender, subject and dates. It never reads the words and never changes anything in Gmail.'
export const COUNT_CONFIRM = {
  title: 'Turn on counting mail?',
  message: 'Every 15 minutes the app reads the labels of each box below as that mailbox: senders, subjects and dates only. It never reads the words and never changes anything in Gmail.',
  confirmLabel: 'Turn it on',
} as const
export const COUNT_ON_TOAST = 'Counting mail is on. The first count comes within 15 minutes.'
export const COUNT_OFF_TOAST = 'Counting mail is off. The station keeps what it last counted.'
export const COUNT_NOT_SAVED = 'Nothing changed. Only the owner or a dev can change what the app counts.'
export const COUNT_ADMIN_STEP = 'Before the first count, the Workspace admin adds the Gmail metadata permission to the app’s delegation. Until then each box says Google refused it.'
export const SHARED_TITLE = 'The shared boxes'
export const PEOPLE_TITLE = 'People'
export const LEAD_TITLE = 'Who sees everyone’s rows'
export const LEAD_NOTE = 'Each person sees their own. The office team sees the shared boxes.'
export const LEAD_NOBODY = 'Nobody yet'
export const PERSON_OFF_NOTE = 'A person may switch their own rows off. You see that they did.'
export const LIMIT_BEFORE = 'Past the limit after'
export const LIMIT_AFTER = 'days'
export const ADD_SHARED = 'Add a shared box'
export const ADD_PERSON = 'Add a person'
export const REMOVE = 'Remove'
export const REMOVE_CONFIRM = (what: string) => ({ title: `Stop counting ${what}?`, message: 'Its rows and its trend go with it. Nothing changes in Gmail.', confirmLabel: 'Stop counting' }) as const
export const LABELS_HINT = 'Labels, with a comma between'
export const ADDRESS_BAD = 'That does not look like an email address.'
export const ADDRESS_TAKEN = 'That address is on the list already.'
export const PERSON_NO_EMAIL = 'has no email on their account, so there is no box to count.'

/** Who may change the list and the switch: the owner and a dev, as the policies allow. */
export function canSetEmailCount(role: UserRole | null | undefined): boolean {
  return role === 'master_technician' || role === 'dev'
}

export function countIsOn(valueText: string | null | undefined): boolean {
  return valueText === 'true'
}

export const LIMIT_DEFAULT = 3
export const LIMIT_MIN = 1
export const LIMIT_MAX = 30

/** The limit in days as the setting holds it: a whole number from 1 to 30, else the default of 3. */
export function limitDaysFrom(valueText: string | null | undefined): number {
  const n = Number.parseInt((valueText ?? '').trim(), 10)
  return Number.isInteger(n) && n >= LIMIT_MIN && n <= LIMIT_MAX ? n : LIMIT_DEFAULT
}

const ADDRESS_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

/** An address as the table takes it: trimmed and lower-cased, or null when it is not one. */
export function cleanAddress(raw: string): string | null {
  const a = raw.trim().toLowerCase()
  return ADDRESS_RE.test(a) ? a : null
}

/** "Inbox, Follow Up, Next Actions" typed in a box, as the row's labels. */
export function labelsFromText(text: string): string[] {
  return cleanLabels(text.split(','))
}

export function labelsText(labels: readonly string[] | null | undefined): string {
  return cleanLabels(labels).join(', ')
}

/** What the last sweep found for one label, as `labels_state` keeps it. */
export interface LabelState {
  at: string
  total?: number | null
  listed?: number
  cut?: boolean
  missing?: boolean
  error?: string
}

/** A row of `email_box_watch` as the cards read it. */
export interface WatchView extends WatchRow {
  labels_state: Record<string, LabelState> | null
  last_ok_at: string | null
  last_error: string | null
  created_at: string
  added_by: string | null
}

/** The labels the last sweep found missing in the box, in the row's order. */
export function missingLabels(row: Pick<WatchView, 'labels' | 'labels_state'>): string[] {
  const state = row.labels_state ?? {}
  return cleanLabels(row.labels).filter((l) => state[l]?.missing === true)
}

/** "Last counted today at 9:07 AM. Nothing wrong.", the error's own words, or the labels the box does not have. */
export function boxHealthWords(row: Pick<WatchView, 'labels' | 'labels_state' | 'last_ok_at' | 'last_error'>, nowIso: string): string {
  const counted = row.last_ok_at ? `Last counted ${lineWhen(row.last_ok_at, nowIso).replace(' · ', ' at ')}.` : 'Not counted yet.'
  const error = row.last_error?.trim()
  if (error) return `${counted} The last count stopped: ${error}`
  const missing = missingLabels(row)
  if (missing.length) return `${counted} No label named ${missing.join(' or ')}.`
  return row.last_ok_at ? `${counted} Nothing wrong.` : counted
}

/** "Inbox 2 · Follow Up 0 · Next Actions ?" from the last sweep; "—" before the first. */
export function labelCountsWords(row: Pick<WatchView, 'labels' | 'labels_state'>): string {
  const state = row.labels_state ?? {}
  const labels = cleanLabels(row.labels)
  if (!labels.some((l) => state[l])) return '—'
  return labels
    .map((l) => {
      const s = state[l]
      if (!s) return `${l} —`
      if (s.missing) return `${l} ?`
      if (s.error) return `${l} !`
      return `${l} ${typeof s.total === 'number' ? s.total : (s.listed ?? '—')}`
    })
    .join(' · ')
}

/** Someone the owner may add, or whose name a row shows. */
export interface CountPerson {
  id: string
  name: string
  email: string | null
}

/** The rows as the card draws them: the shared boxes, then the people with their names, each in the order added. */
export function splitWatch(rows: readonly WatchView[], people: readonly CountPerson[]): { shared: WatchView[]; persons: (WatchView & { name: string })[] } {
  const byId = new Map(people.map((p) => [p.id, p]))
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))
  return {
    shared: sorted.filter((r) => !r.user_id),
    persons: sorted.filter((r) => !!r.user_id).map((r) => ({ ...r, name: byId.get(r.user_id!)?.name ?? r.address })),
  }
}

/** The office people not on the list yet, with an email to count. */
export function peopleToAdd(people: readonly CountPerson[], rows: readonly WatchView[]): CountPerson[] {
  const listed = new Set(rows.map((r) => r.user_id).filter((u): u is string => !!u))
  const addresses = new Set(rows.map((r) => r.address.toLowerCase()))
  return people.filter((p) => !listed.has(p.id) && !!p.email && !addresses.has(p.email.toLowerCase()))
}

/** Why an address cannot be added, or null when it can. */
export function addressProblem(raw: string, rows: readonly WatchView[]): string | null {
  const a = cleanAddress(raw)
  if (!a) return ADDRESS_BAD
  if (rows.some((r) => r.address.toLowerCase() === a)) return ADDRESS_TAKEN
  return null
}

// ---- Your account → Mail Quickfill counts ----

export const MY_MAIL_TITLE = 'Mail Quickfill counts'
export const MY_MAIL_KEEPS = 'It keeps each thread’s sender, subject and dates. Never the words, never a file. It changes nothing in your Gmail.'
export const MY_MAIL_OFF_WORDS = 'Your mail is not counted while this is off. The owner sees that it is off.'
export const MY_MAIL_ADD_LABEL = 'a label'
export const MY_MAIL_SAVED = 'Saved. The next count reads these labels.'
export const MY_MAIL_NOT_SAVED = 'Nothing changed. Only you, the owner or a dev can change this.'

/** "Oct 24" in the app's calendar. */
const monthDay = (iso: string): string => new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric' }).format(new Date(iso))

/** The card's sentences for one person. */
export function myMailWords(input: { addedBy: string | null; addedOn: string; limitDays: number; leadName: string | null }): { intro: string; sees: string } {
  const who = input.addedBy ? `${input.addedBy} added you` : 'You were added'
  return {
    intro: `${who} on ${monthDay(input.addedOn)}. Quickfill’s Email station counts these labels of yours and lists the threads that sit past ${input.limitDays} days:`,
    sees: input.leadName ? `Who sees your rows: you and ${input.leadName}. Nobody else on the station.` : 'Who sees your rows: you alone, until the owner names a lead.',
  }
}
