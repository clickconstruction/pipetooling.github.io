/**
 * Clock out in one press (punch list #189, PR 8; decision 7 of 2026-10-29: the clock-out note is filled from the
 * day's reports, editable). The review's note, *What did you work on?*, is the one thing the office reads when it
 * approves the hours, and until now the tech typed it at the end of the day after filing the same words on a
 * report. Now the reports the tech filed that day write it: one line a report, the job, the stage moves or the
 * percent, and what got done, in the order they were filed. With no report that day the note is empty and the
 * review asks as it always did. Pure.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { REPORT_FIELD_LABEL_JOB_COMPLETION, REPORT_FIELD_LABEL_LEGACY_WHO } from '../reportTemplateFieldDisplay'
import { REPORT_FIELD_LABEL_STAGE_PROGRESS } from '../reports/stageProgressReport'

/** A report the tech filed, as the review reads it. */
export type ClockOutReportInput = {
  /** "PLUM 512 · Whitfield water heater", or null for a report on nothing the review can name. */
  jobLabel: string | null
  templateName: string | null
  fieldValues: Record<string, unknown> | null
  createdAt: string
}

/** The line under the note once the reports wrote it. */
export const CLOCK_OUT_NOTE_FILLED_LINE = "Filled from today's reports. Edit it if you like."

/** The review's title (was *Review before clock out*). */
export const CLOCK_OUT_REVIEW_TITLE = 'Clock out'

/** The most of a report's words one line carries, cut on a word. */
const WORDS_MAX = 140

const STATUS_FIELD = 'What is the status of the job?'

function cutOnWord(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max + 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > 40 ? cut.slice(0, space) : t.slice(0, max)).replace(/[\s.,;:]+$/, '')}…`
}

function isSignature(v: string): boolean {
  return /^data:image\//i.test(v)
}

/** The report's kind in one word: "status", "walk", "note", "eod", "turnaway"; empty for none. */
function kindOf(templateName: string | null): string {
  return (templateName ?? '')
    .replace(/\s+report$/i, '')
    .trim()
    .toLowerCase()
}

/** The reports filed on the session's day, oldest first. */
export function clockOutDayReports<T extends { createdAt: string }>(reports: ReadonlyArray<T>, workDateYmd: string): T[] {
  return reports.filter((r) => calendarYmdInAppTzFromIso(r.createdAt) === workDateYmd).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** One report's line: the job, the stage moves or the percent, what got done. */
export function clockOutReportLine(report: ClockOutReportInput): string {
  const fv = report.fieldValues ?? {}
  const str = (k: string) => {
    const v = fv[k]
    return v == null ? '' : String(v).trim()
  }
  const label = report.jobLabel?.trim() || 'A job'
  const kind = kindOf(report.templateName)
  const head = kind && kind !== 'status' ? `${label} · ${kind}` : label
  const stages = str(REPORT_FIELD_LABEL_STAGE_PROGRESS)
  const pct = str(REPORT_FIELD_LABEL_JOB_COMPLETION)
  const progress = stages ? stages : /^\d{1,3}$/.test(pct) ? `${pct}% done` : ''
  let words = str(STATUS_FIELD)
  if (!words || isSignature(words)) {
    words = ''
    for (const [k, v] of Object.entries(fv)) {
      if (k === REPORT_FIELD_LABEL_JOB_COMPLETION || k === REPORT_FIELD_LABEL_LEGACY_WHO || k === REPORT_FIELD_LABEL_STAGE_PROGRESS || k === STATUS_FIELD) continue
      const s = v == null ? '' : String(v).trim()
      if (!s || isSignature(s) || /^\d{1,3}$/.test(s)) continue
      words = s
      break
    }
  }
  const parts = [progress, words ? cutOnWord(words, WORDS_MAX) : ''].filter(Boolean)
  return `${head}: ${parts.length ? parts.join('. ') : 'report filed'}`
}

/**
 * The note the review opens on: one line a report, in the order filed, a line said twice said once. Empty with no
 * report, so the review asks as it did.
 */
export function clockOutNoteFromReports(reports: ReadonlyArray<ClockOutReportInput>): string {
  const lines: string[] = []
  for (const r of [...reports].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const line = clockOutReportLine(r)
    if (!lines.includes(line)) lines.push(line)
  }
  return lines.join('\n')
}
