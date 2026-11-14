/**
 * The receipt state's read (punch list #299, PR 3) over a stood-in client: the live tickets and the requests of the
 * charges asked about, joined by charge, and never a throw.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

const { loadReceiptStateFacts } = await import('./receiptStateIo')

type Answer = { data: unknown; error: { message: string } | null }

/** A client that answers each table from its own list, and keeps what each chain was asked. */
function client(answers: Record<string, Answer[]>) {
  const calls: { table: string; steps: [string, unknown[]][] }[] = []
  const from = (table: string) => {
    const call = { table, steps: [] as [string, unknown[]][] }
    calls.push(call)
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'in', 'is', 'not']) {
      chain[m] = (...a: unknown[]) => {
        call.steps.push([m, a])
        return chain
      }
    }
    chain.then = (ok: (v: Answer) => unknown) => Promise.resolve((answers[table] ?? []).shift() ?? { data: [], error: null }).then(ok)
    return chain
  }
  return { db: { from } as unknown as SupabaseClient, calls }
}

const request = (id: string, more: Record<string, unknown> = {}) => ({ mercury_transaction_id: id, holder_name: 'Jordan Vance', no_text_why: null, texted_at: null, reminded_at: null, answered_at: null, closed_at: null, text_tries: 0, ...more })

describe('loadReceiptStateFacts', () => {
  it('joins the live ticket and the request of each charge, and leaves out a charge with neither', async () => {
    const c = client({
      counter_tickets: [{ data: [{ mercury_transaction_id: 'c1', source: 'link' }], error: null }],
      receipt_requests: [{ data: [request('c1', { answered_at: '2026-11-04T19:45:00.000Z' }), request('c2', { no_text_why: 'no_cell' })], error: null }],
    })
    const facts = await loadReceiptStateFacts(['c1', 'c2', 'c3', 'c1', ''], c.db)
    expect([...facts.keys()]).toEqual(['c1', 'c2'])
    expect(facts.get('c1')).toMatchObject({ ticket: { source: 'link' }, request: { answered_at: '2026-11-04T19:45:00.000Z' } })
    expect(facts.get('c2')).toMatchObject({ ticket: null, request: { no_text_why: 'no_cell' } })
    // Only a ticket that was saved and not removed counts.
    const tickets = c.calls.find((x) => x.table === 'counter_tickets')!
    expect(tickets.steps).toEqual([
      ['select', ['mercury_transaction_id, source']],
      ['in', ['mercury_transaction_id', ['c1', 'c2', 'c3']]],
      ['is', ['removed_at', null]],
      ['not', ['added_at', 'is', null]],
    ])
  })

  it('asks nothing for no charges', async () => {
    const c = client({})
    expect((await loadReceiptStateFacts([], c.db)).size).toBe(0)
    expect(c.calls).toEqual([])
  })

  it('a read that is refused leaves what the other read found, and nothing is thrown', async () => {
    const c = client({
      counter_tickets: [{ data: null, error: { message: 'permission denied' } }],
      receipt_requests: [{ data: [request('c2', { texted_at: '2026-11-04T19:14:00.000Z' })], error: null }],
    })
    const facts = await loadReceiptStateFacts(['c1', 'c2'], c.db)
    expect([...facts.keys()]).toEqual(['c2'])
    const none = client({ counter_tickets: [{ data: null, error: { message: 'no' } }], receipt_requests: [{ data: null, error: { message: 'no' } }] })
    expect((await loadReceiptStateFacts(['c1'], none.db)).size).toBe(0)
  })

  it('reads 150 charges a time', async () => {
    const ids = Array.from({ length: 310 }, (_, i) => `c${i}`)
    const c = client({})
    await loadReceiptStateFacts(ids, c.db)
    expect(c.calls.filter((x) => x.table === 'counter_tickets')).toHaveLength(3)
    expect(c.calls.filter((x) => x.table === 'receipt_requests')).toHaveLength(3)
  })
})
