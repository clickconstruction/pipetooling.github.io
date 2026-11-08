import type { JobThreadActivityItem } from '../../components/JobThreadNotesPanel'
import type { JobThreadNoteStats } from '../../hooks/useJobThreadNotes'
import type { JobActivityEvent } from '../jobActivityEvent'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { messageChannelWord, messageLineParts, messageTone, messageWho, type JobActivityMessage } from './jobActivityMessages'

/**
 * Feed shaping for the Pipeline row "Job activity" box (wide desktop only):
 * the conversational trail — thread NOTES (incl. % auto-notes and arrived/
 * leaving stamps) and REPORTS — numbered chronologically with 1 = OLDEST so a
 * note's number never shifts as new ones arrive ("check note 3" stays note 3).
 * Schedule/clock/event synthetic items are excluded: they're timeline texture,
 * not conversation, and the unified activity view carries them. One kind of
 * event is conversation and comes in since v2.5633: a bill sent to the
 * customer (Stripe's email, the app's), the owner's catch on the Palmer row.
 * Since v2.5636 the papers that follow a bill come in too: a paper bill
 * emailed again, a demand letter, a lien or retainage notice. They take no
 * number, so "check note 3" still never shifts. A contract reminder stays
 * out: the cron sends up to three on its own, and the contract's send is not
 * in the box either. Since v2.6689 (punch list #125, the owner's pick of option a) the customer's own
 * conversation comes in too: the job's newest three calls, texts, emails and portal lines between us and
 * the people on it, read once per board load (`pipeline_customer_lines`), each unnumbered under an
 * orange tag that names the channel, the customer's lines orange and a line from them with the bar.
 * Three is the sheet's number, so the box and the bubble's sheet show the same lines.
 *
 * The expanded surfaces (floating modal + row panel) shape their WHOLE-timeline
 * lines in `jobActivityLine.ts`, which numbers with this same comparator so the
 * box and the views always agree on which note is note 3.
 */

export type JobActivityBoxEntry = {
  /** Stable conversational number — 1 is the oldest note/report on the job. Null on a send or a line: neither takes a number. */
  number: number | null
  kind: 'note' | 'report' | 'sent' | 'line'
  atIso: string
  authorName: string | null
  body: string
  /** On a `line` (v2.6689): what the tag says, where it came from and how it reads. */
  line?: JobActivityBoxLine
}

/** The tag in a line's number place: the channel, one word. */
export type JobActivityBoxLineTag = 'Text' | 'Email' | 'Call' | 'Missed' | 'Voicemail' | 'Portal'

export interface JobActivityBoxLine {
  /** The `messages` row, so a press can open the thread at it. */
  id: string
  tag: JobActivityBoxLineTag
  /** The small word Job activity uses after the name: "text", "call · 3:12", "missed call". */
  channelWord: string
  /** From them (the bar) or from us. */
  fromThem: boolean
  /** The customer's line (orange, as Job activity draws it); a trade's or a supplier's tied line reads plain. */
  customer: boolean
  /** Their newest line and nobody has answered: the dot's words go on it. */
  waiting: boolean
}

/**
 * The events that are a word to the customer about their bill: the bill went to them (`invoice_sent`), Stripe's email
 * did (the backfill's kind), the paper bill went again, and since v2.5636 the demand letter and the lien notice.
 */
export const SENT_EVENT_TYPES: ReadonlySet<JobActivityEvent['type']> = new Set<JobActivityEvent['type']>([
  'invoice_sent',
  'invoice_stripe_email_sent',
  'invoice_resent',
  'demand_letter_sent',
  'lien_notice_sent',
])

/** Who sent it: the actor off the row, else the app, since Stripe's send runs as the service role with no signed-in name. */
export const SENT_BY_APP = 'The app'

/**
 * The line's words from the event. A paper resend, a demand letter and a notice say what they are. A bill reads the
 * channel in its detail (`channel: 'stripe'`) or in its summary's parentheses, *Invoice sent to customer (stripe)*:
 * Stripe's email says so; another email says emailed; anything else, sent.
 */
