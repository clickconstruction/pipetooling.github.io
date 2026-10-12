import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({ rpc: [] as Array<[string, unknown]>, writes: [] as Array<{ table: string; op: string; args: unknown[] }>, next: { data: null as unknown, error: null as unknown } }))

vi.mock('../supabase', () => {
  const chain = (table: string, op: string, args: unknown[]) => {
    calls.writes.push({ table, op, args })
    const builder: Record<string, unknown> = {
      eq: (...a: unknown[]) => {
        calls.writes.push({ table, op: 'eq', args: a })
        return builder
      },
      then: (resolve: (v: unknown) => void) => resolve({ data: calls.next.data, error: calls.next.error }),
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
      }),
    },
  }
})

import { addContactJob, nameContact, removeContactJob, setDefaultJob, tieMessage } from './messagesIo'

beforeEach(() => {
  calls.rpc.length = 0
  calls.writes.length = 0
  calls.next = { data: null, error: null }
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
