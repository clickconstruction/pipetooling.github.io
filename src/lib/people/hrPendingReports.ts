import { ageDays, compareOldestFirst } from '../ageState'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { humanRoleLabel } from '../roleLabels'
import { dayWords, firstName, timeWords, writeUpKindLabel } from './writeUp'

/**
 * Pending-report display helpers (v2.2235). Pure so the wording of "when this
 * happened vs. when it was written" is pinned by tests — the distinction is
 * the whole point of the queue: the HR entry is dated when it HAPPENED.
 */

export type HrReportWhen = { occurred_date: string; created_at: string; author_name: string }

function shortDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[Number(m[2]) - 1]} ${Number(m[3])}`
}

/** "happened Aug 24 · written by Malachi, Aug 24" (author/written omitted when unknown). */
export function formatHrReportWhen(r: HrReportWhen): string {
  const happened = `happened ${shortDate(r.occurred_date)}`
  const writtenDay = shortDate(calendarYmdInAppTzFromIso(r.created_at))
  const who = r.author_name.trim()
  if (who === '') return `${happened} · written ${writtenDay}`
  return `${happened} · written by ${who}, ${writtenDay}`
}

// ─── Ordering + aging (journey-map Tier-2 #40 / C60, J32-F7) ───────────────
// The queue used to render newest-first, so the report that had waited 11 days
// sat under this morning's. Oldest-first, plus a min-age summary for the
// Needs-You card in the `HOURS_APPROVALS_MIN_AGE_DAYS` shape.


export function sortPendingReportsOldestFirst<T extends { created_at: string }>(rows: ReadonlyArray<T>): T[] {
  return [...rows].sort((a, b) => compareOldestFirst(a.created_at, b.created_at))
}

export type PendingReportAgingSummary = {
  /** Pending reports at least `minAgeDays` old. */
  count: number
  /** Every pending report. */
  total: number
  /** Whole days since the oldest pending report was written. */
  oldestAgeDays: number
}

/** Null when nothing pending has reached `minAgeDays` — a same-day queue stays quiet. */
export function summarizePendingReportAging(
  rows: ReadonlyArray<{ created_at: string | null }>,
  minAgeDays: number,
  now: Date | number = Date.now(),
): PendingReportAgingSummary | null {
  let count = 0
  let oldest = 0
  for (const r of rows) {
    const d = ageDays(r.created_at, now)
    if (d == null) continue
    if (d > oldest) oldest = d
    if (d >= minAgeDays) count++
  }
  if (count === 0) return null
  return { count, total: rows.length, oldestAgeDays: oldest }
}

// ─── A write-up's facts on the card (punch list #410) ──────────────────────
// A report sent from the Dashboard's Write someone up sheet carries the job, the time, the kind, who saw it and
// whether the person was told. The card draws them one fact a line, and filing writes them into the entry, so the
// Timeline's line says what the record stood on. A report from before the sheet has none of them and reads as before.

export type PendingReportSeen = { person_id?: string | null; name?: string | null }

export interface PendingReportFacts {
  occurred_date: string
  created_at: string
  author_name: string
  content: string
  kind?: string | null
  job_label?: string | null
  occurred_time?: string | null
  author_role?: string | null
  author_saw_it?: boolean | null
  author_on_job?: boolean | null
  seen_by?: ReadonlyArray<PendingReportSeen> | null
  talked_to_person?: boolean | null
  adds_to?: string | null
  pressed_at?: string | null
}

/** True for a report the phone sheet sent: it has a kind. */
export function isFieldWriteUp(r: Pick<PendingReportFacts, 'kind'>): boolean {
  return typeof r.kind === 'string' && r.kind !== ''
}

/** "Fri, Nov 20 · 12:20 pm", or the day alone when no time was given. */
export function reportWhenWords(r: Pick<PendingReportFacts, 'occurred_date' | 'occurred_time'>): string {
  const time = timeWords(r.occurred_time)
  return time ? `${dayWords(r.occurred_date)} · ${time}` : dayWords(r.occurred_date)
}

/** "the same day", "the next day" or "3 days after": how long after it happened the report was written. */
export function writtenAfterWords(r: Pick<PendingReportFacts, 'occurred_date' | 'created_at' | 'pressed_at'>): string {
  const writtenDay = calendarYmdInAppTzFromIso(r.pressed_at || r.created_at)
  const a = Date.parse(`${r.occurred_date}T12:00:00Z`)
  const b = Date.parse(`${writtenDay}T12:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return ''
  const days = Math.round((b - a) / 86_400_000)
  if (days <= 0) return 'the same day'
  if (days === 1) return 'the next day'
  return `${days} days after`
}

