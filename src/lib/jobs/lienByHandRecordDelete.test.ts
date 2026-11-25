import { describe, expect, it } from 'vitest'
import { LIEN_BY_HAND_RECORD_DELETED, lienByHandDeleteConfirm, lienByHandDeleteDrawn, lienByHandDeleteProblem, lienByHandRecordWords, lienByHandTiesProblem, lienVoidedByHandRecords, type LienByHandRecord, type LienRecordTies } from './lienByHandRecordDelete'

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
  it('names the act on the confirm button, says how many go, and that the Activity line stays', () => {
    expect(lienByHandDeleteConfirm(0)).toEqual({ title: 'Delete this notice record?', message: '1 record is deleted, for good. Its line on the job’s Activity stays.', confirmLabel: 'Delete the record' })
    expect(lienByHandDeleteConfirm(1).message).toBe('1 record is deleted, for good. Its line on the job’s Activity stays. 1 other record of the same paper, on another job, stays.')
    expect(lienByHandDeleteConfirm(3).message).toContain('3 other records of the same paper, on other jobs, stay.')
    expect(LIEN_BY_HAND_RECORD_DELETED).toBe('The record was deleted. Its line on the job’s Activity stays.')
  })
})
