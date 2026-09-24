import { describe, expect, it } from 'vitest'
import type { JobLienFilingRow } from '../jobs/lienDeadlines'
import { buildLegalEnvelopes, buildLegalJobTimelines, envelopeMonthsWords, envelopeSharesWords, envelopeWentOutWords, retainageWordsFor, workMonthsFromSessions } from './legalLienPaper'

const TODAY = '2026-09-23'

function filing(over: Partial<JobLienFilingRow> & Record<string, unknown>): JobLienFilingRow {
  return {
    id: 'f-1', job_id: 'job-273', kind: 'notice_53_056', amount: 17585, months_covered: ['2026-07', '2026-08'], invoice_ids: [], fields: {}, sends: [],
    county: '', recording_number: '', filed_at: null, served_at: null, serve_due: null, created_by: null, created_at: '2026-09-22T15:00:00Z', voided_at: null,
    by_hand: false, packet_id: null, printed_claim: null, document_url: '', document_note: '',
    ...over,
  } as unknown as JobLienFilingRow
}

const session = (jobId: string, day: string, over: Partial<{ approved: boolean; disqualified: boolean }> = {}) => ({ jobId, workDate: day, clockedInAt: `${day}T13:00:00Z`, clockedOutAt: `${day}T17:00:00Z`, approved: true, disqualified: false, ...over })

const labelOf = (id: string) => ({ 'job-273': '273', 'job-858': '858', 'job-866': '866' })[id] ?? id

describe('workMonthsFromSessions', () => {
  it('folds approved sessions into months, oldest first, and skips rejected or unapproved ones', () => {
    const wm = workMonthsFromSessions('job-273', [session('job-273', '2026-08-27'), session('job-273', '2026-04-03'), session('job-273', '2026-06-10', { approved: false }), session('job-273', '2026-05-12', { disqualified: true }), session('job-858', '2026-07-01')], { isSub: true, propertyKind: 'residential' })
    expect(wm?.months.map((m) => m.key)).toEqual(['2026-04', '2026-08'])
    expect(wm?.lastMonthKey).toBe('2026-08')
    expect(wm?.role).toBe('sub')
    expect(wm?.months[0]).toEqual(expect.objectContaining({ label: 'Apr 2026', hours: 4, dayCount: 1, notice: null }))
  })
  it('is null with no usable session', () => {
    expect(workMonthsFromSessions('job-273', [session('job-273', '2026-08-27', { approved: false })], { isSub: true, propertyKind: '' })).toBeNull()
  })
})

describe('buildLegalJobTimelines', () => {
  it('draws the desk timeline per job from the packet rows: sent months done, closed months missed, the affidavit next', () => {
    const t = buildLegalJobTimelines({
      jobs: [{ id: 'job-273', created_at: '2026-03-01T00:00:00Z', last_work_date: '2026-08-27', lien_contract_ended_on: null, lien_retainage_held: null, lien_payment_bond: 'unknown' }],
      labelOf,
      openBalanceOf: () => 17585,
      lastWorkOf: () => '2026-08-27',
      sessions: [session('job-273', '2026-04-03'), session('job-273', '2026-06-10'), session('job-273', '2026-07-14'), session('job-273', '2026-08-27')],
      filings: [filing({ months_covered: ['2026-04', '2026-06', '2026-07', '2026-08'], sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '', sent_on: '2026-09-22' }], by_hand: true })],
      propertyKind: 'residential',
      isSub: true,
      todayYmd: TODAY,
    })[0]!
    expect(t.jobLabel).toBe('273')
    expect(t.openBalance).toBe(17585)
    const byKey = Object.fromEntries(t.timeline.steps.map((s) => [s.key, s.state]))
    expect(byKey['notice:2026-07']).toBe('done')
    expect(byKey['notice:2026-08']).toBe('done')
    expect(byKey['notice:2026-04']).toBe('done')
    expect(t.timeline.next.kind).toBe('affidavit')
    expect(t.timeline.next.date).toBe('2026-11-16')
    expect(t.retainageWords).toBe('')
  })
  it('a job with no sessions is dated from its creation month, and the retainage facts read as words', () => {
    const t = buildLegalJobTimelines({
      jobs: [{ id: 'job-864', created_at: '2026-08-05T00:00:00Z', last_work_date: null, lien_contract_ended_on: '2026-11-30', lien_retainage_held: 2400, lien_payment_bond: 'no' }],
      labelOf: () => '864',
      openBalanceOf: () => 3120,
      lastWorkOf: () => null,
      sessions: [],
      filings: [],
      propertyKind: '',
      isSub: true,
      todayYmd: TODAY,
    })[0]!
    expect(t.timeline.steps.some((s) => s.kind === 'notice' && s.monthKey === '2026-08')).toBe(true)
    expect(t.retainageWords).toBe('contract ended Nov 30 · retainage held $2,400 · no payment bond')
  })
})

