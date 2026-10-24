/**
 * A sub's record before the bench has one (v2.5808, punch list #153, PR 2): how a trade company on
 * Prospects → Subs answers our calls, in the bench's own words and at the bench's own thresholds
 * (`answerRecord`, `src/lib/gc/reliability.ts`: two asks the least judged on, answers at three in
 * four, hit or miss at two in five, often silent under that). The lane's call log stands in for
 * the bench's asks, and a text or an email back on the thread Messages ties to the prospect counts
 * as an answer, so a company that calls us back is never *new to us*. Computed on load, never
 * stored. Pure.
 */
import type { AnswerRecord } from '../gc/reliability'

export interface SubRecordIn {
  /** The lane's call rows: Didn't Answer and Answered, any prospect. */
  calls: readonly { prospect_id: string; interaction_type: string }[]
  /** Prospects with a text or an email back on their thread. */
  inbound?: ReadonlySet<string>
}

export interface SubRecord {
  calls: number
  answered: number
  record: AnswerRecord
}

/** The bench's words (`RECORD_WORDS` on Trade partners), so the board and the bench never disagree. */
export const SUB_RECORD_WORDS: Record<AnswerRecord, string> = {
  new: 'new to us',
  reliable: 'answers',
  mixed: 'hit or miss',
  silent: 'often silent',
}

/** Answers first, then hit or miss, then not judged yet, then often silent: the bench's `compareReliability` order. */
export const SUB_RECORD_ORDER: Record<AnswerRecord, number> = { reliable: 0, mixed: 1, new: 2, silent: 3 }

/** The bench's thresholds over calls instead of asks. */
export function recordFromCounts(calls: number, answered: number): AnswerRecord {
  if (calls < 2) return 'new'
  const rate = answered / calls
  return rate >= 0.75 ? 'reliable' : rate >= 0.4 ? 'mixed' : 'silent'
}

/** Every prospect's record in one pass. A prospect with no call and no line back is new to us. */
export function subRecords(inp: SubRecordIn): Map<string, SubRecord> {
  const counts = new Map<string, { calls: number; answered: number }>()
  const bump = (id: string, answered: boolean) => {
    const c = counts.get(id) ?? { calls: 0, answered: 0 }
    c.calls += 1
    if (answered) c.answered += 1
    counts.set(id, c)
  }
  for (const row of inp.calls) {
    if (row.interaction_type === 'answered') bump(row.prospect_id, true)
    else if (row.interaction_type === 'didnt_answer') bump(row.prospect_id, false)
  }
  for (const id of inp.inbound ?? []) bump(id, true)
  const out = new Map<string, SubRecord>()
  for (const [id, c] of counts) out.set(id, { calls: c.calls, answered: c.answered, record: recordFromCounts(c.calls, c.answered) })
  return out
}

export const NEW_RECORD: SubRecord = { calls: 0, answered: 0, record: 'new' }

export function subRecordOf(records: ReadonlyMap<string, SubRecord>, prospectId: string): SubRecord {
  return records.get(prospectId) ?? NEW_RECORD
}

/** The fact under the chip: "answered 1 of 2 calls", or "never called". */
export function recordFact(r: SubRecord): string {
  if (r.calls === 0) return 'never called'
  return `answered ${r.answered} of ${r.calls} ${r.calls === 1 ? 'call' : 'calls'}`
}

export type RecordTone = 'green' | 'amber' | 'red' | 'grey'

export function recordTone(record: AnswerRecord): RecordTone {
  return record === 'reliable' ? 'green' : record === 'mixed' ? 'amber' : record === 'silent' ? 'red' : 'grey'
}
