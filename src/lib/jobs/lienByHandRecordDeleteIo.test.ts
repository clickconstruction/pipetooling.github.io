import { beforeEach, describe, expect, it, vi } from 'vitest'

/** What the database answers each table's statements in turn, and every call each statement made on its query, in order. */
const db = vi.hoisted(() => ({
  answers: {} as Record<string, Array<{ data: unknown; error: unknown; count?: number | null }>>,
  statements: [] as Array<{ table: string; calls: Array<[string, unknown[]]> }>,
}))

vi.mock('../supabase', () => {
  const builder = (table: string) => {
    const statement = { table, calls: [] as Array<[string, unknown[]]> }
    db.statements.push(statement)
    const b: Record<string, unknown> = new Proxy(
      {},
      {
        get: (_t, op: string) => {
          if (op === 'then') {
            return (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(db.answers[table]?.shift() ?? { data: [], error: null, count: 0 }).then(resolve, reject)
          }
          return (...args: unknown[]) => {
            statement.calls.push([op, args])
            return b
          }
        },
      },
    )
    return b
  }
  return { supabase: { from: (table: string) => builder(table) } }
})

import { countLienPacketSiblings, deleteLienByHandRecord, readLienRecordTies } from './lienByHandRecordDeleteIo'

const REC = 'aaaaaaaa-1111-4111-8111-111111111111'
const JOB = 'cccccccc-3333-4333-8333-333333333333'
const row = (over: Record<string, unknown> = {}) => ({ id: REC, job_id: JOB, kind: 'notice_53_056', by_hand: true, voided_at: '2026-11-24T20:00:00Z', packet_id: 'p1', ...over })
const ok = (data: unknown, count: number | null = null) => ({ data, error: null, count })
const ZZ_JOB = ok([{ id: JOB, job_name: 'ZZ Test lien walk', customer_name: 'ZZ Test Customer' }])
const deletes = () => db.statements.filter((s) => s.calls.some(([op]) => op === 'delete'))

beforeEach(() => {
  db.answers = {}
  db.statements.length = 0
})

describe('readLienRecordTies', () => {
  it('counts what points at a record in the four places', async () => {
    db.answers = { job_lien_desk_items: [ok([], 1)], jobs_ledger_invoices: [ok([], 0)], job_lien_filings: [ok([], 2)], sent_documents: [ok([], 0)] }
    expect(await readLienRecordTies(REC)).toEqual({ deskPapers: 1, bills: 0, appliedFrom: 2, sentCopies: 0 })
    const by = (table: string) => db.statements.find((s) => s.table === table)?.calls
    expect(by('job_lien_desk_items')).toContainEqual(['eq', ['sent_filing_id', REC]])
    expect(by('jobs_ledger_invoices')).toContainEqual(['eq', ['lien_offer_filing_id', REC]])
    expect(by('job_lien_filings')).toContainEqual(['eq', ['applied_from', REC]])
    expect(by('sent_documents')).toEqual([
      ['select', ['id', { count: 'exact' }]],
      ['eq', ['source_table', 'job_lien_filings']],
      ['eq', ['source_id', REC]],
      ['limit', [1]],
    ])
  })
  it('throws when a count fails or answers nothing', async () => {
    db.answers = { jobs_ledger_invoices: [{ data: null, error: { message: 'no signal' } }] }
    await expect(readLienRecordTies(REC)).rejects.toEqual({ message: 'no signal' })
    db.answers = { sent_documents: [ok([], null)] }
    await expect(readLienRecordTies(REC)).rejects.toThrow(/could not be read/)
  })
})

describe('countLienPacketSiblings', () => {
  it('counts the other records of the same paper, and none for a record with no packet', async () => {
    db.answers = { job_lien_filings: [ok([], 2)] }
    expect(await countLienPacketSiblings({ id: REC, packet_id: 'p1' })).toBe(2)
    expect(db.statements[0]?.calls).toEqual([
      ['select', ['id', { count: 'exact' }]],
      ['eq', ['packet_id', 'p1']],
      ['neq', ['id', REC]],
      ['limit', [1]],
    ])
    db.statements.length = 0
    expect(await countLienPacketSiblings({ id: REC, packet_id: null })).toBe(0)
    expect(db.statements).toEqual([])
  })
})

describe('deleteLienByHandRecord', () => {
  it('reads the record and its job again, then its ties, then deletes the one voided by-hand notice', async () => {
    // job_lien_filings answers in order: the record, the applied-from count, the delete.
    db.answers = { job_lien_filings: [ok([row()]), ok([], 0), ok([{ id: REC }])], jobs_ledger: [ZZ_JOB] }
    await deleteLienByHandRecord(REC)
    expect(deletes()).toHaveLength(1)
    expect(deletes()[0]?.calls).toEqual([
      ['delete', []],
      ['eq', ['id', REC]],
      ['eq', ['kind', 'notice_53_056']],
      ['eq', ['by_hand', true]],
      ['not', ['voided_at', 'is', null]],
      ['select', ['id']],
    ])
  })
  it('refuses a record on a real job, before its ties are read, and deletes nothing', async () => {
    db.answers = { job_lien_filings: [ok([row()])], jobs_ledger: [ok([{ id: JOB, job_name: 'Larkfield Lot 9', customer_name: 'Larkfield Homes' }])] }
    await expect(deleteLienByHandRecord(REC)).rejects.toThrow('Only a record on a test job can be deleted. This job is a real one.')
    expect(db.statements.map((s) => s.table)).toEqual(['job_lien_filings', 'jobs_ledger'])
  })
  it('refuses a live record, a record the run made, and a record that is gone', async () => {
    db.answers = { job_lien_filings: [ok([row({ voided_at: null })])], jobs_ledger: [ZZ_JOB] }
    await expect(deleteLienByHandRecord(REC)).rejects.toThrow('Void this record first.')
    db.answers = { job_lien_filings: [ok([row({ by_hand: false })])], jobs_ledger: [ZZ_JOB] }
    await expect(deleteLienByHandRecord(REC)).rejects.toThrow('Only a notice recorded by hand can be deleted.')
    db.answers = { job_lien_filings: [ok([])] }
    await expect(deleteLienByHandRecord(REC)).rejects.toThrow(/not there any more/)
    expect(deletes()).toHaveLength(0)
  })
  it('refuses a record something points at, and deletes nothing', async () => {
    db.answers = { job_lien_filings: [ok([row()]), ok([], 0)], jobs_ledger: [ZZ_JOB], job_lien_desk_items: [ok([], 1)] }
    await expect(deleteLienByHandRecord(REC)).rejects.toThrow('A paper on the Lien desk is tied to this record. It stays.')
    db.answers = { job_lien_filings: [ok([row()]), ok([], 1)], jobs_ledger: [ZZ_JOB] }
    await expect(deleteLienByHandRecord(REC)).rejects.toThrow('Another record was applied from this one. It stays.')
    expect(deletes()).toHaveLength(0)
  })
  it('says so when the delete reaches no row, as a row policy refuses', async () => {
    db.answers = { job_lien_filings: [ok([row()]), ok([], 0), ok([])], jobs_ledger: [ZZ_JOB] }
    await expect(deleteLienByHandRecord(REC)).rejects.toThrow(/was not deleted/)
  })
  it('deletes nothing when the ties cannot be read', async () => {
    db.answers = { job_lien_filings: [ok([row()]), ok([], 0)], jobs_ledger: [ZZ_JOB], sent_documents: [{ data: null, error: { message: 'no signal' } }] }
    await expect(deleteLienByHandRecord(REC)).rejects.toEqual({ message: 'no signal' })
    expect(deletes()).toHaveLength(0)
  })
})
