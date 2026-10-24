/**
 * Quickfill's Email station (punch list #159, v2.5814): what the station says about one counted label, read from the
 * rows the sweep keeps (`email_box_threads`): the live count, the oldest thread's age, the threads sitting past the
 * limit (the owner's number of days) with the day each arrived, who wrote and what about, and a door into Gmail under
 * the box's own address; what moved since the last look (new, cleared, still here); the note the mark saves, so the
 * history names what sat without anyone typing it; and the words for a label the box does not have. Pure.
 */
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { INBOX_LABEL } from './countedBoxes'
import { ageDays } from './labelSweep'

/** A row of `email_box_threads` as the station reads it. */
export interface ThreadRow {
  gmail_thread_id: string
  label_name: string
  arrived_at: string | null
  last_at: string | null
  from_name: string | null
  from_address: string | null
  subject: string
  first_seen_at: string
  gone_at: string | null
}

/** One thread sitting past the limit, as the station draws it. */
export interface ThreadFact {
  threadId: string
  /** Whole days since it arrived. */
  days: number
  arrivedYmd: string
  /** "Sat Oct 17". */
  arrivedWords: string
  /** The sender's name, else their address, else "someone". */
  from: string
  subject: string
  /** The thread in Gmail, under the box's address. */
  href: string
}

export interface LabelFacts {
  label: string
  /** Open threads in the label. */
  count: number
  oldestDays: number | null
  /** The open threads past the limit, oldest first. */
  past: ThreadFact[]
  /** Open threads newer than the limit, as a number. */
  newer: number
  /** Since the last look: first seen after it, marked gone after it, and open since before it. Zeros with no last look. */
  newSince: number
  clearedSince: number
  stillSince: number
}

export interface LabelFactsInput {
  address: string
  limitDays: number
  nowIso: string
  /** The last mark's time, or null when nobody has looked. */
  sinceIso: string | null
}

/** The label's name as Gmail's web address spells it: spaces as +, the rest encoded. */
const labelPath = (label: string): string => encodeURIComponent(label.trim()).replace(/%20/g, '+')

/** The box's Inbox or label in Gmail, opened as that box's account (`authuser=`). */
export function gmailLabelHref(address: string, label: string): string {
  const user = `https://mail.google.com/mail/?authuser=${encodeURIComponent(address)}`
  return label.trim().toLowerCase() === INBOX_LABEL.toLowerCase() ? `${user}#inbox` : `${user}#label/${labelPath(label)}`
}

/** One thread in Gmail, opened as that box's account. */
export function gmailThreadHref(address: string, threadId: string): string {
  return `https://mail.google.com/mail/?authuser=${encodeURIComponent(address)}#all/${encodeURIComponent(threadId)}`
}

