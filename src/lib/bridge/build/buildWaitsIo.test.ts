// @vitest-environment jsdom
/**
 * A Build job's wait, read and written (punch list #192, write A, v2.8713) over a stood-in client: the read keeps the
 * waits that are not lifted and answers null when the database refuses it, a mark and a lift call the one function,
 * a refusal keeps the function's own words, and a change tells the other screens to read again.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../supabase', () => ({ supabase: {} }))

const { BUILD_WAITS_CHANGED_EVENT, buildWaitFromRow, buildWaitsIoOver } = await import('./buildWaitsIo')

type Answer = { data: unknown; error: { message: string; code?: string } | null }

function client(a: { rows?: Answer; rpc?: Answer[]; throws?: boolean }) {
  const calls: Array<[string, unknown]> = []
  const chain = {
    select: (cols: string) => {
      calls.push(['select', cols])
      return chain
    },
    is: (col: string, v: null) => {
      calls.push(['is', [col, v]])
      return chain
    },
    order: () => chain,
    limit: async () => {
      if (a.throws) throw new TypeError('Failed to fetch')
      return a.rows ?? { data: [], error: null }
    },
  }
  const from = vi.fn((table: string) => {
    calls.push(['from', table])
    return chain
  })
  const rpc = vi.fn(async (name: string, args?: unknown) => {
    calls.push([name, args])
    return (a.rpc ?? []).shift() ?? { data: { ok: true }, error: null }
  })
  return { db: { from, rpc } as unknown as SupabaseClient, calls }
}

const heard = vi.fn()
afterEach(() => {
  window.removeEventListener(BUILD_WAITS_CHANGED_EVENT, heard)
  heard.mockClear()
})

describe('the read', () => {
  it('asks for the waits that are not lifted, and reads each day on the company’s clock', async () => {
    // 2026-10-27 03:30 UTC is still Monday the 26th, 10:30 PM, where the company is.
    const c = client({ rows: { data: [{ job_id: 'j878', reason: 'gc_not_ready', note: ' Slab pour moved. ', since_at: '2026-10-27T03:30:00.000Z', marked_by_name: 'Dana Office' }], error: null } })
    expect(await buildWaitsIoOver(c.db).loadOpen()).toEqual([{ jobId: 'j878', reason: 'gc_not_ready', note: 'Slab pour moved.', sinceYmd: '2026-10-26', markedByName: 'Dana Office' }])
    expect(c.calls).toEqual([['from', 'job_build_waits'], ['select', 'job_id, reason, note, since_at, marked_by_name'], ['is', ['lifted_at', null]]])
  })

  it('leaves out a row this build cannot read, and guesses at nothing', () => {
    expect(buildWaitFromRow({ job_id: 'j1', reason: 'holiday', note: null, since_at: '2026-10-26T12:00:00.000Z', marked_by_name: null })).toBeNull()
    expect(buildWaitFromRow({ job_id: '', reason: 'weather', note: null, since_at: '2026-10-26T12:00:00.000Z', marked_by_name: null })).toBeNull()
    expect(buildWaitFromRow({ job_id: 'j1', reason: 'weather', note: null, since_at: '2026-10-26T12:00:00.000Z', marked_by_name: null })).toMatchObject({ note: '', markedByName: '' })
  })

  it('a read the database refuses, or one that never came back, is null and never a throw', async () => {
    expect(await buildWaitsIoOver(client({ rows: { data: null, error: { message: 'relation "public.job_build_waits" does not exist', code: '42P01' } } }).db).loadOpen()).toBeNull()
    expect(await buildWaitsIoOver(client({ throws: true }).db).loadOpen()).toBeNull()
    expect(await buildWaitsIoOver(client({}).db).loadOpen()).toEqual([])
  })
})

describe('the two writes', () => {
  it('a mark and a lift call the one function, and each tells the other screens to read again', async () => {
    window.addEventListener(BUILD_WAITS_CHANGED_EVENT, heard)
    const c = client({ rpc: [{ data: { ok: true, waits: true, changed: true }, error: null }, { data: { ok: true, waits: false, changed: true }, error: null }] })
    const io = buildWaitsIoOver(c.db)
    await io.mark('j878', 'other', '  The permit is with the city.  ')
    await io.lift('j878')
    expect(c.calls).toEqual([
      ['set_job_build_wait', { p_job_id: 'j878', p_waits: true, p_reason: 'other', p_note: 'The permit is with the city.' }],
      ['set_job_build_wait', { p_job_id: 'j878', p_waits: false }],
    ])
    expect(heard).toHaveBeenCalledTimes(2)
  })

  it('a refusal in the function’s own words is what the person reads, and nobody is told', async () => {
    window.addEventListener(BUILD_WAITS_CHANGED_EVENT, heard)
    const c = client({ rpc: [{ data: { error: 'Only the office marks a job waiting or lifts a wait.' }, error: null }] })
    await expect(buildWaitsIoOver(c.db).mark('j878', 'weather', '')).rejects.toThrow('Only the office marks a job waiting or lifts a wait.')
    expect(heard).not.toHaveBeenCalled()
  })

  it('a function the database does not have yet throws, and an answer that does not read says nothing changed', async () => {
    const missing = client({ rpc: [{ data: null, error: { message: 'Could not find the function public.set_job_build_wait', code: 'PGRST202' } }] })
    await expect(buildWaitsIoOver(missing.db).lift('j878')).rejects.toThrow()
    const odd = client({ rpc: [{ data: null, error: null }] })
    await expect(buildWaitsIoOver(odd.db).lift('j878')).rejects.toThrow('The job was not changed. Try again in a minute.')
  })
})
