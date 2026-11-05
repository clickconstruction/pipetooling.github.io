/**
 * Import the days the app never recorded (punch list #265, PR 3, v2.6531): the dev-only door on the person's desk over
 * `import_clock_sessions` (v2.6425). The office pastes one day a line — the day, the hours, the note that names where the
 * day came from — and names the job by its number; every row becomes an imported clock session, unapproved, one a
 * person, a day and a job, so a rerun skips what is there. The pure part: the lines parsed with every refusal named,
 * the rows the function takes, and its answer read back.
 */

import { appTzWallTimeMs } from '../../utils/dateUtils'

export type ImportDayLine = { line: number; work_date: string; hours: number; note: string }
export type ImportDayProblem = { line: number; reason: string }

/** The hour a drafted day starts at in the company's zone; the day's hours run from it. */
export const IMPORTED_DAY_START_HOUR = 8
export const IMPORTED_DAY_MAX_HOURS = 16

const YMD = /^\d{4}-\d{2}-\d{2}$/

/**
 * One day a line: `YYYY-MM-DD, hours, note` — a comma or a tab between the three, the note everything after the second.
 * A blank line is skipped. A line that will not read is named with its reason and the rest still go.
 */
export function parseImportDayLines(text: string): { rows: ImportDayLine[]; problems: ImportDayProblem[] } {
  const rows: ImportDayLine[] = []
  const problems: ImportDayProblem[] = []
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1
    const s = raw.trim()
    if (!s) return
    const parts = s.split(/\t|,/).map((p) => p.trim())
    const [day, hoursText, ...rest] = parts
    const note = rest.join(', ').trim()
    if (!day || !YMD.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) {
      problems.push({ line, reason: 'the day must read YYYY-MM-DD' })
      return
    }
    const hours = Number(hoursText)
    if (!hoursText || !Number.isFinite(hours) || hours <= 0 || hours > IMPORTED_DAY_MAX_HOURS) {
      problems.push({ line, reason: `the hours must be a number over 0 and at most ${IMPORTED_DAY_MAX_HOURS}` })
      return
    }
    if (!note) {
      problems.push({ line, reason: 'the note must name where the day came from' })
      return
    }
    rows.push({ line, work_date: day, hours, note })
  })
  return { rows, problems }
}

export type ImportClockRow = { user_id: string; job_ledger_id: string; work_date: string; clocked_in_at: string; clocked_out_at: string; notes: string }

/** The rows `import_clock_sessions` takes: in at the start hour in the company's zone, out the hours later. */
export function importClockRows(lines: readonly ImportDayLine[], args: { userId: string; jobId: string }): ImportClockRow[] {
  return lines.map((l) => {
    const inMs = appTzWallTimeMs(l.work_date, IMPORTED_DAY_START_HOUR, 0)
    const outMs = inMs + Math.round(l.hours * 3_600_000)
    return { user_id: args.userId, job_ledger_id: args.jobId, work_date: l.work_date, clocked_in_at: new Date(inMs).toISOString(), clocked_out_at: new Date(outMs).toISOString(), notes: l.note }
  })
}

export type ImportAnswer = { inserted: number; skipped: number; refused: Array<{ row: number; reason: string }> }

/** The function's answer, read back; a shape that will not read is an error with its words. */
export function readImportAnswer(data: unknown): ImportAnswer {
  const d = data as { inserted?: unknown; skipped?: unknown; refused?: unknown } | null
  if (!d || typeof d.inserted !== 'number' || typeof d.skipped !== 'number' || !Array.isArray(d.refused)) throw new Error('The import answered in a shape the desk cannot read.')
  const refused = (d.refused as Array<{ row?: unknown; reason?: unknown }>).map((r) => ({ row: typeof r.row === 'number' ? r.row : 0, reason: typeof r.reason === 'string' ? r.reason : 'refused' }))
  return { inserted: d.inserted, skipped: d.skipped, refused }
}

/** The job number as typed — `JP1064`, `J1064`, `#1064`, `1064` — to the digits `jobs_ledger.click_number` holds. */
export function jobNumberDigits(text: string): string | null {
  const digits = text.trim().replace(/^[a-z#]+/i, '').trim()
  return /^\d+$/.test(digits) ? digits : null
}

/** One line per outcome, in the order the desk draws them. */
export function importResultWords(answer: ImportAnswer, problems: readonly ImportDayProblem[], lines: readonly ImportDayLine[]): string[] {
  const out: string[] = []
  out.push(answer.inserted === 1 ? '1 day went in, waiting for approval.' : `${answer.inserted} days went in, waiting for approval.`)
  if (answer.skipped > 0) out.push(answer.skipped === 1 ? '1 day was already there and was skipped.' : `${answer.skipped} days were already there and were skipped.`)
  for (const r of answer.refused) {
    const l = lines[r.row - 1]
    out.push(`Line ${l ? l.line : r.row}: refused — ${r.reason}.`)
  }
  for (const p of problems) out.push(`Line ${p.line}: not sent — ${p.reason}.`)
  return out
}
