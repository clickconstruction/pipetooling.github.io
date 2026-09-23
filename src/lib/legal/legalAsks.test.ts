import { describe, expect, it } from 'vitest'
import type { LegalEntryRow } from './legalMatters'
import { askKindWords, askStateWords, buildLegalAsks, defaultSignoffAsk, legalEntryKindWords, newAskMeta, openAsks, signoffStateForJob, signoffWords } from './legalAsks'

function entry(over: Partial<LegalEntryRow>): LegalEntryRow {
  return { id: 'e', matter_id: 'm-1', kind: 'note', amount: null, body: '', occurred_on: '2026-10-02', meta: {}, via_portal: false, created_by: null, acknowledged_at: null, created_at: '2026-10-02T15:00:00Z', ...over }
}

const ask = entry({ id: 'ask-1', kind: 'question', body: 'May we take the check?', meta: newAskMeta({ flavor: 'signoff', jobId: 'job-273', jobLabel: '273', askedBy: 'Taunya' }) })
const q = entry({ id: 'ask-2', kind: 'question', body: 'Which text goes on the § 53.057 form?', occurred_on: '2026-09-23', created_at: '2026-09-23T15:00:00Z', meta: newAskMeta({ flavor: 'question', askedBy: 'Grace' }) })
const firmQuestion = entry({ id: 'fq', kind: 'question', body: 'Is there a signed contract?', via_portal: true })

describe('buildLegalAsks', () => {
  it('lists the office’s asks oldest first with their flavor and job, never the firm’s questions', () => {
    const asks = buildLegalAsks([ask, q, firmQuestion])
    expect(asks.map((a) => [a.id, a.flavor, a.jobLabel, a.state])).toEqual([['ask-2', 'question', '', 'open'], ['ask-1', 'signoff', '273', 'open']])
    expect(openAsks([ask, q, firmQuestion])).toHaveLength(2)
    expect(askKindWords(asks[1]!)).toBe('Sign off · 273')
    expect(askKindWords(asks[0]!)).toBe('Question')
    expect(askStateWords(asks[1]!)).toEqual({ text: 'waiting on the firm', tone: 'warn' })
  })
  it('a firm answer closes the ask; a sign-off reads signed off or not yet; an acknowledged ask is withdrawn', () => {
    const yes = entry({ id: 'ans-1', kind: 'answer', body: 'Take it against a release.', via_portal: true, occurred_on: '2026-10-03', created_at: '2026-10-03T10:00:00Z', meta: { askId: 'ask-1', signedOff: true } })
    const [a] = buildLegalAsks([ask, yes])
    expect(a!.state).toBe('answered')
    expect(a!.answer).toEqual({ id: 'ans-1', body: 'Take it against a release.', signedOff: true, on: '2026-10-03' })
    expect(askStateWords(a!)).toEqual({ text: 'signed off 2026-10-03', tone: 'ok' })
    const no = entry({ id: 'ans-2', kind: 'answer', via_portal: true, occurred_on: '2026-10-03', meta: { askId: 'ask-1', signedOff: false } })
    expect(askStateWords(buildLegalAsks([ask, no])[0]!)).toEqual({ text: 'not yet · 2026-10-03', tone: 'stop' })
    expect(buildLegalAsks([{ ...ask, acknowledged_at: '2026-10-04T00:00:00Z' }])[0]!.state).toBe('withdrawn')
    expect(openAsks([ask, yes])).toHaveLength(0)
  })
})

describe('signoffStateForJob', () => {
  it('reads the newest sign-off about the job and words it for the footer', () => {
    expect(signoffStateForJob([q], 'job-273')).toEqual({ state: 'none', on: '', askId: null })
    expect(signoffWords(signoffStateForJob([q], 'job-273'))).toBe('')
    expect(signoffStateForJob([ask], 'job-273')).toEqual({ state: 'asked', on: '2026-10-02', askId: 'ask-1' })
    const yes = entry({ id: 'ans-1', kind: 'answer', via_portal: true, occurred_on: '2026-10-03', meta: { askId: 'ask-1', signedOff: true } })
    expect(signoffWords(signoffStateForJob([ask, yes], 'job-273'), (y) => y.slice(5))).toBe("counsel signed off 10-03 · take the owner's payment")
    const no = entry({ id: 'ans-2', kind: 'answer', via_portal: true, occurred_on: '2026-10-03', meta: { askId: 'ask-1', signedOff: false } })
    expect(signoffWords(signoffStateForJob([ask, no], 'job-273'))).toBe('counsel said not yet 2026-10-03')
    expect(signoffStateForJob([ask], 'job-999').state).toBe('none')
  })
})

describe('words', () => {
  it('names entry kinds for the tables and drafts the sign-off ask', () => {
    expect(legalEntryKindWords(ask)).toBe('ask · sign off · 273')
    expect(legalEntryKindWords(q)).toBe('ask · question')
    expect(legalEntryKindWords(firmQuestion)).toBe('question')
    expect(legalEntryKindWords(entry({ kind: 'answer', via_portal: true, meta: { askId: 'x', signedOff: true } }))).toBe('answer · signed off')
    expect(legalEntryKindWords(entry({ kind: 'payment_received', via_portal: true }))).toBe('payment received')
    expect(defaultSignoffAsk({ gcName: 'Lenox', amount: '$17,585' })).toBe('The owner wants to pay Click direct against a release — $17,585; Lenox has not answered and has given no written okay. May we take the check?')
  })
})
