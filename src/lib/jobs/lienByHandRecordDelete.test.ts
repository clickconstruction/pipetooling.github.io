import { describe, expect, it } from 'vitest'
import {
  LIEN_BY_HAND_RECORD_DELETED,
  LIEN_NOTICE_ACTIVITY_EVENT,
  lienByHandDeleteConfirm,
  lienByHandDeleteDrawn,
  lienByHandDeleteProblem,
  lienByHandRecordWords,
  lienByHandTiesProblem,
  lienNoticeLineRecordId,
  lienNoticeStrayClearConfirm,
  lienNoticeStrayClearedWords,
  lienNoticeStrayLines,
  lienNoticeStrayLinesDrawn,
  lienVoidedByHandRecords,
  type LienByHandRecord,
  type LienRecordTies,
} from './lienByHandRecordDelete'
import { plainWordsFailures } from '../plainWords'

const record = (over: Partial<LienByHandRecord> = {}): LienByHandRecord => ({ id: 'f1', job_id: 'j1', kind: 'notice_53_056', by_hand: true, voided_at: '2026-11-24T20:00:00Z', packet_id: 'p1', ...over })
const ZZ = { job_name: 'ZZ Test lien walk', customer_name: 'ZZ Test Customer' }
const REAL = { job_name: 'Larkfield Lot 9', customer_name: 'Larkfield Homes' }
const ties = (over: Partial<LienRecordTies> = {}): LienRecordTies => ({ deskPapers: 0, bills: 0, appliedFrom: 0, sentCopies: 0, ...over })

describe('lienByHandDeleteDrawn', () => {
  it('draws the list for a dev and for no other role', () => {
    expect(lienByHandDeleteDrawn('dev')).toBe(true)
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers', '', null, undefined]) expect(lienByHandDeleteDrawn(role)).toBe(false)
  })
})

describe('lienByHandDeleteProblem', () => {
  it('lets a voided by-hand notice on a test job go on to its ties', () => {
    expect(lienByHandDeleteProblem(record(), ZZ)).toBe('')
    expect(lienByHandDeleteProblem(record(), { job_name: 'Kitchen repipe', customer_name: 'zz test customer' })).toBe('')
  })
  it('refuses a record on a real job, and a job that did not read', () => {
    expect(lienByHandDeleteProblem(record(), REAL)).toBe('Only a record on a test job can be deleted. This job is a real one.')
    expect(lienByHandDeleteProblem(record(), null)).toMatch(/real one/)
  })
  it('refuses a live record: the void comes first', () => {
    expect(lienByHandDeleteProblem(record({ voided_at: null }), ZZ)).toBe('Void this record first.')
  })
  it('refuses every record that is not a notice recorded by hand', () => {
    expect(lienByHandDeleteProblem(record({ by_hand: false }), ZZ)).toBe('Only a notice recorded by hand can be deleted.')
    for (const kind of ['affidavit', 'retainage_53_057', 'release_of_lien']) expect(lienByHandDeleteProblem(record({ kind }), ZZ)).toBe('Only a notice recorded by hand can be deleted.')
  })
  it('says a record that is gone is gone', () => {
    expect(lienByHandDeleteProblem(null, ZZ)).toBe('The record is not there any more. Read the window again.')
  })
})

describe('lienByHandTiesProblem', () => {
  it('lets a record nothing points at go', () => {
    expect(lienByHandTiesProblem(ties())).toBe('')
  })
  it('keeps a record a desk paper, a bill, another record or a sent copy points at, and says which', () => {
    expect(lienByHandTiesProblem(ties({ deskPapers: 1 }))).toBe('A paper on the Lien desk is tied to this record. It stays.')
    expect(lienByHandTiesProblem(ties({ deskPapers: 2 }))).toBe('2 papers on the Lien desk are tied to this record. It stays.')
    expect(lienByHandTiesProblem(ties({ bills: 1 }))).toBe('A bill’s pay offer names this record. It stays.')
    expect(lienByHandTiesProblem(ties({ bills: 3 }))).toBe('The pay offers of 3 bills name this record. It stays.')
    expect(lienByHandTiesProblem(ties({ appliedFrom: 1 }))).toBe('Another record was applied from this one. It stays.')
    expect(lienByHandTiesProblem(ties({ sentCopies: 1 }))).toBe('A sent copy names this record. It stays.')
  })
  it('never deletes on ties that could not be read', () => {
    expect(lienByHandTiesProblem(null)).toBe('What points at this record could not be read. Nothing was deleted.')
    expect(lienByHandTiesProblem(ties({ bills: Number.NaN }))).toMatch(/could not be read/)
    expect(lienByHandTiesProblem(ties({ sentCopies: -1 }))).toMatch(/could not be read/)
  })
})

describe('lienVoidedByHandRecords', () => {
  it('keeps the voided notices recorded by hand, newest voided first', () => {
    const rows = [
      { id: 'live', kind: 'notice_53_056', by_hand: true, voided_at: null },
      { id: 'older', kind: 'notice_53_056', by_hand: true, voided_at: '2026-11-23T20:00:00Z' },
      { id: 'run', kind: 'notice_53_056', by_hand: false, voided_at: '2026-11-24T20:00:00Z' },
      { id: 'newer', kind: 'notice_53_056', by_hand: true, voided_at: '2026-11-24T21:00:00Z' },
      { id: 'aff', kind: 'affidavit', by_hand: true, voided_at: '2026-11-24T22:00:00Z' },
    ]
    expect(lienVoidedByHandRecords(rows).map((r) => r.id)).toEqual(['newer', 'older'])
  })
})