export function sentLineBody(event: Pick<JobActivityEvent, 'type' | 'summary' | 'detail'>): string {
  if (event.type === 'invoice_resent') return 'Bill emailed again'
  if (event.type === 'demand_letter_sent') return 'Demand letter sent'
  if (event.type === 'lien_notice_sent') return event.detail?.kind === 'retainage_53_057' ? 'Retainage notice sent' : 'Lien notice sent'
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

/** The tag's word for a channel; null for a note, an event or a channel this build does not draw. */
export function lineTagOf(channel: JobActivityMessage['channel']): JobActivityBoxLineTag | null {
  switch (channel) {
    case 'text':
      return 'Text'
    case 'email':
      return 'Email'
    case 'call':
      return 'Call'
    case 'missed':
      return 'Missed'
    case 'voicemail':
      return 'Voicemail'
    case 'portal':
      return 'Portal'
    default:
      return null
  }
}

/**
 * The words a line shows in the box: an email's subject before its words, a call's summary, a voicemail's words, a text
 * as written, each clipped at a word as Job activity clips them (`messageLineParts`).
 */
export function lineBody(m: JobActivityMessage): string {
  const { body } = messageLineParts(m)
  const subject = m.channel === 'email' ? (m.subject ?? '').trim() : ''
  if (!subject) return body
  return body && body !== subject ? `${subject} · ${body}` : subject
}

/** A call, a text, an email or a portal line as an unnumbered entry; null for a note, an event or a team line. */
export function entryFromLine(m: JobActivityMessage): Omit<JobActivityBoxEntry, 'number'> | null {
  const tag = lineTagOf(m.channel)
  if (!tag || (m.direction !== 'in' && m.direction !== 'out')) return null
  const tone = messageTone(m)
  return {
    kind: 'line',
    atIso: m.at,
    authorName: messageWho(m),
    body: lineBody(m),
    line: { id: m.id, tag, channelWord: messageChannelWord(m), fromThem: m.direction === 'in', customer: tone === 'customerIn' || tone === 'customerOut', waiting: false },
  }
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
 * 1 = the oldest note/report, "check note 3" never shifts; a send sits
 * in its place in time with no number (v2.5633).
 */
export interface BuildJobActivityBoxFeedOptions {
  /** The customer's conversation (v2.6689): the board's newest lines on the job, each an unnumbered `line` entry. */
  lines?: readonly JobActivityMessage[]
  /** The dot is on: the customer wrote last and nobody has answered, so their newest line carries the words. */
  waiting?: boolean
}

export function buildJobActivityBoxFeed(items: JobThreadActivityItem[], options: BuildJobActivityBoxFeedOptions = {}): JobActivityBoxEntry[] {
  const { lines = [], waiting = false } = options
  const entries = [...items.map(entryFromItem), ...lines.map(entryFromLine)]
    .filter((e): e is Omit<JobActivityBoxEntry, 'number'> => e !== null)
    .map((e, inputIndex) => ({ e, inputIndex, t: Date.parse(e.atIso) }))
    .sort((a, b) => (a.t === b.t || Number.isNaN(a.t) || Number.isNaN(b.t) ? a.inputIndex - b.inputIndex : a.t - b.t))
  let next = 0
  const feed = entries.map(({ e }) => ({ ...e, number: e.kind === 'sent' || e.kind === 'line' ? null : ++next }))
  if (waiting) {
    for (let i = feed.length - 1; i >= 0; i--) {
      const l = feed[i]?.line
      if (l && l.fromThem && l.customer) {
        feed[i] = { ...feed[i]!, line: { ...l, waiting: true } }
        break
      }
    }
  }
  return feed
}

// ---------- the teaser before the load, and the phone card's one line (v2.6689) ----------

/** What the box shows before its load, and the phone card's one line: the newest of the note, the report and the line. */
export interface JobActivityBoxTeaser {
  kind: 'note' | 'report' | 'line'
  atIso: string
  authorName: string | null
  body: string
  /** Set on a line: how it reads. */
  line?: JobActivityBoxLine
}

type TeaserStats = Pick<JobThreadNoteStats, 'last_note_at' | 'last_note_body' | 'last_note_author_name' | 'last_report_at' | 'last_report_author_name' | 'last_report_template_name' | 'last_report_preview'>

const wireMs = (iso: string | null | undefined): number | null => {
  if (iso == null || !String(iso).trim()) return null
  const t = Date.parse(String(iso))
  return Number.isNaN(t) ? null : t
}

/**
 * The newest of the three kinds, from the board-wide stats (the newest note and report) and the board's lines on the
 * job. Null when the job has none of them. A line wins a tie with a note or a report, since it is the one the office
 * has not read here before.
 */
export function activityBoxTeaser(stat: TeaserStats | null | undefined, lines: readonly JobActivityMessage[] | null | undefined, waiting = false): JobActivityBoxTeaser | null {
  const tNote = wireMs(stat?.last_note_at)
  const tRep = wireMs(stat?.last_report_at)
  let newestLine: JobActivityMessage | null = null
  for (const m of lines ?? []) {
    if (!lineTagOf(m.channel) || (m.direction !== 'in' && m.direction !== 'out')) continue
    if (!newestLine || Date.parse(m.at) >= Date.parse(newestLine.at)) newestLine = m
  }
  const tLine = newestLine ? wireMs(newestLine.at) : null
  if (tNote == null && tRep == null && tLine == null) return null
  const best = Math.max(tNote ?? -Infinity, tRep ?? -Infinity, tLine ?? -Infinity)
  if (newestLine && tLine === best) {
    const e = entryFromLine(newestLine)
    if (e?.line) return { kind: 'line', atIso: e.atIso, authorName: e.authorName, body: e.body, line: { ...e.line, waiting: waiting && e.line.fromThem && e.line.customer } }
  }
  if (tRep != null && tRep === best && stat) {
    return {
      kind: 'report',
      atIso: stat.last_report_at as string,
      authorName: (stat.last_report_author_name ?? '').trim() || null,
      body: (stat.last_report_preview ?? '').trim() || `Report: ${(stat.last_report_template_name ?? '').trim() || 'Report'}`,
    }
  }
  if (!stat) return null
  return {
    kind: 'note',
    atIso: stat.last_note_at as string,
    authorName: (stat.last_note_author_name ?? '').trim() || null,
    body: stripRedundantStampBody((stat.last_note_body ?? '').trim()),
  }
}

/** The dot's words on their newest line, as the mock-up draws them. */
export const NOBODY_HAS_ANSWERED = 'Nobody has answered.'

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

