import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { COUNT_LINE, answerInvitesRfi, answeredLine, asksForACount, citesWords, rfiQuestionFrom, waitingWords, type PlanQuestionRow } from './planQuestions'

const NOW = Date.parse('2026-10-21T19:38:00Z')
const row = (over: Partial<PlanQuestionRow> = {}): PlanQuestionRow => ({ id: 'q1', bid_id: 'h1', question: 'Is there a grease interceptor on this job?', asked_by: 'u1', asked_at: '2026-10-21T19:41:00Z', status: 'open', answer: null, sheet_refs: [], answered_at: null, seen_at: null, rfi_id: null, ...over })

describe('planQuestions', () => {
  it('knows a count question', () => {
    expect(asksForACount('How many floor drains on the first floor?')).toBe(true)
    expect(asksForACount('Is there a grease interceptor?')).toBe(false)
    expect(plainWordsFailures(COUNT_LINE)).toEqual([])
  })
  it('the waiting words by state', () => {
    expect(waitingWords(row(), true, NOW + 5 * 60_000)).toBe('Asked 2m ago. The robot looks on its next round, within a few minutes.')
    expect(waitingWords(row(), false, NOW)).toBe('The robot answers once its own number is sealed, usually within the hour. The plans answer now.')
    expect(waitingWords(row({ status: 'answered', answered_at: '2026-10-21T19:47:00Z' }), true, NOW + 10 * 60_000)).toBe('Answered 1m ago.')
    for (const w of [waitingWords(row(), true, NOW), waitingWords(row(), false, NOW)]) expect(plainWordsFailures(w)).toEqual([])
  })
  it('cites, invites an RFI, and writes the RFI question', () => {
    expect(citesWords(['P-001', ' P-201 '])).toBe('cites P-001, P-201')
    expect(citesWords([])).toBe('')
    expect(answerInvitesRfi('The plans do not show a grease interceptor. Note 14 puts the kitchen with others.')).toBe(true)
    expect(answerInvitesRfi('FD-1 is drawn on P-201 and P-202.')).toBe(false)
    const q = row({ status: 'answered', answer: 'The plans do not show a grease interceptor.' })
    expect(rfiQuestionFrom(q)).toBe('Is there a grease interceptor on this job? The plans do not settle it: The plans do not show a grease interceptor.')
  })
  it('the Needs You line for the asker', () => {
    const one = answeredLine([row({ status: 'answered', answer: 'No.' })], () => '511')!
    expect(one.title).toBe('The robot answered your question on b511')
    expect(one.detail).toBe("Is there a grease interceptor on this job? Open the bid's Plans panel to read the answer.")
    const two = answeredLine([row({ status: 'answered' }), row({ id: 'q2', status: 'answered', bid_id: 'h2' })], (id) => (id === 'h1' ? '511' : '509'))!
    expect(two.title).toBe('The robot answered 2 of your questions')
    expect(answeredLine([row({ status: 'answered', seen_at: '2026-10-21T20:00:00Z' })], () => '511')).toBeNull()
  })
})