/** "Sat Oct 17", in the app's calendar. */
export function arrivedWords(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, weekday: 'short', month: 'short', day: 'numeric' }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('weekday')} ${get('month')} ${get('day')}`.trim()
}

const after = (iso: string | null | undefined, since: string): boolean => !!iso && new Date(iso).getTime() > new Date(since).getTime()

/** The facts for one label from its rows (rows of other labels are passed over). */
export function labelFacts(label: string, rows: readonly ThreadRow[], input: LabelFactsInput): LabelFacts {
  const mine = rows.filter((r) => r.label_name === label)
  const open = mine.filter((r) => !r.gone_at)
  const aged = open.map((r) => ({ r, days: ageDays(r.arrived_at, input.nowIso) }))
  const past = aged
    .filter((x): x is { r: ThreadRow; days: number } => x.days != null && x.days > input.limitDays)
    .sort((a, b) => b.days - a.days || (a.r.arrived_at ?? '').localeCompare(b.r.arrived_at ?? ''))
    .map(({ r, days }) => ({
      threadId: r.gmail_thread_id,
      days,
      arrivedYmd: r.arrived_at ? calendarYmdInAppTzFromIso(r.arrived_at) : '',
      arrivedWords: r.arrived_at ? arrivedWords(r.arrived_at) : '',
      from: r.from_name?.trim() || r.from_address?.trim() || 'someone',
      subject: r.subject.trim() || '(no subject)',
      href: gmailThreadHref(input.address, r.gmail_thread_id),
    }))
  const ages = aged.map((x) => x.days).filter((d): d is number => d != null)
  const since = input.sinceIso
  return {
    label,
    count: open.length,
    oldestDays: ages.length ? Math.max(...ages) : null,
    past,
    newer: open.length - past.length,
    newSince: since ? open.filter((r) => after(r.first_seen_at, since)).length : 0,
    clearedSince: since ? mine.filter((r) => after(r.gone_at, since)).length : 0,
    stillSince: since ? open.filter((r) => !after(r.first_seen_at, since)).length : 0,
  }
}

/** What moved since the last look, summed over labels. */
export function sinceTotals(facts: readonly LabelFacts[]): { newSince: number; clearedSince: number; stillSince: number } {
  return facts.reduce((t, f) => ({ newSince: t.newSince + f.newSince, clearedSince: t.clearedSince + f.clearedSince, stillSince: t.stillSince + f.stillSince }), { newSince: 0, clearedSince: 0, stillSince: 0 })
}

/** The row's words for a label the box does not have. */
export function missingLabelWords(label: string, boxWords: string): string {
  return `No label named ${label} in ${boxWords} yet. Make it in Gmail, or pick another label.`
}

/** A box as the note names it. */
export interface NoteBox {
  /** "bids@", "work@", or the person's first name. */
  words: string
  labels: readonly (LabelFacts | { label: string; missing: true })[]
}

const NOTE_MAX_CHARS = 10_000
const NOTE_THREADS_PER_LABEL = 3

/** "Oct 22" in the app's calendar. */
const dayWords = (iso: string): string => new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric' }).format(new Date(iso))

/**
 * The note the mark saves, one line per box in today's "Inbox: …" shape, so the history still reads as text:
 *   bids@ · Inbox 2, oldest 6d (Ridgeway Builders, Lot 7 — final waivers) · Follow Up clean
 *   Marisol · Follow Up 2, oldest 9d (Harlan Freight, W-9) · Next Actions 1, oldest 12d (Applicants, plumber helper)
 *   +2 new, 2 cleared, 4 still here since Oct 22
 * then the person's own sentence when they typed one. Capped at the mark's 10,000 characters.
 */
export function composeLookNote(boxes: readonly NoteBox[], sinceIso: string | null, word?: string | null): string {
  const lines: string[] = []
  const facts: LabelFacts[] = []
  for (const b of boxes) {
    const parts = b.labels.map((l) => {
      if ('missing' in l) return `${l.label} (no such label)`
      facts.push(l)
      if (l.count === 0) return `${l.label} clean`
      const names = l.past.slice(0, NOTE_THREADS_PER_LABEL).map((t) => `${t.from}, ${t.subject}`).join('; ')
      const more = l.past.length > NOTE_THREADS_PER_LABEL ? `; +${l.past.length - NOTE_THREADS_PER_LABEL} more` : ''
      return `${l.label} ${l.count}, oldest ${l.oldestDays ?? 0}d${names ? ` (${names}${more})` : ''}`
    })
    lines.push(`${b.words} · ${parts.join(' · ')}`)
  }
  if (sinceIso) {
    const t = sinceTotals(facts)
    lines.push(`+${t.newSince} new, ${t.clearedSince} cleared, ${t.stillSince} still here since ${dayWords(sinceIso)}`)
  }
  const w = (word ?? '').trim()
  if (w) lines.push(w)
  const joined = lines.join('\n')
  return joined.length > NOTE_MAX_CHARS ? joined.slice(0, NOTE_MAX_CHARS) : joined
}
