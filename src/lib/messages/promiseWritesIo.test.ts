import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))
vi.mock('../gc/gcIo', () => ({ logGcAskContact: vi.fn(), recordGcTradePromise: vi.fn() }))

import { loadPromiseAt, writeHeardThrough, type HeardThroughInput } from './promiseWritesIo'
import type { PromiseWrite, PromiseWriters } from './promiseWrites'

/** A client whose every read of a table answers with that table's rows, recording each table read and filter. */
function fakeClient(tables: Record<string, unknown[] | Error>) {
  const reads: string[] = []
  const query = (table: string) => {
    const filters: string[] = []
    const answer = () => {
      reads.push(`${table}${filters.length ? ` ${filters.join(' ')}` : ''}`)
      const rows = tables[table]
      if (rows instanceof Error) throw rows
      return { data: rows ?? [], error: null }
    }
    const q: Record<string, unknown> = {}
    for (const name of ['select', 'eq', 'in', 'is', 'not', 'limit']) q[name] = (...args: unknown[]) => (name === 'select' ? q : (filters.push(`${name}:${String(args[0])}`), q))
    q.maybeSingle = async () => {
      const r = answer()
      return { data: (r.data as unknown[])[0] ?? null, error: null }
    }
    q.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => {
      try {
        return Promise.resolve(answer()).then(ok, bad)
      } catch (e) {
        return Promise.reject(e).then(ok, bad)
      }
    }
    return q
  }
  return { client: { from: query }, reads }
}

const input = (over: Partial<HeardThroughInput> = {}): HeardThroughInput => ({
  message: { id: 'm1', channel: 'text', at: '2026-11-23T18:00:00Z', jobId: 'project:p1' },
  contact: { id: 'dee', kind: 'trade', name: 'Dee Ramos', goesBy: null, company: 'ZZ Test Tile Co', trade: 'Tile', gcCompanyId: 'tile' },
  kind: 'quote',
  writes: null,
  ymd: '2026-11-25',
  written: 'Written down. Their quote by Wed Nov 25.',
  by: { userId: 'u-rosa', name: 'Rosa' },
  todayYmd: '2026-11-23',
  nowIso: '2026-11-23T18:05:00Z',
  ...over,
})

/** Writers that record each write, the first refused by its kind when asked. */
function recordWriters(refuse?: PromiseWrite['kind']) {
  const made: PromiseWrite[] = []
  const one = (w: PromiseWrite) => {
    if (w.kind === refuse) return Promise.reject(new Error('The Board is closed for the night.'))
    made.push(w)
    return Promise.resolve()
  }
  const writers = { askDay: one, tradePromise: one, payment: one, bidFollowup: one, hold: one } as unknown as PromiseWriters
  return { writers, made }
}

