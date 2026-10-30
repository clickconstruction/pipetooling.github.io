/**
 * The record of a signed hours statement (punch list #212, PR 2): the id a paper carries and the words for where it
 * stands. No imports, as `hoursStatement.ts` beside it, so the app's window (`src/lib/people/hoursStatementRecord.ts`
 * re-exports it) and the dev MCP's verb (PR 5) mint one id the same way.
 *
 * The id is `HS-<job number>-<n>`, `n` counted per job from 1 and printed with four digits (`HS-1042-0007`), so a paper
 * names its job at a glance and two statements on one job never share a number. The table's unique key refuses a
 * duplicate; the writer then reads the job's ids again and takes the next number.
 */

export type HoursStatementState = 'draft' | 'printed' | 'sent' | 'signed'

export const HOURS_STATEMENT_STATES: readonly HoursStatementState[] = ['draft', 'printed', 'sent', 'signed']

export function isHoursStatementState(v: unknown): v is HoursStatementState {
  return typeof v === 'string' && (HOURS_STATEMENT_STATES as readonly string[]).includes(v)
}

/** `HS-1042-0007`: the job's number with its spaces taken out, then `n` on four digits (more once it needs them). */
export function hoursStatementRecordId(jobNumber: string, n: number): string {
  const job = (jobNumber ?? '').trim().replace(/\s+/g, '') || 'JOB'
  const num = Math.max(1, Math.floor(Number.isFinite(n) ? n : 1))
  return `HS-${job}-${num < 10000 ? String(num).padStart(4, '0') : String(num)}`
}

/** The job number and the count out of an id, or null for anything that is not one. */
export function parseHoursStatementRecordId(id: string): { jobNumber: string; n: number } | null {
  const m = /^HS-(.+)-(\d{4,})$/.exec((id ?? '').trim())
  if (!m) return null
  return { jobNumber: m[1] as string, n: Number(m[2]) }
}

/**
 * The next id for the job: one past the highest `n` among the ids given, whatever job number they name (a job's number
 * can change after its first statement; the count is the job's, not the number's).
 */
export function nextHoursStatementRecordId(jobNumber: string, existing: readonly string[]): string {
  let max = 0
  for (const id of existing) {
    const p = parseHoursStatementRecordId(id)
    if (p && p.n > max) max = p.n
  }
  return hoursStatementRecordId(jobNumber, max + 1)
}

export type HoursStatementStateTone = 'grey' | 'blue' | 'amber' | 'green'

/** The chip and the sentence for where a statement stands. */
export function hoursStatementStateWords(state: HoursStatementState): { label: string; tone: HoursStatementStateTone; words: string } {
  switch (state) {
    case 'printed':
      return { label: 'Printed', tone: 'blue', words: 'Printed, to be signed with a pen.' }
    case 'sent':
      return { label: 'Waiting for a signature', tone: 'amber', words: 'Sent for a signature. Not signed yet.' }
    case 'signed':
      return { label: 'Signed', tone: 'green', words: 'Signed. The copy is filed.' }
    default:
      return { label: 'Draft', tone: 'grey', words: 'Saved. Not printed or sent yet.' }
  }
}

/** Where a statement stands after Print: a draft becomes printed; a sent or signed one keeps its state. */
export function hoursStatementStateAfterPrint(state: HoursStatementState): HoursStatementState {
  return state === 'draft' ? 'printed' : state
}

/** A draft or a printed statement is still the office's to change; a sent or signed one is a record. */
export function hoursStatementIsOpen(state: HoursStatementState): boolean {
  return state === 'draft' || state === 'printed'
}
