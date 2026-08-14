import type { JobThreadActivityItem } from '../../components/JobThreadNotesPanel'
import { activityItemMatchesFilter, type ActivityFilter } from '../jobActivityFilter'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

/**
 * Feed shaping for the Pipeline row "Job activity" box (wide desktop only):
 * the conversational trail — thread NOTES (incl. % auto-notes and arrived/
 * leaving stamps) and REPORTS — numbered chronologically with 1 = OLDEST so a
 * note's number never shifts as new ones arrive ("check note 3" stays note 3).
 * Schedule/clock/event synthetic items are excluded: they're timeline texture,
 * not conversation, and the full thread panel already carries them.
 */

export type JobActivityBoxEntry = {
  /** Stable conversational number — 1 is the oldest note/report on the job. */
  number: number
  kind: 'note' | 'report'
  atIso: string
  authorName: string | null
  body: string
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
  return null
}

/**
 * Numbered feed, NEWEST FIRST (the box renders top-down from the latest).
 * Items are re-sorted by time here so numbering never depends on the caller's
 * ordering; ties keep input order.
 */
export function buildJobActivityBoxFeed(items: JobThreadActivityItem[]): JobActivityBoxEntry[] {
  const entries = items
    .map(entryFromItem)
    .filter((e): e is Omit<JobActivityBoxEntry, 'number'> => e !== null)
    .map((e, inputIndex) => ({ e, inputIndex, t: Date.parse(e.atIso) }))
    .sort((a, b) => (a.t === b.t || Number.isNaN(a.t) || Number.isNaN(b.t) ? a.inputIndex - b.inputIndex : a.t - b.t))
  return entries.map(({ e }, i) => ({ ...e, number: i + 1 })).reverse()
}

/**
 * The full-page activity modal shows the WHOLE timeline, not just the box's
 * conversation subset: notes/reports keep their stable box numbers ("check
 * note 3" still means note 3), while schedule/clock/event items interleave
 * chronologically as unnumbered texture rows.
 */
export type JobActivityModalItem =
  | { kind: 'entry'; entry: JobActivityBoxEntry; item: JobThreadActivityItem }
  | { kind: 'timeline'; item: JobThreadActivityItem; atIso: string }

export type JobActivityModalDayGroup = {
  /** Chicago calendar day (YYYY-MM-DD); '' for entries with an unparseable timestamp. */
  dayKey: string
  /** e.g. "Wed, Aug 12"; '—' for the unparseable group. */
  label: string
  isToday: boolean
  /** Oldest → newest within the day. */
  items: JobActivityModalItem[]
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

function chicagoDayKey(iso: string): string {
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

function chicagoDayLabel(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  const get = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, ...opts }).format(new Date(t))
  return `${get({ weekday: 'short' })}, ${get({ month: 'short' })} ${get({ day: 'numeric' })}`
}

/**
 * Full modal timeline, oldest → newest: every activity item chronologically,
 * with notes/reports numbered by the SAME comparator {@link buildJobActivityBoxFeed}
 * uses (time asc, input order on ties) so modal numbers always match the box.
 */
export function buildJobActivityModalItems(items: JobThreadActivityItem[]): JobActivityModalItem[] {
  const decorated = items
    .map((item, inputIndex) => ({ item, inputIndex, atIso: jobActivityItemTimeIso(item), t: Date.parse(jobActivityItemTimeIso(item)) }))
    .sort((a, b) => (a.t === b.t || Number.isNaN(a.t) || Number.isNaN(b.t) ? a.inputIndex - b.inputIndex : a.t - b.t))
  let number = 0
  return decorated.map(({ item, atIso }) => {
    const conversational = entryFromItem(item)
    if (conversational) {
      number += 1
      return { kind: 'entry' as const, entry: { ...conversational, number }, item }
    }
    return { kind: 'timeline' as const, item, atIso }
  })
}

/** Filter the modal timeline with the panel's All/Notes/Reports/Status/Billing/Crew buckets. Numbers stay stable — they were assigned pre-filter. */
export function filterJobActivityModalItems(
  items: JobActivityModalItem[],
  filter: ActivityFilter,
): JobActivityModalItem[] {
  if (filter === 'all') return items
  return items.filter((i) => activityItemMatchesFilter(i.item, filter))
}

/**
 * Group the (already chronological) modal timeline by Chicago calendar day —
 * the modal reads top-down like a transcript with day separators.
 */
export function groupJobActivityModalItemsByDay(
  items: JobActivityModalItem[],
  now: Date = new Date(),
): JobActivityModalDayGroup[] {
  const todayKey = chicagoDayKey(now.toISOString())
  const groups: JobActivityModalDayGroup[] = []
  for (const modalItem of items) {
    const atIso = modalItem.kind === 'entry' ? modalItem.entry.atIso : modalItem.atIso
    const dayKey = chicagoDayKey(atIso)
    const last = groups[groups.length - 1]
    if (last && last.dayKey === dayKey) {
      last.items.push(modalItem)
    } else {
      groups.push({
        dayKey,
        label: chicagoDayLabel(atIso),
        isToday: dayKey !== '' && dayKey === todayKey,
        items: [modalItem],
      })
    }
  }
  return groups
}
