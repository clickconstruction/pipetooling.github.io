// @vitest-environment jsdom
/**
 * Bid Board → Reply book: the read and the three writes. Pins the seam — nothing is read without
 * a signed-in user; the read is ordered and ranged; a post is stamped with the poster and saved
 * without the sign-off it was pasted with; each write changes the list in hand without a second
 * read; and a change RLS refuses (no error, no row) is reported as refused, not as done.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, screen } from '@testing-library/react'
import { renderSettled, renderWithProviders, settle } from '../test/renderSmokeMocks'
import { BID_REPLY_REFUSED_MESSAGE, useBidReplyBook, type BidReplyBook } from './useBidReplyBook'
import type { BidReplyDraft, BidReplyEntry } from '../lib/bids/bidReplyBook'

type Step = { method: string; args: unknown[] }
type Result = { data: unknown; error: { message: string } | null }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (steps: Step[]) => Result = () => ({ data: [], error: null })
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: Result) => void) => resolve(route(steps))
            return (...a: unknown[]) => {
              steps.push({ method: String(prop), args: a })
              return p
            }
          },
        },
      )
      return p
    },
  },
}))

const has = (steps: Step[], method: string) => steps.some((s) => s.method === method)
const arg = <T,>(steps: Step[], method: string) => steps.find((s) => s.method === method)!.args[0] as T

function entry(id: string, over: Partial<BidReplyEntry> = {}): BidReplyEntry {
  return {
    id,
    title: `Reply ${id}`,
    kind: 'declining',
    body: 'We will pass on this one.',
    sign_with_sender: true,
    created_by: 'wendi',
    created_by_name: 'Wendi Example',
    created_at: '2026-09-28T15:00:00Z',
    updated_at: '2026-09-28T15:00:00Z',
    ...over,
  }
}

/** A book holding `rows`. A write answers as the database would; `refuse` matches no rows, `fail` errors. */
function world(rows: BidReplyEntry[], opts: { readFails?: boolean; fail?: boolean; refuse?: boolean } = {}) {
  route = (steps) => {
    if (has(steps, 'insert')) {
      if (opts.fail) return { data: null, error: { message: 'new row violates row-level security policy' } }
      const sent = arg<Record<string, unknown>>(steps, 'insert')
      return { data: { ...entry('new'), ...sent, created_by_name: 'Wendi Example' }, error: null }
    }
    if (has(steps, 'update')) {
      if (opts.fail) return { data: null, error: { message: 'down' } }
      if (opts.refuse) return { data: [], error: null }
      const id = steps.find((s) => s.method === 'eq')!.args[1] as string
      return { data: [{ ...rows.find((r) => r.id === id)!, ...arg<Record<string, unknown>>(steps, 'update'), updated_at: '2026-09-30T16:00:00Z' }], error: null }
    }
    if (has(steps, 'delete')) {
      if (opts.fail) return { data: null, error: { message: 'down' } }
      if (opts.refuse) return { data: [], error: null }
      return { data: [{ id: steps.find((s) => s.method === 'eq')!.args[1] }], error: null }
    }
    if (opts.readFails) return { data: null, error: { message: 'down' } }
    return { data: rows, error: null }
  }
}

const reads = () => queries.filter((q) => !has(q.steps, 'insert') && !has(q.steps, 'update') && !has(q.steps, 'delete'))

let latest: BidReplyBook
function Probe({ userId }: { userId: string | null }) {
  const book = useBidReplyBook(userId)
  latest = book
  return (
    <div data-testid="b">
      {`${book.loading ? 'loading' : 'ready'} [${book.entries.map((e) => `${e.id}:${e.title}`).join('|')}] ${book.loadError ? 'error' : 'ok'} ${book.saving ? 'saving' : 'idle'}`}
    </div>
  )
}

const draft: BidReplyDraft = { title: '  Declining: too far  ', kind: 'declining', body: 'We will pass.\n\nThank you,\nWendi', signWithSender: true }

afterEach(() => {
  cleanup()
  queries.length = 0
  vi.restoreAllMocks()
})

