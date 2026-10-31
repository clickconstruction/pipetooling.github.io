/**
 * The Questions look's tables and words (v2.6214). Harlow Ranch's made-up questions; nothing is real.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { MemberRequest } from './overview'
import { answeredFoldLabel, NO_QUESTIONS_WORDS, QUESTION_LANES, questionAnswer, questionTableMeta, questionTables } from './questionsLook'

function req(p: Partial<MemberRequest> & { id: string; created_at: string; lane: MemberRequest['lane'] }): MemberRequest {
  return { title: 'q', status: 'open', priority: null, closed_at: null, closed_note: null, from_user_id: 'u-robert', bid_id: null, job_ledger_id: null, development_id: 'd1', reference_summary: null, notes: [], ...p }
}

const ROWS: MemberRequest[] = [
  req({ id: 'e-old', lane: 'estimators', created_at: '2026-10-20T15:00:00Z', title: 'Which set did we price from?' }),
  req({ id: 'e-new', lane: 'estimators', created_at: '2026-10-26T15:00:00Z', title: 'Did the Oct 20 set change the gas count?' }),
  req({ id: 'e-done', lane: 'estimators', created_at: '2026-10-18T15:00:00Z', status: 'closed', closed_at: '2026-10-19T15:00:00Z', closed_note: 'The Sep 3 set.', notes: [{ id: 'n1', author_user_id: 'u-wendi', body: 'Checked sheet P-3.', created_at: '2026-10-19T14:00:00Z' }] }),
  req({ id: 'd-done', lane: 'dispatch', created_at: '2026-10-22T15:00:00Z', status: 'closed', closed_at: '2026-10-23T15:00:00Z', notes: [{ id: 'n2', author_user_id: 'u-mel', body: 'Booked for Thursday.', created_at: '2026-10-23T09:00:00Z' }, { id: 'n3', author_user_id: 'u-mel', body: 'Moved to Friday.', created_at: '2026-10-23T12:00:00Z' }] }),
]

describe('questionTables', () => {
  it('one table per lane with questions, open oldest first, answered after, lanes in order', () => {
    const t = questionTables(ROWS)
    expect(t.map((x) => [x.lane, x.label])).toEqual([['estimators', 'To the estimators'], ['dispatch', 'To Dispatch']])
    expect(t[0]!.open.map((r) => r.id)).toEqual(['e-old', 'e-new'])
    expect(t[0]!.answered.map((r) => r.id)).toEqual(['e-done'])
    expect(t[1]!.open).toEqual([])
    expect(t[1]!.answered.map((r) => r.id)).toEqual(['d-done'])
  })
  it('leaves out a lane with nothing, and gives no table with no question', () => {
    expect(questionTables(ROWS.filter((r) => r.lane === 'estimators')).map((x) => x.lane)).toEqual(['estimators'])
    expect(questionTables([])).toEqual([])
  })
})

describe('questionAnswer and the words', () => {
  it('the close note wins, else the newest reply with its author, else null', () => {
    expect(questionAnswer(ROWS[2]!)).toEqual({ body: 'The Sep 3 set.', by: null })
    expect(questionAnswer(ROWS[3]!)).toEqual({ body: 'Moved to Friday.', by: 'u-mel' })
    expect(questionAnswer(ROWS[0]!)).toBeNull()
  })
  it('the head counts and the fold label', () => {
    const t = questionTables(ROWS)
    expect(questionTableMeta(t[0]!)).toBe('2 open · 1 answered')
    expect(questionTableMeta(t[1]!)).toBe('1 answered')
    expect(answeredFoldLabel(3, false)).toBe('Show the 3 answered')
    expect(answeredFoldLabel(3, true)).toBe('Hide the 3 answered')
  })
  it('every word a first-timer reads keeps to plain words', () => {
    for (const w of [NO_QUESTIONS_WORDS, ...QUESTION_LANES.flatMap((l) => [l.hint, l.ask, l.label])]) expect(plainWordsFailures(w)).toEqual([])
  })
})