describe('buildLegalEnvelopes', () => {
  it('one packet over three jobs is one envelope with every share, the printed claim, and closed months as information', () => {
    const sends = [{ recipient: 'owner', method: 'certified_mail', tracking: '9407 1118', sent_on: '2026-09-22' }, { recipient: 'original_contractor', method: 'certified_mail', tracking: '9407 1119', sent_on: '2026-09-22' }]
    const months = ['2026-04', '2026-06', '2026-07', '2026-08']
    const rows = [
      filing({ id: 'f-a', job_id: 'job-273', amount: 17585, months_covered: months, sends, by_hand: true, packet_id: 'pk-1', printed_claim: 28987, document_url: 'https://drive.google.com/x' }),
      filing({ id: 'f-b', job_id: 'job-866', amount: 4450, months_covered: months, sends, by_hand: true, packet_id: 'pk-1', printed_claim: 28987, created_at: '2026-09-22T15:00:01Z' }),
      filing({ id: 'f-c', job_id: 'job-858', amount: 6952, months_covered: months, sends, by_hand: true, packet_id: 'pk-1', printed_claim: 28987, created_at: '2026-09-22T15:00:02Z' }),
    ]
    const out = buildLegalEnvelopes(rows, { labelOf, propertyKind: 'residential' })
    expect(out).toHaveLength(1)
    const e = out[0]!
    expect(e).toEqual(expect.objectContaining({ letter: 'A', kindLabel: '§ 53.056 notice', wentOutYmd: '2026-09-22', byHand: true, claim: 28987, documentUrl: 'https://drive.google.com/x' }))
    expect(e.shares).toEqual([{ jobId: 'job-273', jobLabel: '273', amount: 17585 }, { jobId: 'job-858', jobLabel: '858', amount: 6952 }, { jobId: 'job-866', jobLabel: '866', amount: 4450 }])
    expect(e.months.map((m) => [m.label, m.asInformation])).toEqual([['Apr', true], ['Jun', true], ['Jul', true], ['Aug', false]])
    expect(envelopeMonthsWords(e)).toBe('Apr (as information), Jun (as information), Jul (as information), Aug')
    expect(envelopeSharesWords(e)).toBe('273 $17,585 · 858 $6,952 · 866 $4,450')
    expect(envelopeWentOutWords(e, TODAY)).toBe('Sep 22 · by hand · certified mail · 9407 1118, 9407 1119')
  })
  it('rows without a packet are their own envelopes, lettered by the day they went out; an affidavit reads filed and served', () => {
    const rows = [
      filing({ id: 'f-aff', job_id: 'job-273', kind: 'affidavit', amount: 17585, months_covered: [], filed_at: '2026-11-20', served_at: '2026-11-23', serve_due: '2026-11-25', county: 'Comal', recording_number: '2026-0412', created_at: '2026-11-20T12:00:00Z' }),
      filing({ id: 'f-n', job_id: 'job-273', months_covered: ['2026-07'], sends: [{ recipient: 'owner', method: 'email', tracking: '', sent_on: '2026-08-10' }], created_at: '2026-08-10T12:00:00Z' }),
    ]
    const out = buildLegalEnvelopes(rows, { labelOf, propertyKind: 'commercial' })
    expect(out.map((e) => [e.letter, e.kind, e.wentOutYmd])).toEqual([['A', 'notice_53_056', '2026-08-10'], ['B', 'affidavit', '2026-11-20']])
    const notice = out[0]!
    const affidavit = out[1]!
    expect(envelopeSharesWords(notice)).toBe('273')
    expect(notice.months).toEqual([{ key: '2026-07', label: 'Jul', asInformation: false }])
    expect(envelopeWentOutWords(affidavit, '2026-11-24')).toBe('filed Nov 20 · served Nov 23')
    expect(envelopeWentOutWords({ ...affidavit, servedYmd: null }, '2026-11-24')).toBe('filed Nov 20 · serve by Nov 25')
    expect(envelopeWentOutWords({ ...notice, sends: [], wentOutYmd: null }, TODAY)).toBe('not sent')
  })
})

