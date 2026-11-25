import { beforeEach, describe, expect, it, vi } from 'vitest'

/** What the database answers each statement in turn, and every call each statement made on its query, in order. */
const db = vi.hoisted(() => ({
  answers: [] as Array<{ data: unknown; error: unknown }>,
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
            return (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(db.answers.shift() ?? { data: null, error: null }).then(resolve, reject)
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

import { deleteByHandRecord, readByHandRecordRow } from './byHandRecordDeleteIo'

const REC = 'aaaaaaaa-1111-4111-8111-111111111111'
const BILL = 'bbbbbbbb-2222-4222-8222-222222222222'
const JOB = 'cccccccc-3333-4333-8333-333333333333'
const copy = (over: Record<string, unknown> = {}) => ({ id: REC, kind: 'bill_by_hand', copy_path: null, source_table: 'jobs_ledger_invoices', source_id: BILL, ...over })
const ok = (data: unknown) => ({ data, error: null })
const tables = () => db.statements.map((s) => s.table)

beforeEach(() => {
  db.answers.length = 0
  db.statements.length = 0
})

describe('readByHandRecordRow', () => {
  it('reads the record, then its bill, then the bill’s job', async () => {
    db.answers.push(ok([copy()]), ok([{ id: BILL, job_id: JOB, stripe_mode: null }]), ok([{ id: JOB, job_name: 'ZZ Test walk job', customer_name: 'ZZ Test Customer' }]))
    expect(await readByHandRecordRow(REC)).toEqual({ kind: 'bill_by_hand', copyPath: null, sourceTable: 'jobs_ledger_invoices', bill: { id: BILL, stripeMode: null }, job: { job_name: 'ZZ Test walk job', customer_name: 'ZZ Test Customer' } })
    expect(tables()).toEqual(['sent_documents', 'jobs_ledger_invoices', 'jobs_ledger'])
    expect(db.statements[0]?.calls).toEqual([
      ['select', ['id, kind, copy_path, source_table, source_id']],
      ['eq', ['id', REC]],
      ['limit', [1]],
    ])
    expect(db.statements[1]?.calls[1]).toEqual(['eq', ['id', BILL]])
    expect(db.statements[2]?.calls[1]).toEqual(['eq', ['id', JOB]])
  })
  it('answers null for a record that is not there, and reads no bill', async () => {
    db.answers.push(ok([]))
    expect(await readByHandRecordRow(REC)).toBeNull()
    expect(tables()).toEqual(['sent_documents'])
  })
  it('leaves the bill and the job null when they do not read, or the record names another table', async () => {
    db.answers.push(ok([copy({ source_table: 'gc_statements' })]))
    expect(await readByHandRecordRow(REC)).toMatchObject({ sourceTable: 'gc_statements', bill: null, job: null })
    db.answers.push(ok([copy()]), ok([]))
    expect(await readByHandRecordRow(REC)).toMatchObject({ bill: null, job: null })
    db.answers.push(ok([copy()]), ok([{ id: BILL, job_id: JOB, stripe_mode: 'test' }]), ok([]))
    expect(await readByHandRecordRow(REC)).toMatchObject({ bill: { id: BILL, stripeMode: 'test' }, job: null })
  })
})

describe('deleteByHandRecord', () => {
  it('reads the record again, then deletes the one by-hand row with no copy', async () => {
    db.answers.push(ok([copy()]), ok([{ id: BILL, job_id: JOB, stripe_mode: null }]), ok([{ id: JOB, job_name: 'ZZ Test walk job', customer_name: '' }]), ok([{ id: REC }]))
    await deleteByHandRecord(REC)
    expect(tables()).toEqual(['sent_documents', 'jobs_ledger_invoices', 'jobs_ledger', 'sent_documents'])
    expect(db.statements[3]?.calls).toEqual([
      ['delete', []],
      ['eq', ['id', REC]],
      ['eq', ['kind', 'bill_by_hand']],
      ['is', ['copy_path', null]],
      ['select', ['id']],
    ])
  })
  it('refuses a record of a real bill, and deletes nothing', async () => {
    db.answers.push(ok([copy()]), ok([{ id: BILL, job_id: JOB, stripe_mode: null }]), ok([{ id: JOB, job_name: 'Kitchen repipe', customer_name: 'Larkfield Homes' }]))
    await expect(deleteByHandRecord(REC)).rejects.toThrow('Only a record of a test bill can be deleted. This bill is a real one.')
    expect(tables()).toEqual(['sent_documents', 'jobs_ledger_invoices', 'jobs_ledger'])
  })
  it('refuses any other kind of sent copy, and deletes nothing', async () => {
    db.answers.push(ok([copy({ kind: 'bill' })]), ok([{ id: BILL, job_id: JOB, stripe_mode: 'test' }]), ok([{ id: JOB, job_name: 'ZZ Test walk job', customer_name: '' }]))
    await expect(deleteByHandRecord(REC)).rejects.toThrow('Only a record made by hand can be deleted.')
    expect(tables().filter((t) => t === 'sent_documents')).toHaveLength(1)
  })
  it('refuses when the record is gone, or its bill does not read', async () => {
    db.answers.push(ok([]))
    await expect(deleteByHandRecord(REC)).rejects.toThrow(/not there any more/)
    db.answers.push(ok([copy()]), ok([]))
    await expect(deleteByHandRecord(REC)).rejects.toThrow(/could not be read/)
  })
  it('says so when the delete reaches no row, as a row policy refuses', async () => {
    db.answers.push(ok([copy()]), ok([{ id: BILL, job_id: null, stripe_mode: 'test' }]), ok([]))
    await expect(deleteByHandRecord(REC)).rejects.toThrow(/was not deleted/)
  })
  it('deletes nothing when a read fails', async () => {
    db.answers.push({ data: null, error: { message: 'no signal', code: '' } })
    await expect(deleteByHandRecord(REC)).rejects.toBeTruthy()
    expect(tables().every((t) => t === 'sent_documents')).toBe(true)
    expect(db.statements.some((s) => s.calls.some(([op]) => op === 'delete'))).toBe(false)
  })
})