describe('the words', () => {
  it('reads a record’s months and days', () => {
    expect(lienByHandRecordWords({ months_covered: ['2026-08'], created_at: '2026-11-23T18:00:00Z', voided_at: '2026-11-24T20:00:00Z' })).toBe('Covers 2026-08. Recorded Mon, Nov 23. Voided Tue, Nov 24.')
    expect(lienByHandRecordWords({ months_covered: [], created_at: '2026-11-23T18:00:00Z', voided_at: null })).toBe('Recorded Mon, Nov 23.')
  })
  it('names the act on the confirm button, says how many go, and that the Activity line goes with the record', () => {
    expect(lienByHandDeleteConfirm(0)).toEqual({ title: 'Delete this notice record?', message: '1 record is deleted, for good. Its line on the job’s Activity goes with it.', confirmLabel: 'Delete the record' })
    expect(lienByHandDeleteConfirm(1).message).toBe('1 record is deleted, for good. Its line on the job’s Activity goes with it. 1 other record of the same paper, on another job, stays.')
    expect(lienByHandDeleteConfirm(3).message).toContain('3 other records of the same paper, on other jobs, stay.')
    expect(LIEN_BY_HAND_RECORD_DELETED).toBe('The record was deleted. Its line on the job’s Activity went with it.')
  })
  it('never says the Activity line stays', () => {
    for (const words of [lienByHandDeleteConfirm(0).message, lienByHandDeleteConfirm(2).message, LIEN_BY_HAND_RECORD_DELETED]) expect(words).not.toMatch(/Activity stays/)
  })
})

describe('the Activity lines of deleted notice records', () => {
  const line = (id: string, detail: unknown) => ({ id, detail })
  const filings = [{ id: 'aaaaaaaa-1111-4111-8111-111111111111' }, { id: 'bbbbbbbb-2222-4222-8222-222222222222' }]

  it('reads the record a line names from its detail, and none from a detail that names none', () => {
    expect(LIEN_NOTICE_ACTIVITY_EVENT).toBe('lien_notice_sent')
    expect(lienNoticeLineRecordId(line('l1', { source_id: ' f1 ', filing_id: 'f1' }))).toBe('f1')
    for (const detail of [null, undefined, 'f1', 7, [], ['f1'], {}, { source_id: null }, { source_id: 7 }, { source_id: '  ' }]) expect(lienNoticeLineRecordId(line('l1', detail))).toBe('')
  })
  it('keeps the lines whose record is not among the job’s records, voided ones counted', () => {
    const lines = [
      line('stands', { source_id: 'aaaaaaaa-1111-4111-8111-111111111111' }),
      line('stands-in-capitals', { source_id: 'BBBBBBBB-2222-4222-8222-222222222222' }),
      line('gone', { source_id: 'cccccccc-3333-4333-8333-333333333333' }),
      line('gone-too', { source_id: 'dddddddd-4444-4444-8444-444444444444' }),
      line('names-nothing', {}),
      line('no-detail', null),
    ]
    expect(lienNoticeStrayLines(lines, filings).map((l) => l.id)).toEqual(['gone', 'gone-too'])
    expect(lienNoticeStrayLines(lines, [])).toHaveLength(4)
    expect(lienNoticeStrayLines([], filings)).toEqual([])
  })
  it('is offered to a dev on a test job, and to nobody on a real job', () => {
    expect(lienNoticeStrayLinesDrawn('dev', ZZ)).toBe(true)
    expect(lienNoticeStrayLinesDrawn('dev', { job_name: 'Kitchen repipe', customer_name: 'zz test customer' })).toBe(true)
    expect(lienNoticeStrayLinesDrawn('dev', REAL)).toBe(false)
    expect(lienNoticeStrayLinesDrawn('dev', null)).toBe(false)
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers', '', null, undefined]) expect(lienNoticeStrayLinesDrawn(role, ZZ)).toBe(false)
  })
  it('names the act and its count on the confirm button', () => {
    expect(lienNoticeStrayClearConfirm(1)).toEqual({
      title: 'Clear this Activity line?',
      message: '1 line is deleted from the job’s Activity, for good. It names a notice record that was deleted. Every other line stays.',
      confirmLabel: 'Clear 1 line',
    })
    expect(lienNoticeStrayClearConfirm(3)).toEqual({
      title: 'Clear these 3 Activity lines?',
      message: '3 lines are deleted from the job’s Activity, for good. Each names a notice record that was deleted. Every other line stays.',
      confirmLabel: 'Clear 3 lines',
    })
  })
  it('says how many lines the function cleared, and says so when it cleared none', () => {
    expect(lienNoticeStrayClearedWords(1)).toBe('1 Activity line was cleared.')
    expect(lienNoticeStrayClearedWords(3)).toBe('3 Activity lines were cleared.')
    expect(lienNoticeStrayClearedWords(0)).toBe('No Activity line was cleared. The database found no line whose record is gone.')
    expect(lienNoticeStrayClearedWords(Number.NaN)).toMatch(/^No Activity line was cleared\./)
  })
  it('keeps every sentence a first-timer reads to the plain-words rules', () => {
    const words = [lienByHandDeleteConfirm(0).message, lienByHandDeleteConfirm(2).message, LIEN_BY_HAND_RECORD_DELETED, lienNoticeStrayClearConfirm(1).message, lienNoticeStrayClearConfirm(4).message, lienNoticeStrayClearedWords(0), lienNoticeStrayClearedWords(2)]
    for (const w of words) expect(plainWordsFailures(w)).toEqual([])
  })
})
