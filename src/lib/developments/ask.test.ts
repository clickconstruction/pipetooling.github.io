import { describe, expect, it } from 'vitest'
import { ASK_LANES, ASK_TITLE_MAX, askFootWords, askIsSendable, askReferenceSummary, askRow, askSentWords, askTitleForPlans } from './ask'

describe('askRow — one reference, the inbox words, the asker', () => {
  it('a question about the site carries the development and the house', () => {
    expect(askRow({ lane: 'estimators', about: { kind: 'site' }, title: '  Which set is current?  ' }, 'dev1', 'Harlow Ranch', 'u1')).toEqual({ from_user_id: 'u1', title: 'Which set is current?', links: [], development_id: 'dev1', job_ledger_id: null, bid_id: null, reference_summary: '🏠 Harlow Ranch' })
  })
  it('a question about a job or a bid carries that piece alone, with its label', () => {
    expect(askRow({ lane: 'dispatch', about: { kind: 'job', id: 'j1', label: 'JP1102 Lot 14 rough-in' }, title: 'Crew Thursday?' }, 'dev1', 'Harlow Ranch', 'u1')).toMatchObject({ development_id: null, job_ledger_id: 'j1', bid_id: null, reference_summary: 'JP1102 Lot 14 rough-in' })
    expect(askRow({ lane: 'estimators', about: { kind: 'bid', id: 'b1', label: 'BP431 Lot 18' }, title: 'Price?' }, 'dev1', 'H', 'u1')).toMatchObject({ development_id: null, job_ledger_id: null, bid_id: 'b1', reference_summary: 'BP431 Lot 18' })
  })
  it('from a record\'s own window there is no site: the record is the one reference (PR 4b)', () => {
    expect(askRow({ lane: 'dispatch', about: { kind: 'job', id: 'j1', label: 'JP1085 Lot 14' }, title: 'Crew?' }, null, 'JP1085 Lot 14', 'u1')).toMatchObject({ development_id: null, job_ledger_id: 'j1', bid_id: null, reference_summary: 'JP1085 Lot 14' })
  })
})

describe('the words', () => {
  it('askIsSendable wants words, not too many', () => {
    expect(askIsSendable({ title: '   ' })).toBe(false)
    expect(askIsSendable({ title: 'x' })).toBe(true)
    expect(askIsSendable({ title: 'a'.repeat(ASK_TITLE_MAX) })).toBe(true)
    expect(askIsSendable({ title: 'a'.repeat(ASK_TITLE_MAX + 1) })).toBe(false)
  })
  it('the Plans ask names the count and asks which set', () => {
    expect(askTitleForPlans(1)).toBe('1 job or bid is on an older plan set or none: which set do we build from?')
    expect(askTitleForPlans(42)).toBe('42 jobs and bids are on an older plan set or none: which set do we build from?')
  })
  it('the sent words name the lane and the piece', () => {
    expect(askSentWords({ lane: 'dispatch', about: { kind: 'site' }, title: 'x' }, 'Harlow Ranch')).toBe('Asked Dispatch about Harlow Ranch. The answer comes back here, under Questions.')
    expect(askSentWords({ lane: 'estimators', about: { kind: 'bid', id: 'b', label: 'BP431 Lot 18' }, title: 'x' }, 'H')).toBe('Asked the estimators about BP431 Lot 18. The answer comes back here, under Questions.')
  })
  it('the foot names what the question lands with', () => {
    expect(askFootWords('the site')).toBe('It lands in their inbox with the site named on it, and the answer comes back here, under Questions.')
    expect(askFootWords('this bid')).toBe('It lands in their inbox with this bid named on it, and the answer comes back here, under Questions.')
  })
  it('the two lanes carry their verbs and what they answer', () => {
    expect(ASK_LANES.map((l) => l.verb)).toEqual(['Ask the estimators', 'Ask Dispatch'])
    expect(askReferenceSummary({ kind: 'site' }, 'H')).toBe('🏠 H')
  })
})