const seenNames = (r: Pick<PendingReportFacts, 'seen_by'>): string[] =>
  (r.seen_by ?? []).map((s) => (typeof s?.name === 'string' ? s.name.trim() : '')).filter((n) => n !== '')

/** Who saw it, the writer first: "Marcus Hale, Luis Ortega", or that the writer was told. */
export function reportSeenWords(r: Pick<PendingReportFacts, 'author_saw_it' | 'seen_by' | 'author_name'>): string {
  const writer = r.author_name.trim() || 'The writer'
  const names = seenNames(r)
  if (r.author_saw_it === false) return names.length > 0 ? `${names.join(', ')}. ${writer} was told about it.` : `Nobody named. ${writer} was told about it.`
  return [writer, ...names].join(', ')
}

export interface ReportFactLine {
  label: string
  value: string
}

/** The facts of a write-up, one a line. Empty for a report from before the sheet. */
export function pendingReportFactLines(r: PendingReportFacts, subjectName: string): ReportFactLine[] {
  if (!isFieldWriteUp(r)) return []
  const lines: ReportFactLine[] = [{ label: 'When', value: reportWhenWords(r) }]
  if (r.job_label) lines.push({ label: 'Job', value: r.job_label })
  const role = r.author_role ? humanRoleLabel(r.author_role).toLowerCase() : ''
  const who = [r.author_name.trim() || 'Unknown writer', role].filter(Boolean).join(', ')
  const after = writtenAfterWords(r)
  lines.push({ label: 'Written by', value: after ? `${who} · ${after}` : who })
  if (r.job_label && r.author_on_job != null) lines.push({ label: 'From', value: r.author_on_job ? 'On the clock at that job that day' : 'Not on the clock at that job that day' })
  lines.push({ label: 'Seen by', value: reportSeenWords(r) })
  if (r.talked_to_person != null) lines.push({ label: `Talked to ${firstName(subjectName) || 'the person'}`, value: r.talked_to_person ? 'Yes' : 'Not yet' })
  if (r.adds_to) lines.push({ label: 'Adds to', value: 'An earlier write-up by the same writer' })
  return lines
}

/**
 * The words a write-up is filed with (`file_person_report`'s `p_content`): the facts in one paragraph, then the
 * writer's words as written. Null for a report from before the sheet, so the function writes its own preamble.
 */
export function reportEntryBody(r: PendingReportFacts, subjectName: string): string | null {
  if (!isFieldWriteUp(r)) return null
  const facts = pendingReportFactLines(r, subjectName)
    .filter((l) => l.label !== 'Adds to')
    .map((l) => `${l.label}: ${l.value.replace(/\.$/, '')}.`)
  const head = `Field write-up, ${writeUpKindLabel(r.kind).toLowerCase()}${r.adds_to ? ', added to an earlier one' : ''}.`
  return `${head} ${facts.join(' ')}\n\n${r.content.trim()}`
}

/** How many reports this writer has sent this year, and how many others stand about this person. */
export function reportCountsLine(
  r: { id: string; author_user_id: string | null; subject_person_id: string; author_name: string },
  all: ReadonlyArray<{ id: string; author_user_id: string | null; subject_person_id: string; status: string }>,
  subjectName: string,
): string {
  const stands = (x: { status: string }) => x.status !== 'dismissed'
  const byWriter = r.author_user_id ? all.filter((x) => x.author_user_id === r.author_user_id && stands(x)).length : 0
  const aboutOthers = all.filter((x) => x.subject_person_id === r.subject_person_id && x.id !== r.id && stands(x)).length
  const writer = r.author_name.trim() || 'The writer'
  const parts: string[] = []
  if (byWriter > 0) parts.push(`${writer} has written ${byWriter} this year.`)
  parts.push(aboutOthers === 0 ? `No other report about ${subjectName} this year.` : `${subjectName} has ${aboutOthers} other${aboutOthers === 1 ? '' : 's'} this year.`)
  return parts.join(' ')
}
