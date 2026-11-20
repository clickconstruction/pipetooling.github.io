import { describe, expect, it } from 'vitest'
import {
  fieldsWithSetAside,
  fieldsWithoutSetAside,
  lienAppliedRowWords,
  lienApplyButtonWords,
  lienApplyChecks,
  lienApplyMonthsOffered,
  lienApplyPayload,
  lienApplyReasonProblem,
  lienApplySetsAside,
  lienApplyStartsBlank,
  lienNoticedMonthsOnJob,
  lienPaperKey,
  lienPaperWords,
  lienRecordedPapers,
  sameLienProperty,
  type LienApplyFilingRow,
} from './lienNoticeApply'

// Made-up: 14 Larkspur Ln under Redbud Builders. One certified paper of Sep 22 claimed $12,400 for jobs 4101, 4107
// and 4112. It was recorded on 4101 and 4112 with the months it printed. Job 4107's $1,900 now sits in September.
const owner = { recipient: 'owner', method: 'certified_mail', tracking: '9507 1000 0000 0000 0000 11', sent_on: '2026-09-22' }
const row = (over: Partial<LienApplyFilingRow>): LienApplyFilingRow => ({
  id: 'f1',
  job_id: 'j4101',
  kind: 'notice_53_056',
  months_covered: ['2026-06', '2026-07', '2026-08'],
  sends: [owner],
  amount: 9_000,
  printed_claim: 12_400,
  packet_id: 'p1',
  document_url: 'https://drive.example/larkspur',
  fields: { claimAmount: '12400.00' },
  created_at: '2026-10-06T12:00:00Z',
  ...over,
})
const label = (id: string) => id.replace(/^j/, '')
const filings: LienApplyFilingRow[] = [
  row({}),
  // The same paper, recorded in a second sitting on a second packet, its number typed without spaces.
  row({ id: 'f2', job_id: 'j4112', amount: 1_500, packet_id: 'p2', sends: [{ ...owner, tracking: '9507100000000000000011' }], created_at: '2026-11-13T12:00:00Z' }),
  // A later run: one form, owner and contractor.
  row({ id: 'f3', job_id: 'j4112', amount: 2_150, printed_claim: null, packet_id: null, months_covered: ['2026-08'], document_url: '', sends: [{ ...owner, tracking: '22', sent_on: '2026-10-14' }, { recipient: 'original_contractor', method: 'certified_mail', tracking: '33', sent_on: '2026-10-14' }] }),
  row({ id: 'gone', job_id: 'j4101', voided_at: '2026-10-07T00:00:00Z', sends: [{ ...owner, sent_on: '2026-08-01' }] }),
  row({ id: 'aff', kind: 'affidavit', sends: [] }),
]
const papers = lienRecordedPapers(filings, { thisJobId: 'j4107', jobLabel: label })
const sep22 = papers.find((p) => p.sentOn === '2026-09-22')!
const oct14 = papers.find((p) => p.sentOn === '2026-10-14')!

