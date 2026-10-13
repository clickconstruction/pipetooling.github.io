/**
 * A sub's lines on their sheet (residential R8 · 12, PR 3; `customer-messages-integrations-mockups.html` card 12 on
 * `spike/gc-mode`): the sub's thread, read where the sheet is read. A sheet's job is its Pipeline job
 * (`people_labor_jobs.job_ledger_id`), and a line is on the sheet when one of the sub's contacts wrote it, or we wrote
 * it to them, tied to that job. Two sheets on one job (a rough-in and a top-out) show the same lines. A sheet with no
 * job has none. Pure: the screen hands in the lines it loaded.
 *
 * It returns parts, never a sentence: the card's strip ("On the sub sheet · 1312 · Manny Reyes · last word: …") joins
 * them with a dot, which the plain-words rules keep out of a sentence, so the screen lays the parts out.
 */
import { jobKey } from './load'
import { lastIn, lineWhen, snippetOf, threadOf, type ThreadMessage } from './thread'

/** What the sheet gives: its job. */
export type SheetForLines = { job_ledger_id: string | null }

/** The sub's newest word to us on the sheet's job. */
export type SheetLastWord = {
  /** The line, for the thread window's `at`. */
  id: string
  contactId: string
  /** What a row shows of it: a text's words, an email's subject. */
  snippet: string
  /** "today · 3:12 PM", or "Thu, Oct 1 · 3:12 PM". */
  when: string
  at: string
}

export type SheetLines = {
  /** The job key the lines are tied to ("pipeline:<id>"), or null for a sheet with no job. */
  jobId: string | null
  /** The sub's lines on it, every contact of theirs, oldest first. */
  lines: ThreadMessage[]
  /** Their newest call, text, email or portal line to us on it; null when they have said nothing on it. */
  lastWord: SheetLastWord | null
}

/** The sub's lines on one sheet, and their last word on it. */
export function subLinesOnSheet(
  sheet: SheetForLines,
  messages: readonly ThreadMessage[],
  subContactIds: readonly string[],
  nowIso: string,
): SheetLines {
  if (!sheet.job_ledger_id) return { jobId: null, lines: [], lastWord: null }
  const jobId = jobKey({ kind: 'pipeline', id: sheet.job_ledger_id })
  const theirs = [...new Set(subContactIds)].flatMap((contactId) => threadOf(messages, contactId, jobId))
  const lines = theirs.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id))
  const last = subContactIds
    .map((contactId) => lastIn(lines, contactId))
    .filter((m): m is ThreadMessage => !!m)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0]
  return {
    jobId,
    lines,
    lastWord: last ? { id: last.id, contactId: last.contactId, snippet: snippetOf(last), when: lineWhen(last.at, nowIso), at: last.at } : null,
  }
}