describe('retainageWordsFor', () => {
  it('says only what the row holds', () => {
    expect(retainageWordsFor({ lien_contract_ended_on: null, lien_retainage_held: null, lien_payment_bond: 'unknown' }, TODAY)).toBe('')
    expect(retainageWordsFor({ lien_contract_ended_on: '2027-01-15', lien_retainage_held: 0, lien_payment_bond: 'yes' }, TODAY)).toBe('contract ended Jan 15, 2027 · payment bond on the project')
  })
})

// ---------------------------------------------------------------------------
// Under a notice (#41 PR 1b): the owner's answers, letter two, the GC's okay
// ---------------------------------------------------------------------------

import { attachEnvelopeAnswers, envelopeAnswersWords, envelopeKindWords, type LegalDeskItemLike } from './legalLienPaper'

function item(over: Partial<LegalDeskItemLike> & { id: string; job_id: string }): LegalDeskItemLike {
  return { kind: 'notice_53_056', status: 'sent', sent_at: '2026-09-22T16:00:00Z', sent_filing_id: null, fields: {}, created_at: '2026-09-20T10:00:00Z', voided_at: null, ...over }
}

const OWNER_CALL = { at: '2026-10-01T15:30:00Z', name: 'Taunya', owesGc: 'yes', owesAmount: 41200, reserved: 'held', originalContractCompletedOn: '2026-11-30', note: '' }

