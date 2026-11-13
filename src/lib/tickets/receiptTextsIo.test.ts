/**
 * The receipt texts' io (punch list #299, PR 2) over a stood-in client: the switch reads off when its row is missing,
 * a press reads back what the row holds (the database stamps the day), a press that changed nothing says so, and the
 * Team queue's read never throws.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { RECEIPT_TEXTS_KEY, RECEIPT_TEXTS_WORDS } from './receiptText'

vi.mock('../supabase', () => ({ supabase: {} }))

const { listReceiptRequestsByCharge, supabaseReceiptTextsIo } = await import('./receiptTextsIo')

type Answer = { data: unknown; error: { message: string } | null }

/** A client whose every chain ends in the next answer, and that keeps what each chain was asked. */
function client(answers: Answer[]) {
  const calls: { table: string; steps: [string, unknown[]][] }[] = []
  const from = (table: string) => {
    const call = { table, steps: [] as [string, unknown[]][] }
    calls.push(call)
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'update', 'eq', 'in']) {
      chain[m] = (...a: unknown[]) => {
        call.steps.push([m, a])
        return chain
      }
    }
    const next = () => answers.shift() ?? { data: null, error: null }
    chain.maybeSingle = async () => next()
    chain.then = (ok: (v: Answer) => unknown) => Promise.resolve(next()).then(ok)
    return chain
  }
  return { db: { from } as unknown as SupabaseClient, calls }
}

const SERVER_SINCE = '2026-11-13T20:04:00.000Z'
const ME = '00000000-0000-0000-0000-0000000000a1'

describe('the switch', () => {
  it('reads off when its row is not there yet, and on as stored', async () => {
    const missing = client([{ data: null, error: null }])
    expect(await supabaseReceiptTextsIo(missing.db).load()).toEqual({ on: false, since: null, only: [] })
    expect(missing.calls[0]).toMatchObject({ table: 'app_settings', steps: [['select', ['value_text']], ['eq', ['key', RECEIPT_TEXTS_KEY]]] })
    const on = client([{ data: { value_text: JSON.stringify({ on: true, since: SERVER_SINCE, only: [] }) }, error: null }])
    expect(await supabaseReceiptTextsIo(on.db).load()).toEqual({ on: true, since: SERVER_SINCE, only: [] })
  })

  it('a press sends on with its people, and reads back the day the database stamped, not the phone’s', async () => {
    const c = client([{ data: [{ key: RECEIPT_TEXTS_KEY, value_text: JSON.stringify({ on: true, since: SERVER_SINCE, only: [ME] }) }], error: null }])
    const io = supabaseReceiptTextsIo(c.db, () => new Date('2026-11-01T00:00:00.000Z'))
    expect(await io.set({ on: true, only: [ME] })).toEqual({ on: true, since: SERVER_SINCE, only: [ME] })
    const [update, eq] = c.calls[0]!.steps
    expect(update![0]).toBe('update')
    expect(JSON.parse((update![1][0] as { value_text: string }).value_text)).toEqual({ on: true, since: '2026-11-01T00:00:00.000Z', only: [ME] })
    expect(eq).toEqual(['eq', ['key', RECEIPT_TEXTS_KEY]])
  })

  it('a press that changed no row says who may press', async () => {
    const c = client([{ data: [], error: null }])
    await expect(supabaseReceiptTextsIo(c.db).set({ on: true })).rejects.toThrow(RECEIPT_TEXTS_WORDS.notSaved)
  })

  it('reads Send texts by its own key', async () => {
    const c = client([{ data: { value_text: 'true' }, error: null }, { data: { value_text: 'false' }, error: null }])
    const io = supabaseReceiptTextsIo(c.db)
    expect(await io.sendTextsOn()).toBe(true)
    expect(await io.sendTextsOn()).toBe(false)
    expect(c.calls[0]!.steps[1]).toEqual(['eq', ['key', 'messages_texts_on_v1']])
  })
})

describe('the requests under the Team queue’s charges', () => {
  const row = (id: string) => ({ mercury_transaction_id: id, holder_name: 'Jordan Vance', no_text_why: null, texted_at: null, reminded_at: null, answered_at: null, closed_at: null, text_tries: 0 })

  it('reads them by charge, 150 ids a read, each id once', async () => {
    const ids = Array.from({ length: 160 }, (_, i) => `c${i}`)
    const c = client([{ data: [row('c0'), row('c1')], error: null }, { data: [row('c155')], error: null }])
    const out = await listReceiptRequestsByCharge([...ids, 'c0', ''], c.db)
    expect([...out.keys()]).toEqual(['c0', 'c1', 'c155'])
    expect(c.calls).toHaveLength(2)
    expect((c.calls[0]!.steps[1]![1][1] as string[]).length).toBe(150)
    expect((c.calls[1]!.steps[1]![1][1] as string[]).length).toBe(10)
  })

  it('asks nothing for no charges, and a read that fails leaves the queue with no lines', async () => {
    const none = client([])
    expect((await listReceiptRequestsByCharge([], none.db)).size).toBe(0)
    expect(none.calls).toHaveLength(0)
    // A database one step behind the app has no text_tries column yet: the read is refused, and nothing is thrown.
    const behind = client([{ data: null, error: { message: 'column receipt_requests.text_tries does not exist' } }])
    expect((await listReceiptRequestsByCharge(['c1'], behind.db)).size).toBe(0)
  })
})
