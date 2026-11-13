import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { ANSWER_EVENTS_FILTER, heardBack, loadWaitingOnThem } from './waitingOnThemIo'

vi.mock('../supabase', () => ({ supabase: {} }))

type Result = { data: unknown; error: { message: string; code?: string } | null }

/** A client whose queries record their calls and resolve with the result for their table, in order when a table is read twice. */
function fakeClient(results: Partial<Record<string, Result | Result[]>>, rpc: Partial<Record<string, Result>> = {}, userId: string | null = 'u-taunya') {
  const calls: unknown[][] = []
  const client = {
    from(table: string) {
      calls.push(['from', table])
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'or', 'gte', 'order', 'limit']) {
        chain[m] = (...args: unknown[]) => {
          calls.push([m, ...args])
          return chain
        }
      }
      const result = (): Result => {
        const r = results[table]
        if (Array.isArray(r)) return r.shift() ?? { data: null, error: null }
        return r ?? { data: null, error: null }
      }
      chain.then = (ok: (r: Result) => unknown, no: (e: unknown) => unknown) => Promise.resolve(result()).then(ok, no)
      return chain
    },
    rpc(name: string, args: unknown) {
      calls.push(['rpc', name, args])
      return Promise.resolve(rpc[name] ?? { data: null, error: null })
    },
    auth: { getUser: () => Promise.resolve({ data: { user: userId ? { id: userId } : null }, error: null }) },
  }
  return { client: client as unknown as SupabaseClient, calls }
}

const NOW = new Date('2026-11-04T18:00:00Z')
const CONTACT = { name: 'Evan Jarrow', kind: 'customer', customer: { name: 'Evan Jarrow' } }
const LINES = [
  { id: 'm1', contact_id: 'c1', direction: 'out', body: 'Evan, your estimate is ready.', at: '2026-10-20T20:00:00Z', channel: 'text', delivery: 'delivered', number: { value: '(830) 555-0121' }, contact: CONTACT },
  { id: 'm0', contact_id: 'c1', direction: 'in', body: 'Hi', at: '2026-10-19T20:00:00Z', channel: 'text', delivery: null, number: null, contact: CONTACT },
]
const EVENTS = [
  { id: 'e1', contact_id: 'c1', body: '✍️ Evan accepted estimate #212.', at: '2026-10-22T15:00:00Z', quo_id: 'estimate:est-1:accepted' },
  { id: 'e2', contact_id: 'c2', body: 'Taunya heard back by phone on Nov 3.', at: '2026-11-03T19:00:00Z', quo_id: null },
]

describe('loadWaitingOnThem (v2.5704; the event lines since v2.6500)', () => {
  it('reads thirty days of lines either way, then the event lines that can be their word, each as the kernel takes it', async () => {
    const { client, calls } = fakeClient({ messages: [{ data: LINES, error: null }, { data: EVENTS, error: null }] })
    const lines = await loadWaitingOnThem(NOW, client)
    expect(lines).toEqual([
      { id: 'm1', contactId: 'c1', name: 'Evan Jarrow', customerName: 'Evan Jarrow', kind: 'customer', direction: 'out', body: 'Evan, your estimate is ready.', atMs: Date.parse('2026-10-20T20:00:00Z'), number: '(830) 555-0121', channel: 'text', delivery: 'delivered' },
      { id: 'm0', contactId: 'c1', name: 'Evan Jarrow', customerName: 'Evan Jarrow', kind: 'customer', direction: 'in', body: 'Hi', atMs: Date.parse('2026-10-19T20:00:00Z'), number: null, channel: 'text', delivery: null },
      { id: 'e1', contactId: 'c1', name: null, kind: null, direction: 'event', body: '✍️ Evan accepted estimate #212.', atMs: Date.parse('2026-10-22T15:00:00Z'), channel: 'event', key: 'estimate:est-1:accepted' },
      { id: 'e2', contactId: 'c2', name: null, kind: null, direction: 'event', body: 'Taunya heard back by phone on Nov 3.', atMs: Date.parse('2026-11-03T19:00:00Z'), channel: 'event', key: null },
    ])
    const from = '2026-10-05T18:00:00.000Z'
    expect(calls.filter((c) => c[0] === 'from')).toEqual([['from', 'messages'], ['from', 'messages']])
    expect(calls).toContainEqual(['in', 'direction', ['in', 'out']])
    expect(calls).toContainEqual(['eq', 'auto', false])
    expect(calls).toContainEqual(['eq', 'channel', 'event'])
    expect(calls).toContainEqual(['eq', 'direction', 'team'])
    expect(calls).toContainEqual(['or', ANSWER_EVENTS_FILTER])
    expect(calls.filter((c) => c[0] === 'gte')).toEqual([['gte', 'at', from], ['gte', 'at', from]])
    expect(calls.filter((c) => c[0] === 'limit')).toEqual([['limit', 1500], ['limit', 500]])
  })
  it('a refused read of either rejects with its reason', async () => {
    const { client } = fakeClient({ messages: [{ data: LINES, error: null }, { data: null, error: { message: 'permission denied for table messages', code: '42501' } }] })
    await expect(loadWaitingOnThem(NOW, client)).rejects.toThrow(/read who went quiet/)
  })
})

describe('heardBack (v2.6500)', () => {
  it('writes the gray line through follow_up_event, as the signed-in person on the day, the thread menu’s own writer', async () => {
    const { client, calls } = fakeClient({}, { follow_up_user_name: { data: 'Taunya', error: null }, follow_up_event: { data: null, error: null } })
    await heardBack('c-evan', 'phone', new Date('2026-11-03T19:00:00Z'), client)
    expect(calls).toEqual([
      ['rpc', 'follow_up_user_name', { p_user_id: 'u-taunya' }],
      ['rpc', 'follow_up_event', { p_contact_id: 'c-evan', p_body: 'Taunya heard back by phone on Nov 3.' }],
    ])
  })
  it('names nobody Someone when the name cannot be read, and rejects with the refusal’s words', async () => {
    const { client, calls } = fakeClient({}, { follow_up_user_name: { data: null, error: null }, follow_up_event: { data: null, error: null } }, null)
    await heardBack('c-evan', 'none', new Date('2026-11-03T19:00:00Z'), client)
    expect(calls).toEqual([['rpc', 'follow_up_event', { p_contact_id: 'c-evan', p_body: 'Someone said on Nov 3 that no answer is needed.' }]])
    const refused = fakeClient({}, { follow_up_user_name: { data: 'Taunya', error: null }, follow_up_event: { data: null, error: { message: 'new row violates row-level security policy for table "messages"', code: '42501' } } })
    await expect(heardBack('c-evan', 'text', new Date('2026-11-03T19:00:00Z'), refused.client)).rejects.toThrow()
  })
})
