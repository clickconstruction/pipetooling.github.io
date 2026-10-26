import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { loadWeekStrip } from './weekStripIo'

vi.mock('../supabase', () => ({ supabase: {} }))

type Result = { data: unknown; error: { message: string } | null }

/** A client whose queries record their calls and resolve with the result for their table, in order when a table is read twice. */
function fakeClient(results: Partial<Record<string, Result | Result[]>>) {
  const calls: unknown[][] = []
  const client = {
    from(table: string) {
      calls.push(['from', table])
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'gte', 'order', 'limit']) {
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
  }
  return { client: client as unknown as SupabaseClient, calls }
}

// Now: Wed Oct 21, 10:00 AM Chicago (CDT): this week from Oct 15, the read from Oct 8.
const NOW = new Date('2026-10-21T15:00:00Z')
const LINES = [
  { id: 'm1', contact_id: 'c1', direction: 'in', channel: 'text', at: '2026-10-20T14:00:00Z', who_text: '', delivery: null, contact: { kind: 'customer' } },
  { id: 'm2', contact_id: 'c1', direction: 'out', channel: 'text', at: '2026-10-20T14:30:00Z', who_text: 'Rosa', delivery: 'delivered', contact: { kind: 'customer' } },
  { id: 'm3', contact_id: 'c2', direction: 'team', channel: 'note', at: '2026-10-20T14:40:00Z', who_text: 'Rosa', delivery: null, contact: null },
]
const ESTS = [
  { id: 'e1', estimate_number: 101, sent_at: '2026-10-16T14:00:00Z', status: 'sent' },
  { id: 'e2', estimate_number: 102, sent_at: '2026-10-18T14:00:00Z', status: 'customer_accepted' },
  { id: 'e3', estimate_number: 103, sent_at: '2026-10-19T14:00:00Z', status: 'sent' },
]

describe('loadWeekStrip (punch list #140 PR 5)', () => {
  it('reads two weeks of lines either way and this week’s estimates with the customer’s events', async () => {
    const { client, calls } = fakeClient({
      messages: { data: LINES, error: null },
      estimates: { data: ESTS, error: null },
      estimate_customer_events: { data: [{ estimate_id: 'e1', event_type: 'public_link_view' }], error: null },
      customer_ratings: { data: [{ contact_id: 'c1', asked_at: '2026-10-17T14:00:00Z', answered_at: '2026-10-17T15:00:00Z', score: 5 }], error: null },
    })
    const read = await loadWeekStrip(NOW, client)
    expect(read.lines).toEqual([
      { id: 'm1', contactId: 'c1', kind: 'customer', direction: 'in', channel: 'text', atMs: Date.parse('2026-10-20T14:00:00Z'), who: '', delivery: null },
      { id: 'm2', contactId: 'c1', kind: 'customer', direction: 'out', channel: 'text', atMs: Date.parse('2026-10-20T14:30:00Z'), who: 'Rosa', delivery: 'delivered' },
    ])
    expect(read.estimates).toEqual([
      { id: 'e1', number: 101, sentAtMs: Date.parse('2026-10-16T14:00:00Z'), opened: true, accepted: false },
      { id: 'e2', number: 102, sentAtMs: Date.parse('2026-10-18T14:00:00Z'), opened: true, accepted: true },
      { id: 'e3', number: 103, sentAtMs: Date.parse('2026-10-19T14:00:00Z'), opened: false, accepted: false },
    ])
    expect(calls).toContainEqual(['in', 'direction', ['in', 'out']])
    expect(calls).toContainEqual(['in', 'channel', ['text', 'email', 'call', 'voicemail', 'missed']])
    expect(calls).toContainEqual(['gte', 'at', '2026-10-08T05:00:00.000Z'])
    expect(calls).toContainEqual(['gte', 'sent_at', '2026-10-15T05:00:00.000Z'])
    expect(calls).toContainEqual(['in', 'estimate_id', ['e1', 'e2', 'e3']])
    // v2.5878: this week's rating asks ride the same read.
    expect(read.ratings).toEqual([{ contactId: 'c1', askedAtMs: Date.parse('2026-10-17T14:00:00Z'), answeredAtMs: Date.parse('2026-10-17T15:00:00Z'), score: 5 }])
    expect(calls).toContainEqual(['gte', 'asked_at', '2026-10-15T05:00:00.000Z'])
  })

  it('reads no ratings when the table is refused, so the tile reads none', async () => {
    const { client } = fakeClient({
      messages: { data: LINES, error: null },
      estimates: { data: [], error: null },
      customer_ratings: { data: null, error: { message: 'permission denied' } },
    })
    expect((await loadWeekStrip(NOW, client)).ratings).toEqual([])
  })

  it('falls back to the thread’s event lines when the events table is refused, and reads none when the estimates are', async () => {
    const refused = { data: null, error: { message: 'permission denied' } }
    const a = fakeClient({
      messages: [
        { data: LINES, error: null },
        { data: [{ quo_id: 'estimate:e1:opened' }, { quo_id: 'estimate:e3:accepted' }, { quo_id: 'other' }], error: null },
      ],
      estimates: { data: ESTS, error: null },
      estimate_customer_events: refused,
    })
    const read = await loadWeekStrip(NOW, a.client)
    expect(read.estimates.map((e) => [e.id, e.opened, e.accepted])).toEqual([
      ['e1', true, false],
      ['e2', true, true],
      ['e3', true, true],
    ])
    expect(a.calls).toContainEqual(['in', 'quo_id', ['estimate:e1:opened', 'estimate:e1:accepted', 'estimate:e2:opened', 'estimate:e2:accepted', 'estimate:e3:opened', 'estimate:e3:accepted']])
    const b = fakeClient({ messages: { data: LINES, error: null }, estimates: refused })
    expect((await loadWeekStrip(NOW, b.client)).estimates).toEqual([])
  })

  it('throws on a refused lines read, so the strip says so', async () => {
    const { client } = fakeClient({ messages: { data: null, error: { message: 'down' } } })
    await expect(loadWeekStrip(NOW, client)).rejects.toThrow()
  })
})