describe('attachEnvelopeAnswers', () => {
  const lenox = [
    filing({ id: 'f-273', job_id: 'job-273', amount: 17585, packet_id: 'pk-1', printed_claim: 28987, sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '', sent_on: '2026-09-22' }], by_hand: true }),
    filing({ id: 'f-858', job_id: 'job-858', amount: 6952, packet_id: 'pk-1', printed_claim: 28987, created_at: '2026-09-22T15:00:01Z' }),
    filing({ id: 'f-866', job_id: 'job-866', amount: 4450, packet_id: 'pk-1', printed_claim: 28987, created_at: '2026-09-22T15:00:02Z' }),
  ]
  const envelopes = buildLegalEnvelopes(lenox, { labelOf, propertyKind: 'residential' })

  it('reads the owner\'s call, the pile and the hold off the items that sent the paper, and letter two\'s clock per covered job', () => {
    const items = [
      item({ id: 'it-273', job_id: 'job-273', sent_filing_id: 'f-273', fields: { ownerCall: OWNER_CALL } }),
      item({ id: 'it-858', job_id: 'job-858', sent_filing_id: 'f-858' }),
      item({ id: 'it-866', job_id: 'job-866', sent_filing_id: 'f-866', fields: { gcAuthorizedDirectPay: { at: '2026-09-30T12:00:00Z', name: 'Dana', note: 'email from Lenox' } } }),
    ]
    const [e] = attachEnvelopeAnswers(envelopes, { items, openBalanceOf: (id) => (id === 'job-866' ? 0 : 5000), todayYmd: '2026-10-06' })
    expect(e?.letterTwo).toBeNull()
    expect(e?.answers?.ownerCall?.owesAmount).toBe(41200)
    expect(e?.answers?.pile).toBe('A')
    expect(e?.answers?.holdEndsOn).toBe('2026-12-30')
    expect(e?.answers?.gcAuthorized?.name).toBe('Dana')
    expect(e?.answers?.letterTwo.map((l) => [l.jobLabel, l.status.state])).toEqual([['273', 'owner_called'], ['858', 'overdue'], ['866', 'paid']])
  })

  it('takes the latest call when two items on the paper carry one', () => {
    const items = [
      item({ id: 'it-273', job_id: 'job-273', sent_filing_id: 'f-273', fields: { ownerCall: { ...OWNER_CALL, at: '2026-09-25T10:00:00Z', owesGc: 'unknown', reserved: 'unknown', originalContractCompletedOn: null } } }),
      item({ id: 'it-858', job_id: 'job-858', sent_filing_id: 'f-858', fields: { ownerCall: OWNER_CALL } }),
    ]
    const [e] = attachEnvelopeAnswers(envelopes, { items, openBalanceOf: () => 5000, todayYmd: '2026-10-06' })
    expect(e?.answers?.ownerCall?.at).toBe(OWNER_CALL.at)
  })

  it('draws an empty band under a notice no item sent, and none under an affidavit', () => {
    const rows = [filing({ id: 'f-a', job_id: 'job-273', kind: 'affidavit', filed_at: '2026-10-02T12:00:00Z', county: 'Comal', created_at: '2026-10-02T12:00:00Z' }), ...lenox]
    const out = attachEnvelopeAnswers(buildLegalEnvelopes(rows, { labelOf, propertyKind: 'residential' }), { items: [], openBalanceOf: () => 5000, todayYmd: '2026-10-06' })
    const notice = out.find((e) => e.kind === 'notice_53_056')!
    const affidavit = out.find((e) => e.kind === 'affidavit')!
    expect(notice.answers).toEqual({ ownerCall: null, pile: null, holdEndsOn: '', gcAuthorized: null, letterTwo: expect.arrayContaining([expect.objectContaining({ jobLabel: '273', status: expect.objectContaining({ state: 'none' }) })]) })
    expect(affidavit.answers).toBeNull()
    expect(affidavit.letterTwo).toBeNull()
  })

  it('names a letter two as one and gives it no band; the first packet keeps the clock', () => {
    const rows = [
      filing({ id: 'f-1', job_id: 'job-273', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '', sent_on: '2026-09-02' }] }),
      filing({ id: 'f-2', job_id: 'job-273', months_covered: ['2026-07', '2026-08'], created_at: '2026-09-18T15:00:00Z', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '', sent_on: '2026-09-18' }] }),
    ]
    const items = [
      item({ id: 'it-1', job_id: 'job-273', sent_filing_id: 'f-1', sent_at: '2026-09-02T16:00:00Z', created_at: '2026-09-01T10:00:00Z' }),
      item({ id: 'it-2', job_id: 'job-273', sent_filing_id: 'f-2', sent_at: '2026-09-18T16:00:00Z', created_at: '2026-09-16T10:00:00Z', fields: { letterTwo: { kind: 'paid_out', afterItemId: 'it-1', afterSentAt: '2026-09-02T16:00:00Z' } } }),
    ]
    const [first, second] = attachEnvelopeAnswers(buildLegalEnvelopes(rows, { labelOf, propertyKind: '' }), { items, openBalanceOf: () => 9000, todayYmd: '2026-09-23' })
    expect(first?.letter).toBe('A')
    expect(first?.answers?.letterTwo[0]?.status.state).toBe('sent')
    expect(second?.letterTwo).toEqual({ kind: 'paid_out' })
    expect(second?.answers).toBeNull()
    expect(envelopeKindWords(second!)).toBe('§ 53.056 notice · letter two, paid-out')
    expect(envelopeKindWords(first!)).toBe('§ 53.056 notice')
  })

  it('leaves the clock off an older notice on a job whose first packet is a later paper', () => {
    const rows = [
      filing({ id: 'f-old', job_id: 'job-273', months_covered: ['2026-04'], created_at: '2026-06-10T15:00:00Z', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '', sent_on: '2026-06-10' }] }),
      filing({ id: 'f-new', job_id: 'job-273', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '', sent_on: '2026-09-22' }] }),
    ]
    const items = [
      item({ id: 'it-old', job_id: 'job-273', sent_filing_id: 'f-old', sent_at: '2026-06-10T16:00:00Z', created_at: '2026-06-01T10:00:00Z' }),
      item({ id: 'it-new', job_id: 'job-273', sent_filing_id: 'f-new' }),
    ]
    const [old, fresh] = attachEnvelopeAnswers(buildLegalEnvelopes(rows, { labelOf, propertyKind: '' }), { items, openBalanceOf: () => 9000, todayYmd: '2026-10-06' })
    expect(old?.answers?.letterTwo[0]?.status.state).toBe('none')
    expect(fresh?.answers?.letterTwo[0]?.status.state).toBe('overdue')
  })
})

