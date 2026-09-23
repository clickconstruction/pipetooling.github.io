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