describe('loadPromiseAt (punch list #421)', () => {
  it('a quote on a GC job: the job’s name, the company’s open ask, and the line’s day in the app’s zone', async () => {
    const { client, reads } = fakeClient({ projects: [{ name: 'ZZ Test Elm Street' }], gc_trade_packages: [{ id: 'pk1' }, { id: 'pk2' }], gc_invites: [{ id: 'inv-tile' }] })
    const at = await loadPromiseAt(input({ message: { id: 'm1', channel: 'text', at: '2026-11-24T04:30:00Z', jobId: 'project:p1' } }), client)
    expect(at.line).toEqual({ channel: 'text', onYmd: '2026-11-23', bidId: null, projectId: 'p1', jobName: 'ZZ Test Elm Street', pipelineJob: false })
    expect(at.askInviteId).toBe('inv-tile')
    expect(at.person).toMatchObject({ kind: 'trade', company: 'ZZ Test Tile Co', trade: 'Tile', contactId: 'dee', companyId: 'tile' })
    expect(reads).toContain('gc_invites eq:company_id in:package_id in:status limit:1')
    expect(reads.some((r) => r.startsWith('nudge_holds'))).toBe(false)
  })

  it('a hold kind reads the person’s standing holds on GC jobs, the latest per step and job', async () => {
    const { client } = fakeClient({
      bids: [{ project_name: 'ZZ Test Bid' }],
      nudge_holds: [
        { step_key: 'yes', project_id: 'p1', until_on: '2026-11-27' },
        { step_key: 'yes', project_id: 'p1', until_on: '2026-11-30' },
      ],
    })
    const at = await loadPromiseAt(input({ kind: 'decision', contact: { ...input().contact, kind: 'customer', gcCompanyId: null }, message: { ...input().message, jobId: 'bid:b1' } }), client)
    expect(at.line).toMatchObject({ bidId: 'b1', projectId: null, jobName: 'ZZ Test Bid' })
    expect(at.holds).toEqual({ 'yes|p1': '2026-11-30' })
    expect(at.askInviteId).toBeNull()
  })

  it('a read that fails leaves its piece empty', async () => {
    const { client } = fakeClient({ projects: new Error('offline'), gc_trade_packages: new Error('offline') })
    const at = await loadPromiseAt(input(), client)
    expect([at.line.jobName, at.askInviteId]).toEqual([null, null])
  })

  it('a Pipeline job is said so, for the kernel’s words', async () => {
    const { client } = fakeClient({ jobs_ledger: [{ job_name: 'ZZ Test Repipe' }] })
    const at = await loadPromiseAt(input({ kind: 'access', contact: { ...input().contact, kind: 'customer', gcCompanyId: null }, message: { ...input().message, jobId: 'pipeline:j1' } }), client)
    expect(at.line).toMatchObject({ projectId: null, pipelineJob: true, jobName: 'ZZ Test Repipe' })
  })
})

describe('writeHeardThrough (punch list #421)', () => {
  it('a quote with an open ask goes on it, and the words say so', async () => {
    const { client } = fakeClient({ projects: [{ name: 'ZZ Test Elm Street' }], gc_trade_packages: [{ id: 'pk1' }], gc_invites: [{ id: 'inv-tile' }] })
    const { writers, made } = recordWriters()
    const said = await writeHeardThrough(input(), client, writers)
    expect(made).toEqual([
      { kind: 'askDay', companyId: 'tile', inviteId: 'inv-tile', on: '2026-11-23', how: 'text', note: 'Said in a text: ZZ Test Tile Co’s Tile quote for ZZ Test Elm Street by Wed Nov 25.', promisedBy: '2026-11-25' },
    ])
    expect(said).toEqual({ words: 'Written down. Their quote by Wed Nov 25. It went on their ask on the Board.', tone: 'success' })
  })

  it('a start goes on the Board’s promises for the job', async () => {
    const { client } = fakeClient({ projects: [{ name: 'ZZ Test Elm Street' }] })
    const { writers, made } = recordWriters()
    const said = await writeHeardThrough(input({ kind: 'start', writes: 'start', written: 'Written down. Their start by Wed Nov 25.' }), client, writers)
    expect(made).toEqual([{ kind: 'tradePromise', companyId: 'tile', promise: 'start', projectId: 'p1', dueOn: '2026-11-25', what: 'ZZ Test Tile Co’s start on ZZ Test Elm Street' }])
    expect(said.words).toBe('Written down. Their start by Wed Nov 25. It went on the Board’s promises.')
  })

  it('a refused write says its place and its words, and the line’s day stands', async () => {
    const { client } = fakeClient({ projects: [{ name: 'ZZ Test Elm Street' }] })
    const { writers } = recordWriters('tradePromise')
    const said = await writeHeardThrough(input({ kind: 'start', writes: 'start' }), client, writers)
    expect(said).toEqual({ words: 'Written down. The Board did not take it. The Board is closed for the night.', tone: 'error' })
  })

  it('no ask open: nothing goes, and the words say what to do', async () => {
    const { client } = fakeClient({ projects: [{ name: 'ZZ Test Elm Street' }], gc_trade_packages: [{ id: 'pk1' }], gc_invites: [] })
    const { writers, made } = recordWriters()
    const said = await writeHeardThrough(input(), client, writers)
    expect(made).toEqual([])
    expect(said).toEqual({ words: 'Written down. Their quote by Wed Nov 25. No open ask for ZZ Test Tile Co on this job. Ask them from the Board.', tone: 'info' })
  })
})