describe('envelopeAnswersWords', () => {
  const base = { ownerCall: null, pile: null, holdEndsOn: '', gcAuthorized: null, letterTwo: [] }
  const opts = { todayYmd: '2026-10-06', gcName: 'Lenox' }
  it('words the call, the pile and the hold in one line, with the GC by name', () => {
    const a = { ...base, ownerCall: { ...OWNER_CALL, owesGc: 'yes' as const, reserved: 'held' as const, note: 'will pay Click direct against a release' }, pile: 'A' as const, holdEndsOn: '2026-12-30' }
    expect(envelopeAnswersWords(a, opts).owner).toBe('Oct 1, Taunya — still owes Lenox $41,200 · reserved the 10% and still holds it · their contract completes Nov 30 → pile A: the claim is trapped under § 53.081; the § 53.101 hold runs to Dec 30 · “will pay Click direct against a release”')
  })
  it('says what is still owed when nothing is recorded', () => {
    const w = envelopeAnswersWords(base, opts)
    expect(w.owner).toMatch(/no call recorded yet/)
    expect(w.letterTwo).toBe('—')
    expect(w.gcOkay).toBe('none')
  })
  it('folds the covered jobs\' clocks into one line when they agree and names each when they differ', () => {
    const status = (state: 'due' | 'paid', day: number | null) => ({ state, day, firstItemId: 'x', firstSentAt: null, letterTwo: null, gcAuthorized: null, words: '' })
    const same = { ...base, letterTwo: [{ jobId: 'a', jobLabel: '273', status: status('due', 12) }, { jobId: 'b', jobLabel: '858', status: status('due', 12) }] }
    expect(envelopeAnswersWords(same, opts).letterTwo).toBe('day 12 · due, not sent')
    const differ = { ...base, letterTwo: [{ jobId: 'a', jobLabel: '273', status: status('due', 12) }, { jobId: 'b', jobLabel: '858', status: status('paid', 12) }] }
    expect(envelopeAnswersWords(differ, opts).letterTwo).toBe('273: day 12 · due, not sent · 858: not needed — paid')
  })
  it('words the GC\'s written okay with who and where', () => {
    expect(envelopeAnswersWords({ ...base, gcAuthorized: { at: '2026-09-30T12:00:00Z', name: 'Dana', note: 'email from Lenox' } }, opts).gcOkay).toBe('Sep 30 · Dana · email from Lenox')
  })
})
