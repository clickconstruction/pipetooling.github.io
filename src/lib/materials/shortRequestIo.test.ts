import { describe, expect, it, vi } from 'vitest'
import { sendShortRequest } from './shortRequestIo'

/** A client whose insert, rpc and update answer as told, and which records what it was asked. */
function client(answers: { insert?: { data: unknown; error: unknown }; rpc?: { data: unknown; error: unknown } }) {
  const calls: Array<{ what: string; args: unknown }> = []
  const insertResult = answers.insert ?? { data: { id: 'row-1' }, error: null }
  const rpcResult = answers.rpc ?? { data: { po_id: 'po-1' }, error: null }
  return {
    calls,
    from: (table: string) => ({
      insert: (row: unknown) => {
        calls.push({ what: `insert ${table}`, args: row })
        return { select: () => ({ single: async () => insertResult }) }
      },
      update: (patch: unknown) => ({
        eq: async (col: string, id: string) => {
          calls.push({ what: `update ${table}`, args: { patch, col, id } })
          return { data: null, error: null }
        },
      }),
    }),
    rpc: async (name: string, args: unknown) => {
      calls.push({ what: `rpc ${name}`, args })
      return rpcResult
    },
  }
}

const row = { job_id: 'j1', fixture_name: 'ZZ test elbow', part_id: 'p1', quantity: 4, sequence_order: 0, created_by_user_id: 'u1' }

describe('sendShortRequest · the tally’s own path (punch list #209, v2.6742)', () => {
  it('a book part: the row, the draft purchase order, the row tied to it', async () => {
    const c = client({})
    await expect(sendShortRequest(row, c as never)).resolves.toEqual({ kind: 'po' })
    expect(c.calls).toEqual([
      { what: 'insert jobs_tally_parts', args: row },
      { what: 'rpc create_po_from_job_tally', args: { p_job_id: 'j1', p_entries: [{ part_id: 'p1', quantity: 4 }] } },
      { what: 'update jobs_tally_parts', args: { patch: { purchase_order_id: 'po-1' }, col: 'id', id: 'row-1' } },
    ])
  })

  it('a typed name: the row alone, no purchase order asked for', async () => {
    const c = client({})
    await expect(sendShortRequest({ ...row, part_id: null }, c as never)).resolves.toEqual({ kind: 'request' })
    expect(c.calls.map((x) => x.what)).toEqual(['insert jobs_tally_parts'])
  })

  it('a purchase order the function refuses is an outcome with its reason; the request stands', async () => {
    const c = client({ rpc: { data: { error: 'No service type available' }, error: null } })
    await expect(sendShortRequest(row, c as never)).resolves.toEqual({ kind: 'po-failed', reason: 'No service type available' })
    expect(c.calls.map((x) => x.what)).toEqual(['insert jobs_tally_parts', 'rpc create_po_from_job_tally'])
  })

  it('a refused row throws with the table’s reason', async () => {
    const c = client({ insert: { data: null, error: { message: 'new row violates row-level security policy for table "jobs_tally_parts"', code: '42501' } } })
    await expect(sendShortRequest(row, c as never)).rejects.toThrow(/row-level security/)
    expect(c.calls.map((x) => x.what)).toEqual(['insert jobs_tally_parts'])
    vi.restoreAllMocks()
  })
})