describe('useBidReplyBook', () => {
  it('reads nothing without a signed-in user', async () => {
    world([entry('a')])
    await renderSettled(<Probe userId={null} />, { loaded: () => screen.findByText('ready [] ok idle') })
    expect(queries).toEqual([])
  })

  it('reads the book newest first, in a stable order, ranged', async () => {
    world([entry('b'), entry('a')])
    renderWithProviders(<Probe userId="wendi" />)
    await screen.findByText('ready [b:Reply b|a:Reply a] ok idle')
    expect(queries).toHaveLength(1)
    expect(queries[0]!.table).toBe('bid_reply_book_entries')
    expect(queries[0]!.steps).toContainEqual({ method: 'order', args: ['created_at', { ascending: false }] })
    expect(queries[0]!.steps).toContainEqual({ method: 'order', args: ['id', { ascending: true }] })
    expect(queries[0]!.steps).toContainEqual({ method: 'range', args: [0, 499] })
    expect(latest.atReadLimit).toBe(false)
  })

  it('a failed read says so and leaves the book empty', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    world([entry('a')], { readFails: true })
    await renderSettled(<Probe userId="wendi" />, { loaded: () => screen.findByText('ready [] error idle') })
    expect(latest.loadError).toBeTruthy()
  })

  it('a post is stamped with the poster, saved trimmed and without its pasted sign-off, and leads the list', async () => {
    world([entry('a')])
    renderWithProviders(<Probe userId="wendi" />)
    await screen.findByText('ready [a:Reply a] ok idle')
    await settle()
    let result: string | null = 'unset'
    await act(async () => {
      result = await latest.addReply(draft)
    })
    expect(result).toBeNull()
    await screen.findByText('ready [new:Declining: too far|a:Reply a] ok idle')
    const insert = queries.find((q) => has(q.steps, 'insert'))!
    expect(arg(insert.steps, 'insert')).toEqual({ title: 'Declining: too far', kind: 'declining', body: 'We will pass.', sign_with_sender: true, created_by: 'wendi' })
    expect(reads()).toHaveLength(1)
  })

  it('a draft with nothing in it is not sent', async () => {
    world([])
    await renderSettled(<Probe userId="wendi" />, { loaded: () => screen.findByText('ready [] ok idle') })
    let result: string | null = null
    await act(async () => {
      result = await latest.addReply({ ...draft, title: '   ' })
    })
    expect(result).toBe('Say what the reply is for.')
    await act(async () => {
      result = await latest.updateReply('a', { ...draft, body: '' })
    })
    expect(result).toBe('Add the wording.')
    expect(queries.filter((q) => has(q.steps, 'insert') || has(q.steps, 'update'))).toEqual([])
  })

  it('a change is sent without the author and replaces the reply in hand', async () => {
    world([entry('b'), entry('a')])
    renderWithProviders(<Probe userId="wendi" />)
    await screen.findByText('ready [b:Reply b|a:Reply a] ok idle')
    await settle()
    let result: string | null = 'unset'
    await act(async () => {
      result = await latest.updateReply('a', { ...draft, title: 'Declining: schedule is full', kind: 'other', signWithSender: false })
    })
    expect(result).toBeNull()
    await screen.findByText('ready [b:Reply b|a:Declining: schedule is full] ok idle')
    const update = queries.find((q) => has(q.steps, 'update'))!
    expect(arg(update.steps, 'update')).toEqual({ title: 'Declining: schedule is full', kind: 'other', body: 'We will pass.\n\nThank you,\nWendi', sign_with_sender: false })
    expect(update.steps).toContainEqual({ method: 'eq', args: ['id', 'a'] })
    expect(latest.entries.find((e) => e.id === 'a')!.updated_at).toBe('2026-09-30T16:00:00Z')
    expect(reads()).toHaveLength(1)
  })

  it('a delete drops the reply from the list in hand', async () => {
    world([entry('b'), entry('a')])
    renderWithProviders(<Probe userId="wendi" />)
    await screen.findByText('ready [b:Reply b|a:Reply a] ok idle')
    await settle()
    let result: string | null = 'unset'
    await act(async () => {
      result = await latest.deleteReply('b')
    })
    expect(result).toBeNull()
    await screen.findByText('ready [a:Reply a] ok idle')
    expect(queries.find((q) => has(q.steps, 'delete'))!.steps).toContainEqual({ method: 'eq', args: ['id', 'b'] })
    expect(reads()).toHaveLength(1)
  })

  it('a change or a delete the database refuses — no error, no row — is reported as refused', async () => {
    world([entry('a', { created_by: 'alex' })], { refuse: true })
    renderWithProviders(<Probe userId="wendi" />)
    await screen.findByText('ready [a:Reply a] ok idle')
    await settle()
    let changed: string | null = null
    let deleted: string | null = null
    await act(async () => {
      changed = await latest.updateReply('a', draft)
      deleted = await latest.deleteReply('a')
    })
    expect(changed).toBe(BID_REPLY_REFUSED_MESSAGE)
    expect(deleted).toBe(BID_REPLY_REFUSED_MESSAGE)
    expect(screen.getByTestId('b').textContent).toBe('ready [a:Reply a] ok idle')
  })

  it('a write that errors gives words back, leaves the list as it was and stops saving', async () => {
    world([entry('a')], { fail: true })
    renderWithProviders(<Probe userId="wendi" />)
    await screen.findByText('ready [a:Reply a] ok idle')
    await settle()
    const results: Array<string | null> = []
    await act(async () => {
      results.push(await latest.addReply(draft))
      results.push(await latest.updateReply('a', draft))
      results.push(await latest.deleteReply('a'))
    })
    expect(results.every((r) => typeof r === 'string' && r.length > 0)).toBe(true)
    expect(screen.getByTestId('b').textContent).toBe('ready [a:Reply a] ok idle')
  })
})
