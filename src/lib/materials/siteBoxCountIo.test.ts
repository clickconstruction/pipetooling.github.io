import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('../supabase', () => ({ supabase: {} }))

import { fetchSiteDoorFacts } from './siteBoxCountIo'

/** A stand-in client: `rpc` answers as told, and every table read answers a job on no site with `headCount` live boxes. */
function client(rpc: { data: unknown; error: { code?: string; message?: string } | null }, headCount = 0) {
  const calls: string[] = []
  const from = (table: string) => {
    calls.push(table)
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'is', 'neq']) b[m] = () => b
    b.maybeSingle = () => Promise.resolve({ data: { development_id: null }, error: null })
    b.then = (f: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null, count: headCount }).then(f)
    return b
  }
  return { calls, client: { rpc: () => Promise.resolve(rpc), from } as unknown as SupabaseClient }
}

describe('fetchSiteDoorFacts', () => {
  it('takes the database’s one answer and reads nothing else', async () => {
    const c = client({ data: { boxes: 14, due: 2, stickers: 6 }, error: null })
    expect(await fetchSiteDoorFacts('job-1', c.client)).toEqual({ boxes: 14, due: 2, stickers: 6 })
    expect(c.calls).toEqual([])
  })
  it('falls back to the head count on a database that does not have the function yet', async () => {
    for (const code of ['PGRST202', '42883']) {
      const c = client({ data: null, error: { code, message: 'Could not find the function' } }, 9)
      expect(await fetchSiteDoorFacts('job-1', c.client), code).toEqual({ boxes: 9, due: 0, stickers: 0 })
      expect(c.calls).toEqual(['jobs_ledger', 'job_containers'])
    }
  })
  it('falls back on an answer that is not one', async () => {
    const c = client({ data: null, error: null }, 4)
    expect(await fetchSiteDoorFacts('job-1', c.client)).toEqual({ boxes: 4, due: 0, stickers: 0 })
  })
  it('throws any other refusal for the caller to keep quiet about', async () => {
    const c = client({ data: null, error: { code: '42501', message: 'permission denied' } })
    await expect(fetchSiteDoorFacts('job-1', c.client)).rejects.toMatchObject({ code: '42501' })
  })
})
