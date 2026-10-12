/**
 * Messages, cut 4b's screens: the reads and writes behind *Start a change order*, over a stubbed database. The person
 * is named as the spine names them; a message that became a change order is read from the office's view, a row the view
 * hides a part of left out; the job reads with the board's stage words; the draft and the price go to their functions
 * with the message's id and whole numbers, a refusal keeping the database's words; and the money team's line back joins
 * each message to its person. Nothing here is a real row.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { formatErrorMessage } from '../../utils/errorHandling'

const TABLES: Record<string, unknown[]> = {}
const calls: { table: string; ops: [string, unknown[]][] }[] = []
const rpc = vi.fn(async (_fn: string, _args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }> => ({ data: [], error: null }))
vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const call = { table, ops: [] as [string, unknown[]][] }
      calls.push(call)
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'not', 'limit', 'order']) {
        chain[m] = (...args: unknown[]) => {
          call.ops.push([m, args])
          return chain
        }
      }
      chain.then = (resolve: (v: unknown) => void) => resolve({ data: TABLES[table] ?? [], error: null })
      return chain
    },
    rpc: (fn: string, args: Record<string, unknown>) => rpc(fn, args),
  },
}))

const io = await import('./fromMessageIo')

beforeEach(() => {
  for (const k of Object.keys(TABLES)) delete TABLES[k]
  calls.length = 0
  rpc.mockReset().mockResolvedValue({ data: [], error: null })
})

describe('fromMessageIo', () => {
  it('names the person as the spine does: what they go by, else a title kept with the last name', () => {
    expect(io.messageContactOf({ id: 'c-priya', kind: 'customer', name: 'Dr. Priya Raman', goes_by: null })).toEqual({ id: 'c-priya', kind: 'customer', name: 'Dr. Priya Raman', first: 'Dr. Raman' })
    expect(io.messageContactOf({ id: 'c-bill', kind: 'customer', name: 'William Ortiz', goes_by: 'Bill' }).first).toBe('Bill')
    // A number nobody has named has no first name; the press never draws on one, and the name stands in.
    expect(io.messageContactOf({ id: 'c-unk', kind: 'unknown', name: '(210) 555-0199', goes_by: null }).first).toBe('(210) 555-0199')
  })

  it('reads which of their messages became which change order through the office’s view, leaving out a row it hides a part of', async () => {
    TABLES.contacts = [{ id: 'c-priya', kind: 'customer', name: 'Dr. Priya Raman', goes_by: null }]
    TABLES.gc_change_orders_office = [
      { id: 'co-1', number: 1, project_id: 'fairoaksd', source_message_id: 'm-priya-cabinet' },
      { id: null, number: 2, project_id: 'fairoaksd', source_message_id: 'm-hidden' },
    ]
    const got = await io.loadThreadChangeOrders('c-priya')
    expect(got.contact?.first).toBe('Dr. Raman')
    expect([...got.became]).toEqual([['m-priya-cabinet', { id: 'co-1', number: 1, projectId: 'fairoaksd' }]])
    const view = calls.find((c) => c.table === 'gc_change_orders_office')!
    expect(view.ops).toContainEqual(['eq', ['signer_contact_id', 'c-priya']])
    expect(calls.some((c) => c.table === 'gc_change_orders')).toBe(false)
  })

  it('reads the job with the board’s stage words and its change orders’ numbers, and none for a job that is not there', async () => {
    TABLES.gc_projects = [{ project_id: 'fairoaksd', stage: 'bidding', lost_on: null }]
    TABLES.projects = [{ id: 'fairoaksd', name: 'Fair Oaks Dental' }]
    TABLES.gc_change_orders_office = [{ number: 1 }, { number: null }, { number: 2 }]
    expect(await io.loadChangeOrderJob('fairoaksd')).toEqual({ id: 'fairoaksd', name: 'Fair Oaks Dental', stage: 'pursuing', lostOn: null, changeOrders: [{ number: 1 }, { number: 2 }] })
    TABLES.gc_projects = [{ project_id: 'fairoaksd', stage: 'closed', lost_on: null }]
    expect((await io.loadChangeOrderJob('fairoaksd'))?.stage).toBe('building')
    TABLES.gc_projects = []
    expect(await io.loadChangeOrderJob('nowhere')).toBeNull()
  })

  it('drafts through the office’s function with the message’s id, and keeps a refusal in the database’s words', async () => {
    rpc.mockResolvedValueOnce({ data: [{ change_order_id: 'co-2', change_order_number: 2 }], error: null })
    const draft = { description: 'Add a sink in exam 3', reason: 'owner' as const, schedule: '', packageId: null, cost: 0, price: 0, days: 0 }
    expect(await io.draftChangeOrderFromMessage('m-priya-sink', draft)).toEqual({ id: 'co-2', number: 2 })
    expect(rpc).toHaveBeenCalledWith('gc_draft_change_order_from_message', { p_message_id: 'm-priya-sink', p_draft: draft })

    rpc.mockResolvedValueOnce({ data: null, error: { message: 'This message became change order 2 already.', code: 'P0001' } })
    const refused = await io.draftChangeOrderFromMessage('m-priya-sink', draft).catch((e: unknown) => e)
    expect(formatErrorMessage(refused)).toContain('This message became change order 2 already.')

    rpc.mockResolvedValueOnce({ data: [], error: null })
    await expect(io.draftChangeOrderFromMessage('m-priya-sink', draft)).rejects.toThrow('The change order was not drafted.')
  })

  it('prices a draft through the money team’s function, and keeps a refusal in its words', async () => {
    await io.priceChangeOrder('co-2', 1200, 1501)
    expect(rpc).toHaveBeenCalledWith('gc_price_change_order', { p_id: 'co-2', p_cost: 1200, p_price: 1501 })
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Change order 2 went to the customer, so its price stays as it went. Draft a new one.', code: 'P0001' } })
    const refused = await io.priceChangeOrder('co-2', 1300, 1600).catch((e: unknown) => e)
    expect(formatErrorMessage(refused)).toContain('so its price stays as it went')
  })

  it('joins each message to its person for the line back, and skips one whose person is not there', async () => {
    TABLES.messages = [
      { id: 'm-priya-sink', contact_id: 'c-priya', project_id: 'fairoaksd', channel: 'text', direction: 'in', at: '2026-10-01T15:00:00Z', body: 'Can we add a sink?' },
      { id: 'm-gone', contact_id: 'c-gone', project_id: 'fairoaksd', channel: 'email', direction: 'in', at: '2026-10-01T15:00:00Z', body: 'Hello' },
    ]
    TABLES.contacts = [{ id: 'c-priya', kind: 'customer', name: 'Dr. Priya Raman', goes_by: null }]
    const got = await io.loadSourceMessages(['m-priya-sink', 'm-gone', 'm-priya-sink'])
    expect([...got.keys()]).toEqual(['m-priya-sink'])
    expect(got.get('m-priya-sink')).toEqual({
      message: { id: 'm-priya-sink', contactId: 'c-priya', jobId: 'fairoaksd', channel: 'text', direction: 'in', at: '2026-10-01T15:00:00Z', body: 'Can we add a sink?' },
      contact: { id: 'c-priya', kind: 'customer', name: 'Dr. Priya Raman', first: 'Dr. Raman' },
    })
    expect(await io.loadSourceMessages([])).toEqual(new Map())
  })
})
