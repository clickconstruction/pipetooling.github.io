import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({
  rpc: [] as Array<[string, unknown]>,
  writes: [] as Array<{ table: string; op: string; args: unknown[] }>,
  next: { data: null as unknown, error: null as unknown },
  /** Each read's answer in turn, and the ids and range each read asked for. */
  reads: [] as Array<{ data: unknown; error: unknown }>,
  asked: [] as Array<{ table: string; ids: unknown; range: [number, number] }>,
}))

vi.mock('../supabase', () => {
  const chain = (table: string, op: string, args: unknown[]) => {
    calls.writes.push({ table, op, args })
    const builder: Record<string, unknown> = {
      eq: (...a: unknown[]) => {
        calls.writes.push({ table, op: 'eq', args: a })
        return builder
      },
      select: () => builder,
      then: (resolve: (v: unknown) => void) => resolve({ data: calls.next.data, error: calls.next.error }),
    }
    return builder
  }
  const read = (table: string) => {
    let ids: unknown = null
    const builder: Record<string, unknown> = {
      in: (_column: string, list: unknown) => {
        ids = list
        return builder
      },
      order: () => builder,
      range: (a: number, b: number) => {
        calls.asked.push({ table, ids, range: [a, b] })
        return Promise.resolve(calls.reads.shift() ?? { data: [], error: null })
      },
    }
    return builder
  }
  return {
    supabase: {
      rpc: (fn: string, args: unknown) => {
        calls.rpc.push([fn, args])
        return Promise.resolve({ data: calls.next.data, error: calls.next.error })
      },
      from: (table: string) => ({
        insert: (row: unknown) => chain(table, 'insert', [row]),
        delete: () => chain(table, 'delete', []),
        update: (row: unknown) => chain(table, 'update', [row]),
        select: () => read(table),
      }),
    },
  }
})

import { addContactJob, answerPaper, contactForCustomer, loadLineFiles, nameContact, removeContactJob, setDefaultJob, tieMessage } from './messagesIo'

beforeEach(() => {
  calls.rpc.length = 0
  calls.writes.length = 0
  calls.next = { data: null, error: null }
  calls.reads.length = 0
  calls.asked.length = 0
})

describe('the presses (the spine’s functions)', () => {
  it('Who is this? sends the record, the kind, a name and the job as the function takes them', async () => {
    calls.next = { data: 'c-dee', error: null }
    await expect(
      nameContact('c-unknown', { record: { table: 'gc_companies', id: 'gc-alamo' }, kind: 'trade', name: '  Dee ', jobKey: 'project:p42' }),
    ).resolves.toBe('c-dee')
    expect(calls.rpc).toEqual([
      [
        'name_contact',
        { p_contact_id: 'c-unknown', p_record_table: 'gc_companies', p_record_id: 'gc-alamo', p_kind: 'trade', p_name: 'Dee', p_job_kind: 'project', p_job_id: 'p42' },
      ],
    ])
  })

  it('ties a line and moves the star by the job’s key, and null unties and clears', async () => {
    await tieMessage('m1', 'bid:b482')
    await tieMessage('m1', null)
    await setDefaultJob('c-greg', 'pipeline:j1077')
    await setDefaultJob('c-greg', null)
    expect(calls.rpc).toEqual([
      ['tie_message', { p_message_id: 'm1', p_job_kind: 'bid', p_job_id: 'b482' }],
      ['tie_message', { p_message_id: 'm1', p_job_kind: null, p_job_id: null }],
      ['set_default_job', { p_contact_id: 'c-greg', p_job_kind: 'pipeline', p_job_id: 'j1077' }],
      ['set_default_job', { p_contact_id: 'c-greg', p_job_kind: null, p_job_id: null }],
    ])
  })

  it('opens a customer’s own thread by their id, and a refusal rejects', async () => {
    calls.next = { data: 'c-dana', error: null }
    await expect(contactForCustomer('cu-dana')).resolves.toBe('c-dana')
    expect(calls.rpc).toEqual([['contact_for_customer', { p_customer_id: 'cu-dana' }]])
    calls.next = { data: null, error: { code: '42501', message: 'Only the office opens a customer’s messages.' } }
    await expect(contactForCustomer('cu-dana')).rejects.toThrow()
  })

  it('a refusal keeps its words', async () => {
    calls.next = { data: null, error: { code: 'P0001', message: 'namedAlready', details: 'This contact is named already.' } }
    await expect(nameContact('c-greg', { record: { table: 'customers', id: 'x' }, kind: 'customer' })).rejects.toThrow()
  })

  it('puts a job on the rail, a job already there is no error, and takes one off by its own column', async () => {
    await addContactJob('c-greg', 'project:p42')
    expect(calls.writes[0]).toEqual({ table: 'contact_jobs', op: 'insert', args: [{ contact_id: 'c-greg', bid_id: null, project_id: 'p42', jobs_ledger_id: null }] })
    calls.next = { data: null, error: { code: '23505', message: 'duplicate key' } }
    await expect(addContactJob('c-greg', 'project:p42')).resolves.toBeUndefined()
    calls.next = { data: null, error: null }
    calls.writes.length = 0
    await removeContactJob('c-greg', 'bid:b482')
    expect(calls.writes).toEqual([
      { table: 'contact_jobs', op: 'delete', args: [] },
      { table: 'contact_jobs', op: 'eq', args: ['contact_id', 'c-greg'] },
      { table: 'contact_jobs', op: 'eq', args: ['bid_id', 'b482'] },
    ])
    await expect(addContactJob('c-greg', 'boerne')).rejects.toThrow('That is not a job.')
  })
})

describe('the files on the lines (cut 6)', () => {
  const ids = Array.from({ length: 151 }, (_, i) => `m${i}`)

  it('reads the files of the lines it is given, 150 ids a request, each request paged', async () => {
    calls.reads.push({ data: [{ id: 'f1', message_id: 'm0' }], error: null }, { data: [{ id: 'f2', message_id: 'm150' }], error: null })
    const rows = await loadLineFiles(ids)
    expect(rows.map((r) => r.id)).toEqual(['f1', 'f2'])
    expect(calls.asked.map((a) => [a.table, (a.ids as string[]).length, a.range])).toEqual([
      ['message_attachments', 150, [0, 999]],
      ['message_attachments', 1, [0, 999]],
    ])
    await expect(loadLineFiles([])).resolves.toEqual([])
    expect(calls.asked).toHaveLength(2)
  })

  it('reads no files, after one refused read, while the table is not there yet', async () => {
    calls.reads.push({ data: null, error: { code: 'PGRST205', message: 'Could not find the table' } })
    await expect(loadLineFiles(ids)).resolves.toEqual([])
    expect(calls.asked).toHaveLength(1)
    calls.reads.push({ data: null, error: { code: '42501', message: 'permission denied' } })
    await expect(loadLineFiles(ids)).rejects.toThrow()
  })

  it('answers an offer, and says so in words when nothing was answered', async () => {
    calls.next = { data: [{ id: 'f1' }], error: null }
    await expect(answerPaper('f1', 'not_it')).resolves.toBeUndefined()
    expect(calls.writes.slice(0, 2)).toEqual([
      { table: 'message_attachments', op: 'update', args: [{ paper_answer: 'not_it' }] },
      { table: 'message_attachments', op: 'eq', args: ['id', 'f1'] },
    ])
    calls.next = { data: [], error: null }
    await expect(answerPaper('f1', 'filed')).rejects.toThrow('That offer could not be answered from this account.')
  })
})
