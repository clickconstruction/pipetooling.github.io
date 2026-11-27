/**
 * `everyRow`, the paged read behind the addresses on file (finding 343): a page that fails in a way that is safe to
 * send again is tried again, and the caller sees no failure; a refusal throws at once, with the read's own error.
 * The client is a stub that answers what each case queues.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Answer = { data: unknown; error: unknown }
const db = vi.hoisted(() => ({ queue: [] as Array<{ data: unknown; error: unknown } | Error>, asked: [] as Array<{ table: string; from: number; to: number }> }))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        order: () => ({
          range: (from: number, to: number) => {
            db.asked.push({ table, from, to })
            const next = db.queue.shift() ?? { data: [], error: null }
            return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
          },
        }),
      }),
    }),
  },
}))

import { everyRow, forgetAddressesOnFile, readAddresses } from './useAddressesOnFile'

/** A second try a millisecond later, and no line in the test's output. */
const QUICK = { initialDelay: 1, maxDelay: 2, logRetries: false }
/** The sign-in lock taken from a request, as supabase-js hands it back: the request never left. */
const LOCK: Answer = { data: null, error: { message: 'AbortError: Lock was stolen by another request' } }
const REFUSED: Answer = { data: null, error: { message: 'permission denied for table jobs_ledger', code: '42501' } }
const rows = (n: number, from = 0) => Array.from({ length: n }, (_, i) => ({ id: `r${from + i}` }))

beforeEach(() => {
  db.queue.length = 0
  db.asked.length = 0
  forgetAddressesOnFile()
})

describe('everyRow (finding 343)', () => {
  it('a read that loses the sign-in lock once is sent again, and the caller sees no failure', async () => {
    db.queue.push(LOCK, { data: rows(3), error: null })
    await expect(everyRow('jobs_ledger', 'id', 'id', QUICK)).resolves.toEqual(rows(3))
    // The same page was asked twice.
    expect(db.asked).toEqual([
      { table: 'jobs_ledger', from: 0, to: 999 },
      { table: 'jobs_ledger', from: 0, to: 999 },
    ])
  })

  it('a lock the browser words the other way, and one that is thrown, are sent again too', async () => {
    db.queue.push({ data: null, error: { message: "AbortError: Lock broken by another request with the 'steal' option." } }, new Error('Lock was stolen by another request'), { data: rows(2), error: null })
    await expect(everyRow('bids', 'id', 'id', QUICK)).resolves.toEqual(rows(2))
    expect(db.asked).toHaveLength(3)
  })

  it('a refusal throws at once, with the read’s own error', async () => {
    db.queue.push(REFUSED, { data: rows(3), error: null })
    const thrown = await everyRow('jobs_ledger', 'id', 'id', QUICK).catch((e: unknown) => e)
    expect(thrown).toBe(REFUSED.error)
    expect(db.asked).toHaveLength(1)
  })

  it('a lock that is lost every time gives up after its tries, with the lock’s own error', async () => {
    db.queue.push(LOCK, LOCK, LOCK)
    const thrown = await everyRow('jobs_ledger', 'id', 'id', { ...QUICK, maxRetries: 2 }).catch((e: unknown) => e)
    expect(thrown).toBe(LOCK.error)
    expect(db.asked).toHaveLength(3)
  })

  it('pages on as before, and tries a later page again without asking the first twice', async () => {
    db.queue.push({ data: rows(1000), error: null }, LOCK, { data: rows(4, 1000), error: null })
    const all = await everyRow('jobs_ledger', 'id', 'id', QUICK)
    expect(all).toHaveLength(1004)
    expect(db.asked.map((a) => a.from)).toEqual([0, 1000, 1000])
  })
})

describe('readAddresses (finding 343)', () => {
  it('asks its three tables at once, and one that loses the lock does not fail the read', async () => {
    // Jobs lose the lock; bids and developments answer; then the jobs' second try answers.
    db.queue.push(LOCK, { data: [{ id: 'b1', address: '12 Quarry Rd', development_id: null, bid_number: '901' }], error: null }, { data: [], error: null }, { data: [{ id: 'j1', job_address: '40 Mill St', development_id: null, hcp_number: '1042', click_number: null }], error: null })
    vi.useFakeTimers()
    try {
      const read = readAddresses()
      await vi.advanceTimersByTimeAsync(1100)
      const got = await read
      expect(got.rows.map((r) => `${r.kind}:${r.address}`).sort()).toEqual(['bid:12 Quarry Rd', 'job:40 Mill St'])
    } finally {
      vi.useRealTimers()
    }
    expect(db.asked.map((a) => a.table)).toEqual(['jobs_ledger', 'bids', 'developments', 'jobs_ledger'])
  })
})
