import { describe, expect, it } from 'vitest'
import type { LegalEntryRow } from './legalMatters'
import { askKindWords, askStateWords, buildLegalAsks, buildLegalConversation, conversationRows, conversationStateWords, conversationWho, defaultSignoffAsk, isConversationEntry, legalEntryKindWords, newAskMeta, officeAnswerMeta, openAsks, signoffStateForJob, signoffWords } from './legalAsks'

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

describe('buildLegalConversation (item 17)', () => {
  const fq1 = entry({ id: 'fq1', kind: 'question', body: 'Signed change order?', via_portal: true, occurred_on: '2026-09-20', created_at: '2026-09-20T15:00:00Z' })
  const linked = entry({ id: 'oa1', kind: 'answer', body: 'Yes, signed 4/2.', occurred_on: '2026-09-21', created_at: '2026-09-21T15:00:00Z', meta: { askId: 'fq1' } })
  const firmAns = entry({ id: 'fa1', kind: 'answer', body: 'The statutory text.', via_portal: true, occurred_on: '2026-09-24', created_at: '2026-09-24T15:00:00Z', meta: { askId: 'ask-2' } })

  it('threads each answer under its question, whichever side asked, oldest question first', () => {
    const rows = conversationRows([linked, firmAns, q, fq1])
    expect(rows.map((r) => [r.entry.id, r.isAnswer])).toEqual([['fq1', false], ['oa1', true], ['ask-2', false], ['fa1', true]])
    expect(conversationWho(rows[0]!, 'firm')).toBe('You asked')
    expect(conversationWho(rows[0]!, 'office')).toBe('The firm asked')
    expect(conversationWho(rows[1]!, 'firm')).toBe('The office')
    expect(conversationWho(rows[2]!, 'firm')).toBe('Grace asked')
    expect(conversationWho(rows[3]!, 'office')).toBe('The firm')
    expect(conversationWho({ ...rows[2]!, thread: { ...rows[2]!.thread, flavor: 'signoff', jobLabel: '273', askerName: '' } }, 'office')).toBe('We asked for a sign-off · 273')
  })
  it('an office answer saved before the link threads under the newest unanswered firm question before it', () => {
    const fq2 = entry({ id: 'fq2', kind: 'question', via_portal: true, created_at: '2026-09-22T15:00:00Z' })
    const bare = entry({ id: 'oa-old', kind: 'answer', body: 'See the Paper tab.', created_at: '2026-09-23T15:00:00Z' })
    const threads = buildLegalConversation([fq1, linked, fq2, bare])
    expect(threads.map((t) => [t.question.id, t.answers.map((a) => a.id), t.state])).toEqual([['fq1', ['oa1'], 'answered'], ['fq2', ['oa-old'], 'answered']])
  })
  it('never drops an answer with no question to sit under: it gets its own row (review)', () => {
    const lone = entry({ id: 'oa-lone', kind: 'answer', body: 'We filed the affidavit today.', created_at: '2026-09-19T15:00:00Z' })
    const stray = entry({ id: 'fa-stray', kind: 'answer', body: 'Signed off.', via_portal: true, created_at: '2026-09-25T15:00:00Z', meta: { askId: 'not-on-this-matter', signedOff: true } })
    const rows = conversationRows([fq1, linked, lone, stray])
    expect(rows.map((r) => [r.entry.id, r.isAnswer])).toEqual([['oa-lone', true], ['fq1', false], ['oa1', true], ['fa-stray', true]])
    expect(rows[0]!.thread.orphan).toBe(true)
    expect(conversationWho(rows[0]!, 'firm')).toBe('The office')
    expect(conversationStateWords(rows[0]!, 'firm')).toBeNull()
    expect(conversationWho(rows[3]!, 'office')).toBe('The firm')
    expect(conversationStateWords(rows[3]!, 'office')).toEqual({ text: 'waiting on you', tone: 'warn' })
  })
  it('words each state for its reader: answered, seen, waiting, withdrawn, signed off', () => {
    const open = conversationRows([fq1])[0]!
    expect(conversationStateWords(open, 'firm')).toEqual({ text: 'waiting on the office', tone: 'warn' })
    expect(conversationStateWords(open, 'office')).toEqual({ text: 'waiting on you', tone: 'warn' })
    expect(conversationStateWords(conversationRows([{ ...fq1, acknowledged_at: '2026-09-21T00:00:00Z' }])[0]!, 'firm')).toEqual({ text: 'seen', tone: 'ok' })
    const answered = conversationRows([fq1, linked])
    expect(conversationStateWords(answered[0]!, 'firm')).toEqual({ text: 'answered 2026-09-21', tone: 'ok' })
    expect(conversationStateWords(answered[1]!, 'firm')).toBeNull()
    const asked = conversationRows([q, firmAns])
    expect(conversationStateWords(asked[0]!, 'firm')).toEqual({ text: 'you answered 2026-09-24', tone: 'ok' })
    expect(conversationStateWords(asked[1]!, 'firm')).toEqual({ text: 'waiting on the office', tone: 'warn' })
    expect(conversationStateWords(conversationRows([q, { ...firmAns, acknowledged_at: '2026-09-25T00:00:00Z' }])[1]!, 'office')).toEqual({ text: 'seen', tone: 'ok' })
    expect(conversationStateWords(conversationRows([q])[0]!, 'firm')).toEqual({ text: 'asks you', tone: 'warn' })
    expect(conversationStateWords(conversationRows([{ ...ask, acknowledged_at: '2026-10-03T00:00:00Z' }])[0]!, 'firm')).toEqual({ text: 'withdrawn', tone: 'neutral' })
    const yes = entry({ id: 'ans-1', kind: 'answer', via_portal: true, occurred_on: '2026-10-03', created_at: '2026-10-03T10:00:00Z', meta: { askId: 'ask-1', signedOff: true } })
    expect(conversationStateWords(conversationRows([ask, yes])[0]!, 'office')).toEqual({ text: 'signed off 2026-10-03', tone: 'ok' })
  })
  it('owns only questions and answers, and links the office answer by id', () => {
    expect([fq1, linked, entry({ kind: 'step' }), entry({ kind: 'fee' })].map(isConversationEntry)).toEqual([true, true, false, false])
    expect(officeAnswerMeta('fq1')).toEqual({ askId: 'fq1' })
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
