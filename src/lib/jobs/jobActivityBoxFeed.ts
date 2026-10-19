import type { JobThreadActivityItem } from '../../components/JobThreadNotesPanel'
import type { JobActivityEvent } from '../jobActivityEvent'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

/**
 * Feed shaping for the Pipeline row "Job activity" box (wide desktop only):
 * the conversational trail — thread NOTES (incl. % auto-notes and arrived/
 * leaving stamps) and REPORTS — numbered chronologically with 1 = OLDEST so a
 * note's number never shifts as new ones arrive ("check note 3" stays note 3).
 * Schedule/clock/event synthetic items are excluded: they're timeline texture,
 * not conversation, and the unified activity view carries them. One kind of
 * event is conversation and comes in since v2.5633: a bill sent to the
 * customer (Stripe's email, the app's), the owner's catch on the Palmer row.
 * It takes no number, so "check note 3" still never shifts.
 *
 * The expanded surfaces (floating modal + row panel) shape their WHOLE-timeline
 * lines in `jobActivityLine.ts`, which numbers with this same comparator so the
 * box and the views always agree on which note is note 3.
 */

export type JobActivityBoxEntry = {
  /** Stable conversational number — 1 is the oldest note/report on the job. Null on a bill sent: it takes no number. */
  number: number | null
  kind: 'note' | 'report' | 'sent'
  atIso: string
  authorName: string | null
  body: string
}

/** The events that are a word to the customer: the bill went to them (`invoice_sent`), or Stripe's email did (the backfill's kind). */
export const SENT_EVENT_TYPES: ReadonlySet<JobActivityEvent['type']> = new Set<JobActivityEvent['type']>(['invoice_sent', 'invoice_stripe_email_sent'])

/** Who sent it: the actor off the row, else the app, since Stripe's send runs as the service role with no signed-in name. */
export const SENT_BY_APP = 'The app'

/**
 * The line's words from the event: the channel in its detail (`channel: 'stripe'`) or in its summary's parentheses,
 * *Invoice sent to customer (stripe)*. Stripe's email says so; another email says emailed; anything else, sent.
 */
export function sentLineBody(event: Pick<JobActivityEvent, 'type' | 'summary' | 'detail'>): string {
  const fromDetail = typeof event.detail?.channel === 'string' ? event.detail.channel : ''
  const fromSummary = /\(([a-z_ -]+)\)\s*$/i.exec(event.summary ?? '')?.[1] ?? ''
  const channel = (fromDetail || fromSummary).trim().toLowerCase()
  if (event.type === 'invoice_stripe_email_sent' || channel === 'stripe') return 'Bill emailed through Stripe'
  if (channel === 'email') return 'Bill emailed to the customer'
  return 'Bill sent to the customer'
}

/**
 * v2.1640: arrive/leave stamp notes store "Name · Wed, Aug 12, 2026 at 11:58 AM
 * — Leaving job" as their body (`buildJobThreadStampBody`) — but this box
 * already prints the author and time as line meta, so the body's copy is pure
 * duplication. Reduce a recognized stamp body to its phrase; anything that
 * doesn't match the exact stamp shape (manual notes, edited text) passes
 * through untouched. Display-only — other surfaces keep the full body.
 */
const STAMP_BODY_RE = /^.+ · .+ — (Arrived at job|Leaving job)$/

export function stripRedundantStampBody(body: string): string {
  const m = STAMP_BODY_RE.exec(body)
  return m ? m[1]! : body
}

function entryFromItem(item: JobThreadActivityItem): Omit<JobActivityBoxEntry, 'number'> | null {
  if (item.kind === 'note') {
    return {
      kind: 'note',
      atIso: item.note.created_at,
      authorName: item.note.author?.name?.trim() || null,
      body: stripRedundantStampBody((item.note.body ?? '').trim()),
    }
  }
  if (item.kind === 'report') {
    return {
      kind: 'report',
      atIso: item.report.created_at,
      authorName: (item.report.created_by_name ?? '').trim() || null,
      body: `Report: ${(item.report.template_name ?? '').trim() || 'Report'}`,
    }
  }
  if (item.kind === 'event' && SENT_EVENT_TYPES.has(item.event.type)) {
    return { kind: 'sent', atIso: item.event.occurredAt, authorName: item.event.actorName?.trim() || SENT_BY_APP, body: sentLineBody(item.event) }
  }
  return null
}

/**
 * Numbered feed, OLDEST FIRST — chat order, newest at the bottom (owner
 * request v2.2062; the box keeps itself scrolled to the newest). Items are
 * re-sorted by time here so numbering never depends on the caller's
 * ordering; ties keep input order. Numbers stay stable references:
 * 1 = the oldest note/report, "check note 3" never shifts; a bill sent sits
 * in its place in time with no number (v2.5633).
 */
export function buildJobActivityBoxFeed(items: JobThreadActivityItem[]): JobActivityBoxEntry[] {
  const entries = items
    .map(entryFromItem)
    .filter((e): e is Omit<JobActivityBoxEntry, 'number'> => e !== null)
    .map((e, inputIndex) => ({ e, inputIndex, t: Date.parse(e.atIso) }))
    .sort((a, b) => (a.t === b.t || Number.isNaN(a.t) || Number.isNaN(b.t) ? a.inputIndex - b.inputIndex : a.t - b.t))
  let next = 0
  return entries.map(({ e }) => ({ ...e, number: e.kind === 'sent' ? null : ++next }))
}

export function jobActivityItemTimeIso(item: JobThreadActivityItem): string {
  switch (item.kind) {
    case 'note':
      return item.note.created_at
    case 'report':
      return item.report.created_at
    case 'schedule_block':
      return item.schedule.sortAt
    case 'clock_session':
      return item.clock.sortAt
    case 'event':
      return item.event.occurredAt
    default:
      return ''
  }
}

/** Chicago calendar day (YYYY-MM-DD) for an instant; '' when it won't parse. */
export function chicagoActivityDayKey(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(t))
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** e.g. "Wed, Aug 12" in Chicago; '—' when the instant won't parse. */
export function chicagoActivityDayLabel(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  const get = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, ...opts }).format(new Date(t))
  return `${get({ weekday: 'short' })}, ${get({ month: 'short' })} ${get({ day: 'numeric' })}`
}

