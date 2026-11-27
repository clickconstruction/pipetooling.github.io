/**
 * Voided test bills (punch list #443, row 7): the one read, against a fake client. It asks the table for one job's
 * records, newest first, and answers an empty list whenever it has no rows to give: no record, a reader the policy
 * returns nothing to, a table that is not on the database yet, a lost signal. Made-up names.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** What the database answers the statement, and every call the statement made on its query, in order. */
const db = vi.hoisted(() => ({
  answer: { data: null, error: null } as { data: unknown; error: unknown },
  throws: null as null | Error,
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
            return (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => (db.throws ? Promise.reject(db.throws) : Promise.resolve(db.answer)).then(resolve, reject)
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

import { readVoidedTestBills } from './voidedTestBillsIo'
import { VOIDED_TEST_BILLS_COLS } from './voidedTestBills'

const JOB = 'cccccccc-3333-4333-8333-333333333333'
const row = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  invoice_id: `bill-${id}`,
  job_id: JOB,
  bill: { id: `bill-${id}`, job_id: JOB, amount: 80 },
  sends: [],
  stripe_invoice_id: 'in_test_zz1',
  stripe_action: 'void',
  voided_by_name: 'ZZ Test Dev',
  voided_at: '2026-11-25T16:30:00Z',
  ...over,
})

beforeEach(() => {
  db.answer = { data: null, error: null }
  db.throws = null
  db.statements.length = 0
})

describe('readVoidedTestBills', () => {
  it('asks the table for the job’s records, the newest void first', async () => {
    db.answer = { data: [row('r2'), row('r1')], error: null }
    const bills = await readVoidedTestBills(JOB)
    expect(bills.map((b) => b.id)).toEqual(['r2', 'r1'])
    expect(bills[0]).toMatchObject({ invoiceId: 'bill-r2', amount: 80, voidedBy: 'ZZ Test Dev', stripeWords: 'Voided in Stripe' })
    expect(db.statements).toHaveLength(1)
    expect(db.statements[0]?.table).toBe('voided_test_bills')
    expect(db.statements[0]?.calls).toEqual([
      ['select', [VOIDED_TEST_BILLS_COLS]],
      ['eq', ['job_id', JOB]],
      ['order', ['voided_at', { ascending: false }]],
      ['limit', [50]],
    ])
  })
  it('answers none for a job with no record', async () => {
    db.answer = { data: [], error: null }
    expect(await readVoidedTestBills(JOB)).toEqual([])
  })
  it('answers none when the table is not on the database yet', async () => {
    // What PostgREST answers for a table it does not know, before the migration is pushed.
    db.answer = { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.voided_test_bills' in the schema cache" } }
    expect(await readVoidedTestBills(JOB)).toEqual([])
  })
  it('answers none when the read is refused, and when the signal is lost', async () => {
    db.answer = { data: null, error: { code: '42501', message: 'permission denied for table voided_test_bills' } }
    expect(await readVoidedTestBills(JOB)).toEqual([])
    db.throws = new TypeError('Failed to fetch')
    expect(await readVoidedTestBills(JOB)).toEqual([])
  })
  it('leaves out a row it cannot read, and reads an answer that is no list as none', async () => {
    db.answer = { data: [row('r1'), { voided_at: '2026-11-25T16:30:00Z' }, null], error: null }
    expect((await readVoidedTestBills(JOB)).map((b) => b.id)).toEqual(['r1'])
    db.answer = { data: { id: 'r1' }, error: null }
    expect(await readVoidedTestBills(JOB)).toEqual([])
  })
  it('asks nothing with no job', async () => {
    expect(await readVoidedTestBills('')).toEqual([])
    expect(db.statements).toHaveLength(0)
  })
})
