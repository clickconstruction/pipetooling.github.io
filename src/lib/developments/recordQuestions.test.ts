import { describe, expect, it } from 'vitest'
import type { MemberRequest } from './overview'
import { markAskedOn, RECORD_LANDS_WITH, RECORD_QUESTIONS_TITLE, recordAskAbout, recordAskKey, recordPieceLabel, recordQuestionsFilter, recordQuestionsMeta, recordQuestionsOffered, sortQuestions } from './recordQuestions'

function req(p: Partial<MemberRequest> & { id: string; created_at: string }): MemberRequest {
  return { lane: 'estimators', title: 'q', status: 'open', priority: null, closed_at: null, closed_note: null, from_user_id: 'u1', bid_id: null, job_ledger_id: null, development_id: null, reference_summary: null, notes: [], ...p }
}

describe('sortQuestions — open first, then answered, newest first within each', () => {
  it('puts the waiting ones ahead of the answered, newest first in each group', () => {
    const rows = [
      req({ id: 'old-closed', created_at: '2026-10-01T00:00:00Z', status: 'closed', closed_at: '2026-10-02T00:00:00Z' }),
      req({ id: 'old-open', created_at: '2026-10-03T00:00:00Z' }),
      req({ id: 'new-closed', created_at: '2026-10-05T00:00:00Z', status: 'closed', closed_at: '2026-10-06T00:00:00Z' }),
      req({ id: 'new-open', created_at: '2026-10-07T00:00:00Z' }),
    ]
    expect(sortQuestions(rows).map((r) => r.id)).toEqual(['new-open', 'old-open', 'new-closed', 'old-closed'])
    expect(rows.map((r) => r.id)).toEqual(['old-closed', 'old-open', 'new-closed', 'new-open'])
  })
})

describe("recordQuestionsMeta — the section's words", () => {
  it('counts the waiting and the answered, and says when there is nothing', () => {
    expect(recordQuestionsMeta([])).toBe('none yet')
    expect(recordQuestionsMeta([req({ id: 'a', created_at: 'x' })])).toBe('1 waiting')
    expect(recordQuestionsMeta([req({ id: 'a', created_at: 'x' }), req({ id: 'b', created_at: 'x', closed_at: 'y' })])).toBe('1 waiting · 1 answered')
    expect(recordQuestionsMeta([req({ id: 'b', created_at: 'x', closed_at: 'y' }), req({ id: 'c', created_at: 'x', status: 'done' })])).toBe('nothing waiting · 2 answered')
  })
})

describe('recordQuestionsFilter — the record, and the bid a job came from', () => {
  it('a bid reads its own; a job reads its own and its bid when it has one', () => {
    expect(recordQuestionsFilter({ kind: 'bid', id: 'b1' }, null)).toBe('bid_id.eq.b1')
    expect(recordQuestionsFilter({ kind: 'bid', id: 'b1' }, 'b9')).toBe('bid_id.eq.b1')
    expect(recordQuestionsFilter({ kind: 'job', id: 'j1' }, null)).toBe('job_ledger_id.eq.j1')
    expect(recordQuestionsFilter({ kind: 'job', id: 'j1' }, 'b1')).toBe('job_ledger_id.eq.j1,bid_id.eq.b1')
  })
})

describe('markAskedOn — a bid question on the job it became', () => {
  it('marks the bid rows on a job with the bid label, and nothing on a bid', () => {
    const rows = [req({ id: 'own', created_at: 'x', job_ledger_id: 'j1' }), req({ id: 'from-bid', created_at: 'x', bid_id: 'b1' })]
    expect(markAskedOn(rows, { kind: 'job' }, { id: 'b1', label: 'BP418 Lot 14' }).map((r) => r.askedOn)).toEqual([null, 'BP418 Lot 14'])
    expect(markAskedOn(rows, { kind: 'job' }, null).map((r) => r.askedOn)).toEqual([null, null])
    expect(markAskedOn(rows, { kind: 'bid' }, { id: 'b1', label: 'BP418 Lot 14' }).map((r) => r.askedOn)).toEqual([null, null])
  })
})

describe('the sheet on a record', () => {
  it('names the record as its one About, with its key and its label', () => {
    const piece = { kind: 'job' as const, id: 'j1', label: 'JP1085 Lot 14 rough-in' }
    expect(recordAskAbout(piece)).toEqual({ kind: 'job', id: 'j1', label: 'JP1085 Lot 14 rough-in' })
    expect(recordAskKey(piece)).toBe('job:j1')
    expect(recordAskKey({ kind: 'bid', id: 'b2' })).toBe('bid:b2')
  })
  it('the label is the number and the name, the name alone with no number', () => {
    expect(recordPieceLabel('JP1085', ' Lot 14 rough-in ')).toBe('JP1085 Lot 14 rough-in')
    expect(recordPieceLabel('BP418', null)).toBe('BP418')
    expect(recordPieceLabel('', 'Lodge')).toBe('Lodge')
  })
  it('the titles and what the question lands with', () => {
    expect(RECORD_QUESTIONS_TITLE).toEqual({ job: 'Questions on this job', bid: 'Questions on this bid' })
    expect(RECORD_LANDS_WITH).toEqual({ job: 'this job', bid: 'this bid' })
  })
  it('is drawn for the office team and not the field', () => {
    expect(recordQuestionsOffered('dev')).toBe(true)
    expect(recordQuestionsOffered('master_technician')).toBe(true)
    expect(recordQuestionsOffered('estimator')).toBe(true)
    expect(recordQuestionsOffered('primary')).toBe(false)
    expect(recordQuestionsOffered(null)).toBe(false)
  })
})
