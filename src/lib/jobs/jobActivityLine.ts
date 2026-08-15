import type { JobThreadActivityItem } from '../../components/JobThreadNotesPanel'
import type { UserRole } from '../../hooks/useAuth'
import { activityItemMatchesFilter, type ActivityFilter } from '../jobActivityFilter'
import { eventRenderMeta, type JobActivityEventType } from '../jobActivityEvent'
import { allReportFieldLinesForThread } from '../reportForViewFromJobLedgerRow'
import { displayReportTemplateName } from '../reportTemplateDisplayName'
import { formatDecimalWorkHoursToHhMm } from '../formatDecimalWorkHoursHhMm'
import { formatStagesCompactWindow, formatStagesNextDateLabel } from '../stagesUpcomingSchedule'
import {
  formatDispatchNoteDaysAgoShortPhrase,
  formatDispatchNoteTimeChicago,
} from '../../utils/dispatchNoteDisplay'
import {
  chicagoActivityDayKey,
  chicagoActivityDayLabel,
  jobActivityItemTimeIso,
  stripRedundantStampBody,
} from './jobActivityBoxFeed'

/**
 * One compact line per activity item — the shape the unified Job activity view
 * renders (v2.1673). Every kind collapses to a SINGLE scannable line whose
 * columns line up down the page (number · time · kind · person · body); the
 * long tail of a report's answers or a clock/schedule note moves to `detail`,
 * revealed only when the reader opens that line.
 *
 * Numbering matches {@link buildJobActivityBoxFeed}: 1 = the oldest note or
 * report, assigned before any filtering, so "check note 3" means note 3 in the
 * row preview box, the floating modal and the full-screen panel alike.
 * Schedule / clock / event rows are timeline texture and stay unnumbered —
 * pass `numberEveryLine` to number them too (they then no longer agree with the
 * preview box, which never shows those kinds).
 *
 * Times carry the clock only ("9:45a"); the day header supplies the date and
 * how long ago it was, so the same words never repeat on thirteen rows.
 */

export type JobActivityDetailLine = { label?: string; value: string }

export type JobActivityLine = {
  /** Stable React key. */
  key: string
  /** Conversational number; null when this kind isn't numbered. */
  number: number | null
  kind: JobThreadActivityItem['kind']
  /** Event discriminator — lets the renderer pick the tag color. */
  eventType: JobActivityEventType | null
  /** Column tag, e.g. "Report" / "Status" / "Clock"; '' for plain notes. */
  kindLabel: string
  atIso: string
  /** Clock time only, e.g. "9:45a" / "2:47p". */
  timeLabel: string
  /** Person column; '' when the row has no actor (schedule blocks). */
  who: string
  /** The one-line summary. */
  body: string
  /** Clock sessions still awaiting approval. */
  pending: boolean
  /** Revealed when the line is opened; empty when there's nothing more. */
  detail: JobActivityDetailLine[]
  /** The source item, so filtering can reuse the panel's buckets. */
  item: JobThreadActivityItem
}

/**
 * "9:45 AM" → "9:45a". Newer ICU builds separate the meridiem with a narrow
 * no-break space rather than a plain one, so match any whitespace.
 */
export function compactChicagoClockTime(isoUtc: string): string {
  const full = formatDispatchNoteTimeChicago(isoUtc)
  return full.replace(/[\s  ]*AM$/i, 'a').replace(/[\s  ]*PM$/i, 'p')
}

function detailFromNote(note: string): JobActivityDetailLine[] {
  const trimmed = note.trim()
  return trimmed ? [{ value: trimmed }] : []
}

