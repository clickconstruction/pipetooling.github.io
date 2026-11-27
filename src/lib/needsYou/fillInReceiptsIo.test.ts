// @vitest-environment jsdom
/**
 * The receipt kind's io (punch list #299, the step after PR 2) over a stood-in client: the read is the one function,
 * Got it and its Undo are the other with the flag each way, a refusal keeps its words, and a press tells the Needs you
 * line to count again. Text again (v2.8697) asks the `receipt-request` function for the one request and keeps the
 * function's own words when no text went.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

const { receiptFillInIoOver } = await import('./fillInReceiptsIo')
const { RECEIPT_CHASE_CHANGED_EVENT } = await import('./fillInReceipts')

type Answer = { data: unknown; error: { message: string; code?: string } | null }

function client(answers: Answer[]) {
  const calls: Array<[string, unknown]> = []
  const rpc = vi.fn(async (name: string, args?: unknown) => {
    calls.push([name, args])
    return answers.shift() ?? { data: null, error: null }
  })
  return { db: { rpc } as unknown as SupabaseClient, calls }
}

/** A client whose one function answers as told. */
function functionClient(answer: { data: unknown; error: unknown }) {
  const invoke = vi.fn(async (_name: string, _options?: unknown) => answer)
  return { db: { functions: { invoke } } as unknown as SupabaseClient, invoke }
}

const heard = vi.fn()
afterEach(() => {
  window.removeEventListener(RECEIPT_CHASE_CHANGED_EVENT, heard)
  heard.mockClear()
})

describe('the receipt kind’s io', () => {
  it('reads the rows through the office’s function, the amount as a number', async () => {
    const c = client([{ data: [{ request_id: 'r1', mercury_transaction_id: 'c1', why: 'no_cell', holder_user_id: null, holder_name: 'Jordan Vance', store: 'Ridgeway Supply', amount: '228.58', posted_at: null, texted_at: null, reminded_at: null, closes_at: null }], error: null }])
    const rows = await receiptFillInIoOver(c.db).fetchSources()
    expect(c.calls).toEqual([['receipt_requests_to_chase', undefined]])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ request_id: 'r1', amount: 228.58 })
    expect((await receiptFillInIoOver(client([{ data: null, error: null }]).db).fetchSources())).toEqual([])
  })

  it('a read the database refuses throws, so the hook stays quiet and the deck shows no rows', async () => {
    const c = client([{ data: null, error: { message: 'Could not find the function public.receipt_requests_to_chase', code: 'PGRST202' } }])
    await expect(receiptFillInIoOver(c.db).fetchSources()).rejects.toThrow()
  })

  it('Got it marks the one request done, Undo takes the mark back, and each tells the line to count again', async () => {
    window.addEventListener(RECEIPT_CHASE_CHANGED_EVENT, heard)
    const c = client([{ data: 1, error: null }, { data: 1, error: null }])
    const io = receiptFillInIoOver(c.db)
    await io.save('r1')
    await io.undo('r1')
    expect(c.calls).toEqual([
      ['receipt_requests_set_done', { p_request_ids: ['r1'], p_done: true }],
      ['receipt_requests_set_done', { p_request_ids: ['r1'], p_done: false }],
    ])
    expect(heard).toHaveBeenCalledTimes(2)
  })

  it('a refused Got it keeps the database’s words and tells nobody', async () => {
    window.addEventListener(RECEIPT_CHASE_CHANGED_EVENT, heard)
    const c = client([{ data: null, error: { message: 'Only the office marks a receipt request done.', code: '42501' } }])
    await expect(receiptFillInIoOver(c.db).save('r1')).rejects.toThrow(/Only the office marks a receipt request done/)
    expect(heard).not.toHaveBeenCalled()
  })
})

describe('Text again', () => {
  it('asks the function for the one request, and tells the line to count again once the text has gone', async () => {
    window.addEventListener(RECEIPT_CHASE_CHANGED_EVENT, heard)
    const c = functionClient({ data: { ok: true, state: 'sent', segments: 1, againCount: 1 }, error: null })
    await receiptFillInIoOver(c.db).textAgain('r6')
    expect(c.invoke.mock.calls).toEqual([['receipt-request', { body: { again: 'r6' } }]])
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it('a text that did not go throws the function’s own words and tells nobody', async () => {
    window.addEventListener(RECEIPT_CHASE_CHANGED_EVENT, heard)
    const c = functionClient({ data: { ok: false, why: 'opted_out', words: 'Jordan replied STOP, so no text went. Ask for the receipt another way.' }, error: null })
    await expect(receiptFillInIoOver(c.db).textAgain('r6')).rejects.toThrow('Jordan replied STOP, so no text went. Ask for the receipt another way.')
    expect(heard).not.toHaveBeenCalled()
  })

  it('an answer that does not read, or a function that could not be reached, says no text went', async () => {
    await expect(receiptFillInIoOver(functionClient({ data: null, error: null }).db).textAgain('r6')).rejects.toThrow(/^No text went\./)
    await expect(receiptFillInIoOver(functionClient({ data: null, error: new Error('Failed to send a request to the Edge Function') }).db).textAgain('r6')).rejects.toThrow(/^No text went\./)
  })
})
