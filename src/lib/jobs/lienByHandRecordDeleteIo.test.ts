import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * What the database answers each table's statements in turn, and every call each statement made on its query, in
 * order. `rpcs` is every function called, in order with the statements (`log`), and `rpcAnswers` what each answers.
 */
const db = vi.hoisted(() => ({
  answers: {} as Record<string, Array<{ data: unknown; error: unknown; count?: number | null }>>,
  statements: [] as Array<{ table: string; calls: Array<[string, unknown[]]> }>,
  rpcs: [] as Array<{ fn: string; args: unknown }>,
  rpcAnswers: [] as Array<{ data: unknown; error: unknown }>,
  log: [] as string[],
}))

vi.mock('../supabase', () => {
  const builder = (table: string) => {
    const statement = { table, calls: [] as Array<[string, unknown[]]> }
    db.statements.push(statement)
    db.log.push(table)
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
  return {
    supabase: {
      from: (table: string) => builder(table),
      rpc: (fn: string, args: unknown) => {
        db.rpcs.push({ fn, args })
        db.log.push(`rpc ${fn}`)
        return Promise.resolve(db.rpcAnswers.shift() ?? { data: { ok: true, job_id: 'cccccccc-3333-4333-8333-333333333333', activity_lines: 1 }, error: null })
      },
    },
  }
})

import { clearLienNoticeStrayLines, countLienPacketSiblings, deleteLienByHandRecord, readLienNoticeActivityLines, readLienRecordTies } from './lienByHandRecordDeleteIo'

const REC = 'aaaaaaaa-1111-4111-8111-111111111111'
const JOB = 'cccccccc-3333-4333-8333-333333333333'
const row = (over: Record<string, unknown> = {}) => ({ id: REC, job_id: JOB, kind: 'notice_53_056', by_hand: true, voided_at: '2026-11-24T20:00:00Z', packet_id: 'p1', ...over })
const ok = (data: unknown, count: number | null = null) => ({ data, error: null, count })
const ZZ_JOB = ok([{ id: JOB, job_name: 'ZZ Test lien walk', customer_name: 'ZZ Test Customer' }])
const deletes = () => db.statements.filter((s) => s.calls.some(([op]) => op === 'delete'))

beforeEach(() => {
  db.answers = {}
  db.statements.length = 0
  db.rpcs.length = 0
  db.rpcAnswers.length = 0
  db.log.length = 0
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
  it('reads the record and its job again, then its ties, then calls the one function with the record id, once', async () => {
    // job_lien_filings answers in order: the record, the applied-from count.
    db.answers = { job_lien_filings: [ok([row()]), ok([], 0)], jobs_ledger: [ZZ_JOB] }
    await deleteLienByHandRecord(REC)
    expect(db.rpcs).toEqual([{ fn: 'delete_test_lien_notice_record', args: { p_filing_id: REC } }])
    expect(db.log.slice(0, 2)).toEqual(['job_lien_filings', 'jobs_ledger'])
    expect(db.log.slice(2, 6).sort()).toEqual(['job_lien_desk_items', 'job_lien_filings', 'jobs_ledger_invoices', 'sent_documents'])
    expect(db.log.slice(6)).toEqual(['rpc delete_test_lien_notice_record'])
  })
  it('never deletes a row off the table itself: the function takes the record and its Activity line together', async () => {
    db.answers = { job_lien_filings: [ok([row()]), ok([], 0)], jobs_ledger: [ZZ_JOB] }
    await deleteLienByHandRecord(REC)
    expect(deletes()).toHaveLength(0)
    expect(db.statements.map((s) => s.table)).not.toContain('job_activity_events')
  })
  it('refuses a record on a real job, before its ties are read, and calls nothing', async () => {
    db.answers = { job_lien_filings: [ok([row()])], jobs_ledger: [ok([{ id: JOB, job_name: 'Larkfield Lot 9', customer_name: 'Larkfield Homes' }])] }
    await expect(deleteLienByHandRecord(REC)).rejects.toThrow('Only a record on a test job can be deleted. This job is a real one.')
    expect(db.statements.map((s) => s.table)).toEqual(['job_lien_filings', 'jobs_ledger'])
    expect(db.rpcs).toEqual([])
  })
  it('refuses a live record, a record the run made, and a record that is gone', async () => {
    db.answers = { job_lien_filings: [ok([row({ voided_at: null })])], jobs_ledger: [ZZ_JOB] }
    await expect(deleteLienByHandRecord(REC)).rejects.toThrow('Void this record first.')
    db.answers = { job_lien_filings: [ok([row({ by_hand: false })])], jobs_ledger: [ZZ_JOB] }
    await expect(deleteLienByHandRecord(REC)).rejects.toThrow('Only a notice recorded by hand can be deleted.')
    db.answers = { job_lien_filings: [ok([])] }
    await expect(deleteLienByHandRecord(REC)).rejects.toThrow(/not there any more/)
    expect(db.rpcs).toEqual([])
    expect(deletes()).toHaveLength(0)
  })
  it('refuses a record something points at, and calls nothing', async () => {
    db.answers = { job_lien_filings: [ok([row()]), ok([], 0)], jobs_ledger: [ZZ_JOB], job_lien_desk_items: [ok([], 1)] }
    await expect(deleteLienByHandRecord(REC)).rejects.toThrow('A paper on the Lien desk is tied to this record. It stays.')
    db.answers = { job_lien_filings: [ok([row()]), ok([], 1)], jobs_ledger: [ZZ_JOB] }
    await expect(deleteLienByHandRecord(REC)).rejects.toThrow('Another record was applied from this one. It stays.')
    expect(db.rpcs).toEqual([])
  })
  it('passes the function’s own refusal on in its words, and sends it once', async () => {
    db.answers = { job_lien_filings: [ok([row()]), ok([], 0)], jobs_ledger: [ZZ_JOB] }
    db.rpcAnswers = [{ data: null, error: { message: '2 sent copies name this record. It stays.', code: 'P0001' } }]
    await expect(deleteLienByHandRecord(REC)).rejects.toThrow('2 sent copies name this record. It stays.')
    expect(db.rpcs).toHaveLength(1)
  })
  it('sends the call once when the signal drops: a delete is never sent twice', async () => {
    db.answers = { job_lien_filings: [ok([row()]), ok([], 0)], jobs_ledger: [ZZ_JOB] }
    db.rpcAnswers = [{ data: null, error: { message: 'TypeError: Failed to fetch' } }]
    await expect(deleteLienByHandRecord(REC)).rejects.toBeTruthy()
    expect(db.rpcs).toHaveLength(1)
  })
  it('says so when the function gives no answer', async () => {
    db.answers = { job_lien_filings: [ok([row()]), ok([], 0)], jobs_ledger: [ZZ_JOB] }
    db.rpcAnswers = [{ data: null, error: null }]
    await expect(deleteLienByHandRecord(REC)).rejects.toThrow(/was not deleted/)
  })
  it('calls nothing when the ties cannot be read', async () => {
    db.answers = { job_lien_filings: [ok([row()]), ok([], 0)], jobs_ledger: [ZZ_JOB], sent_documents: [{ data: null, error: { message: 'no signal' } }] }
    await expect(deleteLienByHandRecord(REC)).rejects.toEqual({ message: 'no signal' })
    expect(db.rpcs).toEqual([])
  })
})

describe('readLienNoticeActivityLines', () => {
  it('reads the id and the detail of the job’s notice lines, and no other line', async () => {
    db.answers = { job_activity_events: [ok([{ id: 'l1', detail: { source_id: REC } }, { id: 'l2', detail: {} }])] }
    expect(await readLienNoticeActivityLines(JOB)).toEqual([
      { id: 'l1', detail: { source_id: REC } },
      { id: 'l2', detail: {} },
    ])
    expect(db.statements).toEqual([
      {
        table: 'job_activity_events',
        calls: [
          ['select', ['id, detail']],
          ['eq', ['job_id', JOB]],
          ['eq', ['event_type', 'lien_notice_sent']],
        ],
      },
    ])
  })
  it('answers no lines for a job with none, and throws when the read is refused', async () => {
    db.answers = { job_activity_events: [ok(null)] }
    expect(await readLienNoticeActivityLines(JOB)).toEqual([])
    db.answers = { job_activity_events: [{ data: null, error: { message: 'permission denied for table job_activity_events', code: '42501' } }] }
    await expect(readLienNoticeActivityLines(JOB)).rejects.toBeTruthy()
  })
})

describe('clearLienNoticeStrayLines', () => {
  it('calls the one function with the job id, once, and answers the count it cleared', async () => {
    db.rpcAnswers = [{ data: { ok: true, job_id: JOB, activity_lines: 3 }, error: null }]
    expect(await clearLienNoticeStrayLines(JOB)).toBe(3)
    expect(db.rpcs).toEqual([{ fn: 'delete_test_lien_notice_stray_lines', args: { p_job_id: JOB } }])
    expect(db.statements).toEqual([])
  })
  it('answers zero when the function cleared none: zero is an answer', async () => {
    db.rpcAnswers = [{ data: { ok: true, job_id: JOB, activity_lines: 0 }, error: null }]
    expect(await clearLienNoticeStrayLines(JOB)).toBe(0)
    db.rpcAnswers = [{ data: { ok: true, job_id: JOB }, error: null }]
    expect(await clearLienNoticeStrayLines(JOB)).toBe(0)
  })
  it('passes the function’s own refusal on in its words, and sends it once', async () => {
    db.rpcAnswers = [{ data: null, error: { message: 'Only a test job’s Activity lines can be cleared. This job is a real one.', code: 'P0001' } }]
    await expect(clearLienNoticeStrayLines(JOB)).rejects.toThrow('Only a test job’s Activity lines can be cleared. This job is a real one.')
    expect(db.rpcs).toHaveLength(1)
  })
  it('says so when the function gives no answer', async () => {
    db.rpcAnswers = [{ data: null, error: null }]
    await expect(clearLienNoticeStrayLines(JOB)).rejects.toThrow(/were not cleared/)
    db.rpcAnswers = [{ data: { ok: false }, error: null }]
    await expect(clearLienNoticeStrayLines(JOB)).rejects.toThrow(/were not cleared/)
  })
})