function lineFromItem(
  item: JobThreadActivityItem,
  viewerRole: UserRole | null | undefined,
): Omit<JobActivityLine, 'number'> {
  const atIso = jobActivityItemTimeIso(item)
  const base = {
    atIso,
    // Guard the parse — Intl throws a RangeError on an invalid Date, and one
    // malformed timestamp must not take down the whole feed.
    timeLabel: Number.isNaN(Date.parse(atIso)) ? '—' : compactChicagoClockTime(atIso),
    pending: false,
    item,
  }

  if (item.kind === 'note') {
    const n = item.note
    return {
      ...base,
      key: `n-${n.id}`,
      kind: 'note',
      eventType: null,
      kindLabel: '',
      who: n.author?.name?.trim() || 'Unknown',
      body: stripRedundantStampBody((n.body ?? '').trim()),
      detail: [],
    }
  }

  if (item.kind === 'report') {
    const r = item.report
    // The template name is the line; every answer folds into the detail, which
    // is the whole point — one report used to fill the modal on its own.
    return {
      ...base,
      key: `r-${r.id}`,
      kind: 'report',
      eventType: null,
      kindLabel: 'Report',
      who: (r.created_by_name ?? '').trim() || 'Unknown',
      body: displayReportTemplateName(r.template_name, viewerRole),
      detail: allReportFieldLinesForThread(r).map((l) => ({
        ...(l.label ? { label: l.label } : {}),
        value: l.value,
      })),
    }
  }

  if (item.kind === 'schedule_block') {
    const s = item.schedule
    const when = `${formatStagesNextDateLabel(s.work_date)} ${formatStagesCompactWindow(s.time_start, s.time_end)}`
    return {
      ...base,
      key: s.dedupeKey,
      kind: 'schedule_block',
      eventType: null,
      kindLabel: 'Sched',
      // Schedule rows record no actor — the assignees are the useful names, and
      // they belong in the body where there's room for several.
      who: '',
      body: s.assigneeLabels ? `${when} · ${s.assigneeLabels}` : when,
      detail: detailFromNote(s.note ?? ''),
    }
  }

  if (item.kind === 'clock_session') {
    const c = item.clock
    const inLabel = c.clockedInAt ? compactChicagoClockTime(c.clockedInAt) : '—'
    const outLabel = c.clockedOutAt ? compactChicagoClockTime(c.clockedOutAt) : null
    const durLabel = c.durationHours != null ? formatDecimalWorkHoursToHhMm(c.durationHours) : null
    return {
      ...base,
      key: c.dedupeKey,
      kind: 'clock_session',
      eventType: null,
      kindLabel: 'Clock',
      who: c.personName,
      body: outLabel
        ? `${inLabel} → ${outLabel}${durLabel ? ` · ${durLabel}` : ''}`
        : `${inLabel} → still on the clock`,
      pending: c.status === 'pending',
      detail: detailFromNote(c.note ?? ''),
    }
  }

  const ev = item.event
  return {
    ...base,
    key: ev.dedupeKey,
    kind: 'event',
    eventType: ev.type,
    kindLabel: eventRenderMeta(ev.type).tag,
    who: ev.actorName?.trim() || 'System',
    body: ev.summary,
    detail: [],
  }
}

/** Notes and reports are the conversation; everything else is texture. */
function isConversational(item: JobThreadActivityItem): boolean {
  return item.kind === 'note' || item.kind === 'report'
}

export type BuildJobActivityLinesOptions = {
  viewerRole?: UserRole | null
  /** Number every kind, not just notes and reports. Breaks parity with the row preview box. */
  numberEveryLine?: boolean
}

/**
 * Chronological lines, oldest → newest, numbered before any filter is applied
 * (time ascending, input order on ties — the same comparator the preview box
 * uses, so the numbers always agree).
 */
export function buildJobActivityLines(
  items: JobThreadActivityItem[],
  options: BuildJobActivityLinesOptions = {},
): JobActivityLine[] {
  const { viewerRole, numberEveryLine = false } = options
  const ordered = items
    .map((item, inputIndex) => ({ item, inputIndex, t: Date.parse(jobActivityItemTimeIso(item)) }))
    .sort((a, b) =>
      a.t === b.t || Number.isNaN(a.t) || Number.isNaN(b.t) ? a.inputIndex - b.inputIndex : a.t - b.t,
    )

  let number = 0
  return ordered.map(({ item }) => {
    const line = lineFromItem(item, viewerRole)
    if (numberEveryLine || isConversational(item)) {
      number += 1
      return { ...line, number }
    }
    return { ...line, number: null }
  })
}

/** Narrow to one of the panel's buckets. Numbers were assigned pre-filter, so they don't move. */
export function filterJobActivityLines(
  lines: JobActivityLine[],
  filter: ActivityFilter,
): JobActivityLine[] {
  if (filter === 'all') return lines
  return lines.filter((l) => activityItemMatchesFilter(l.item, filter))
}

export type JobActivityDayGroup = {
  /** Chicago calendar day (YYYY-MM-DD); '' when the timestamp won't parse. */
  dayKey: string
  /** e.g. "Wed, Aug 12"; '—' for the unparseable group. */
  label: string
  /** e.g. "3d ago" / "today"; '' when the timestamp won't parse. */
  agoLabel: string
  isToday: boolean
  lines: JobActivityLine[]
}

/**
 * Group the (already chronological) lines by Chicago calendar day. The header
 * carries the date AND the age, which is what lets each line drop to a bare
 * clock time.
 */
export function groupJobActivityLinesByDay(
  lines: JobActivityLine[],
  now: Date = new Date(),
): JobActivityDayGroup[] {
  const todayKey = chicagoActivityDayKey(now.toISOString())
  const groups: JobActivityDayGroup[] = []
  for (const line of lines) {
    const dayKey = chicagoActivityDayKey(line.atIso)
    const last = groups[groups.length - 1]
    if (last && last.dayKey === dayKey) {
      last.lines.push(line)
      continue
    }
    groups.push({
      dayKey,
      label: chicagoActivityDayLabel(line.atIso),
      agoLabel: dayKey === '' ? '' : formatDispatchNoteDaysAgoShortPhrase(line.atIso, now),
      isToday: dayKey !== '' && dayKey === todayKey,
      lines: [line],
    })
  }
  return groups
}
