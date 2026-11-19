import { describe, expect, it } from 'vitest'
import { foldPermitAnswers, permitAnswerKey, type PermitAnswerRow } from './bidPermitAnswers'

// Every bid, permit and person here is made up.
const PERMIT = { city: 'San Antonio', permit_number: 'PLB-2', permit_type: 'Plumbing General Permit' }
function row(over: Partial<PermitAnswerRow> = {}): PermitAnswerRow {
  return { id: 'a1', bid_id: 'b1', ...PERMIT, answer: 'this_job', answered_by: 'u-marcus', answered_at: '2026-11-12T15:00:00Z', ...over }
}
const KEY = permitAnswerKey('b1', PERMIT)

describe('foldPermitAnswers', () => {
  it('lets the newest answer on a bid and permit stand, whatever order the rows come in', () => {
    const rows = [row({ id: 'a2', answer: 'not_this_job', answered_by: 'u-priya', answered_at: '2026-11-14T09:00:00Z' }), row()]
    expect(foldPermitAnswers(rows).get(KEY)).toEqual({ answer: 'not_this_job', by: 'u-priya', at: '2026-11-14T09:00:00Z' })
  })

  it('leaves nothing standing after a take-back, and takes a later answer again', () => {
    const taken = [row(), row({ id: 'a2', answer: 'taken_back', answered_at: '2026-11-13T09:00:00Z' })]
    expect(foldPermitAnswers(taken).size).toBe(0)
    const again = [...taken, row({ id: 'a3', answer: 'not_this_job', answered_at: '2026-11-15T09:00:00Z' })]
    expect(foldPermitAnswers(again).get(KEY)?.answer).toBe('not_this_job')
  })

  it('keeps answers apart by bid, by city, by number and by type', () => {
    const rows = [
      row(),
      row({ id: 'a2', bid_id: 'b2', answer: 'not_this_job' }),
      row({ id: 'a3', city: 'Austin' }),
      row({ id: 'a4', permit_number: 'PLB-3' }),
      row({ id: 'a5', permit_type: 'Plumbing Gas Permit' }),
    ]
    const folded = foldPermitAnswers(rows)
    expect(folded.size).toBe(5)
    expect(folded.get(KEY)?.answer).toBe('this_job')
    expect(folded.get(permitAnswerKey('b2', PERMIT))?.answer).toBe('not_this_job')
  })

  it('settles two rows saved in one instant by their ids', () => {
    const at = '2026-11-12T15:00:00Z'
    const rows = [row({ id: 'a9', answer: 'not_this_job', answered_at: at }), row({ id: 'a1', answered_at: at })]
    expect(foldPermitAnswers(rows).get(KEY)?.answer).toBe('not_this_job')
  })
})