describe('a notice that already went, applied to a job (v2.7508)', () => {
  it('reads one paper off the rows that record it, whatever packet each sits on', () => {
    expect(papers.map((p) => p.sentOn)).toEqual(['2026-10-14', '2026-09-22'])
    expect(lienPaperKey(filings[0]!)).toBe(lienPaperKey(filings[1]!))
    expect(sep22).toMatchObject({ sourceFilingId: 'f1', sourceJobId: 'j4101', sourceJobLabel: '4101', toOwner: true, toContractor: false, claimAsPrinted: 12_400, monthsPrinted: ['2026-06', '2026-07', '2026-08'], jobLabels: ['4101', '4112'], documentUrl: 'https://drive.example/larkspur', packetId: 'p1' })
    // A run's form prints its own job's claim: the total is the sum of the jobs it is recorded on.
    expect(oct14).toMatchObject({ sourceFilingId: 'f3', toContractor: true, claimAsPrinted: 2_150, monthsPrinted: ['2026-08'] })
    expect(oct14.sends.map((s) => s.recipient)).toEqual(['owner', 'original_contractor'])
  })

  it('points at a row on another job first, and at a row that records the paper itself over one that applies it', () => {
    const own = lienRecordedPapers([row({ id: 'mine', job_id: 'j4107', created_at: '2026-01-01T00:00:00Z' }), row({ id: 'theirs' })], { thisJobId: 'j4107', jobLabel: label })[0]!
    expect(own.sourceFilingId).toBe('theirs')
    const applied = lienRecordedPapers([row({ id: 'applied', job_id: 'j4112', applied_from: 'f1', months_covered: ['2026-09'], created_at: '2026-01-01T00:00:00Z' }), row({})], { thisJobId: 'j4107', jobLabel: label })[0]!
    expect(applied.sourceFilingId).toBe('f1')
    // An applied row's months are that job's, not the paper's.
    expect(applied.monthsPrinted).toEqual(['2026-06', '2026-07', '2026-08'])
    // A paper this job alone holds is still listed: its record may lack a month.
    expect(lienRecordedPapers([row({ id: 'mine', job_id: 'j4107' })], { thisJobId: 'j4107', jobLabel: label })[0]!.sourceFilingId).toBe('mine')
  })

  it('reads the months a job already has a notice for', () => {
    expect(lienNoticedMonthsOnJob(filings, 'j4112')).toEqual(['2026-06', '2026-07', '2026-08'])
    expect(lienNoticedMonthsOnJob(filings, 'j4107')).toEqual([])
  })

  it('warns on a month the paper does not print and on no copy to the contractor, and lets both through', () => {
    const checks = lienApplyChecks({ paper: sep22, months: ['2026-09'], noticedMonths: [], propertyKind: 'residential', lastWorkYmd: '2026-09-11' })
    expect(checks.refusals).toEqual([])
    expect(checks.warnings).toEqual(['The paper lists Jun, Jul and Aug. September is not printed on it.', 'No copy to the original contractor is on record for this paper.'])
    expect(lienApplyReasonProblem(checks.warnings, 'ok')).toBe('Say why this paper stands for the month. The reason is kept on the record.')
    expect(lienApplyReasonProblem(checks.warnings, 'Its total held this job’s unpaid bill.')).toBe('')
    // A month the paper prints, with the contractor's copy on record, asks for no reason.
    const clean = lienApplyChecks({ paper: oct14, months: ['2026-08'], noticedMonths: [], propertyKind: 'residential' })
    expect(clean).toEqual({ refusals: [], warnings: [] })
    expect(lienApplyReasonProblem(clean.warnings, '')).toBe('')
  })

  it('refuses no month, a month already noticed, a paper that went before the month began, and a paper with no send to the owner', () => {
    expect(lienApplyChecks({ paper: sep22, months: [], noticedMonths: [], propertyKind: 'residential' }).refusals).toEqual(['Tick the month this paper stands for.'])
    expect(lienApplyChecks({ paper: sep22, months: ['2026-08'], noticedMonths: ['2026-08'], propertyKind: 'residential' }).refusals).toEqual(['August already has a notice on this job.'])
    expect(lienApplyChecks({ paper: sep22, months: ['2026-10'], noticedMonths: [], propertyKind: 'residential' }).refusals).toEqual(['The paper went Sep 22, before October began. It cannot be notice of that month’s work.'.replace('’', "'")])
    const noOwner = lienRecordedPapers([row({ sends: [{ recipient: 'original_contractor', method: 'mail', tracking: '', sent_on: '2026-09-22' }] })], { thisJobId: 'j4107', jobLabel: label })[0]!
    expect(lienApplyChecks({ paper: noOwner, months: ['2026-09'], noticedMonths: [], propertyKind: 'residential' }).refusals).toEqual(['This paper has no dated send to the owner on record. Add the day it went to the paper first.'])
  })

  it('says when the paper went after the month’s deadline, or before the job’s last day of work', () => {
    // Residential: June's notice is due Aug 15, which fell on a Saturday in 2026, so Aug 17.
    const late = lienApplyChecks({ paper: sep22, months: ['2026-06'], noticedMonths: [], propertyKind: 'residential' })
    expect(late.refusals).toEqual([])
    expect(late.warnings[0]).toBe("The paper went Sep 22, after June's deadline of Aug 17. It reads as late.")
    const early = lienApplyChecks({ paper: sep22, months: ['2026-09'], noticedMonths: [], propertyKind: 'residential', lastWorkYmd: '2026-09-28' })
    expect(early.warnings).toContain("The paper went Sep 22, before this job's last day of work, Sep 28.")
  })

  it('writes one row on this job that points at the paper and keeps the paper’s own facts', () => {
    const payload = lienApplyPayload({ paper: sep22, job: { id: 'j4107', amount: 1_900 }, months: ['2026-09'], reason: '  Its total held this job’s unpaid bill. ', userId: 'u1', userName: 'Dana' })
    expect(payload).toEqual({
      job_id: 'j4107',
      created_by: 'u1',
      kind: 'notice_53_056',
      amount: 1_900,
      months_covered: ['2026-09'],
      fields: { claimAmount: '12400.00' },
      sends: [owner],
      by_hand: true,
      packet_id: 'p1',
      printed_claim: 12_400,
      document_url: 'https://drive.example/larkspur',
      applied_from: 'f1',
      applied_from_label: '4101',
      applied_reason: 'Its total held this job’s unpaid bill.',
      applied_by_name: 'Dana',
    })
    // The paper claimed this job's own amount: no printed total beside it, and no link key when none is kept.
    const one = lienApplyPayload({ paper: { ...oct14, claimAsPrinted: 2_150 }, job: { id: 'j4107', amount: 2_150 }, months: ['2026-08'], reason: '', userId: null, userName: '' })
    expect(one.printed_claim).toBeNull()
    expect(one).not.toHaveProperty('document_url')
  })

  it('words the paper, the applied row and the button', () => {
    expect(lienPaperWords(sep22)).toEqual({ head: 'Sep 22 · certified mail · $12,400', detail: 'On jobs 4101 and 4112 · names Jun, Jul and Aug · to the owner' })
    expect(lienPaperWords(oct14).detail).toBe('On job 4112 · names Aug · to the owner and the contractor')
    expect(lienAppliedRowWords({ applied_from: 'f1', applied_from_label: '4101', applied_by_name: 'Dana' }, '2026-11-16')).toBe('as part of the notice on job 4101 · applied by Dana, Nov 16')
    expect(lienAppliedRowWords({ applied_from: null }, '2026-11-16')).toBe('')
    expect(lienApplyButtonWords(sep22, '4107')).toBe('Apply the Sep 22 notice to job 4107')
    expect(lienApplyButtonWords(null, '4107')).toBe('Pick the paper that went')
  })

  it('knows one property on two saved records, and never joins two owners on one street', () => {
    const a = { addressId: 'a1', parcelId: '355001', county: 'Bexar', ownerName: 'PAT QUILL', address: '14 Larkspur Ln, Helotes, TX' }
    expect(sameLienProperty(a, { ...a })).toBe(true)
    expect(sameLienProperty(a, { ...a, addressId: 'a2' })).toBe(true)
    expect(sameLienProperty(a, { ...a, addressId: 'a2', county: 'Medina' })).toBe(false)
    expect(sameLienProperty(a, { ...a, addressId: 'a2', parcelId: '999' })).toBe(false)
    // No parcel on either: the street and the owner's name together.
    expect(sameLienProperty({ ...a, parcelId: '' }, { ...a, addressId: 'a2', parcelId: '', ownerName: 'Pat  Quill' })).toBe(true)
    expect(sameLienProperty({ ...a, parcelId: '' }, { ...a, addressId: 'a2', parcelId: '', ownerName: 'Someone Else' })).toBe(false)
    expect(sameLienProperty({ ...a, parcelId: '', ownerName: '' }, { ...a, addressId: 'a2', parcelId: '', ownerName: '' })).toBe(false)
  })

  it('marks a desk item set aside and takes the mark off again', () => {
    const mark = { filingId: 'new', at: '2026-11-16T22:00:00Z', by: 'u1', byName: 'Dana', sentOn: '2026-09-22', fromLabel: '4101' }
    const set = fieldsWithSetAside({ gcEmail: 'gc@example.com' }, mark)
    expect(set).toEqual({ gcEmail: 'gc@example.com', setAsideNoticed: mark })
    expect(fieldsWithoutSetAside(set)).toEqual({ gcEmail: 'gc@example.com' })
    expect(fieldsWithoutSetAside(null)).toEqual({})
    // Set aside only when every month the waiting notice names has a notice afterwards.
    expect(lienApplySetsAside(['2026-09'], ['2026-09'], [])).toBe(true)
    expect(lienApplySetsAside(['2026-08', '2026-09'], ['2026-09'], ['2026-08'])).toBe(true)
    expect(lienApplySetsAside(['2026-08', '2026-09'], ['2026-09'], [])).toBe(false)
    expect(lienApplySetsAside([], ['2026-09'], [])).toBe(false)
  })

  it('offers a missed notice’s closed months to tick when nothing is still due, and only the notice’s own months elsewhere (v2.8027)', () => {
    // A missed notice with nothing due: its own months were empty, so the closed months the desk calls missed are offered, oldest first.
    expect(lienApplyMonthsOffered({ pile: 'missed', months: [], dueMonths: [], missedMonths: ['2026-07', '2026-05'] })).toEqual(['2026-05', '2026-07'])
    // A month already on the notice is offered once.
    expect(lienApplyMonthsOffered({ pile: 'missed', months: ['2026-05'], dueMonths: [], missedMonths: ['2026-05', '2026-06'] })).toEqual(['2026-05', '2026-06'])
    // A missed notice with a month still due is a draft: the step opens with that month alone, as before.
    expect(lienApplyMonthsOffered({ pile: 'missed', months: ['2026-09'], dueMonths: ['2026-09'], missedMonths: ['2026-07'] })).toEqual(['2026-09'])
    // Every other pile keeps the notice's own months, a closed month beside them or not.
    expect(lienApplyMonthsOffered({ pile: 'to_draft', months: ['2026-09'], dueMonths: ['2026-09'], missedMonths: ['2026-07'] })).toEqual(['2026-09'])
    expect(lienApplyMonthsOffered({ pile: 'sent', months: [], dueMonths: [], missedMonths: [] })).toEqual([])
  })

  it('starts the step blank only on a missed notice with no month still due', () => {
    // The months offered there are closed ones the desk is not asking for: the office says which the paper stood for.
    expect(lienApplyStartsBlank({ pile: 'missed', dueMonths: [] })).toBe(true)
    // A missed notice with a month still due opens on that month, ticked, as a draft does.
    expect(lienApplyStartsBlank({ pile: 'missed', dueMonths: ['2026-09'] })).toBe(false)
    // Every other pile keeps its own months ticked and a lone paper picked.
    for (const pile of ['to_draft', 'awaiting', 'ready', 'printed', 'held', 'sent']) {
      expect(lienApplyStartsBlank({ pile, dueMonths: ['2026-09'] })).toBe(false)
      expect(lienApplyStartsBlank({ pile, dueMonths: [] })).toBe(false)
    }
  })
})
