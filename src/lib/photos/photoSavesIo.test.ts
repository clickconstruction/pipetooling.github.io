/**
 * Messages, cut 10 (photos saved on arrival): the job's tick, read from `photo_saves` and pressed through `set_photo_save`.
 * A stand-in client records what each call asks for and answers what the test sets.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  ops: [] as Array<[string, unknown[]]>,
  row: null as { on_since: string | null } | null,
  rpc: { data: null as string | null, error: null as { code?: string; message: string } | null },
  rpcArgs: null as unknown,
}))

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      db.ops.push(['from', [table]])
      const builder: Record<string, unknown> = {
        select: (...a: unknown[]) => (db.ops.push(['select', a]), builder),
        eq: (...a: unknown[]) => (db.ops.push(['eq', a]), builder),
        maybeSingle: () => Promise.resolve({ data: db.row, error: null }),
      }
      return builder
    },
    rpc: (fn: string, args: unknown) => {
      db.ops.push(['rpc', [fn]])
      db.rpcArgs = args
      return Promise.resolve(db.rpc)
    },
  },
}))

import { loadPhotoSave, setPhotoSave } from './photoSavesIo'

const HELOTES = 'a0000000-0000-4000-8000-000000000001'

beforeEach(() => {
  db.ops.length = 0
  db.row = null
  db.rpc = { data: null, error: null }
  db.rpcArgs = null
})

describe('loadPhotoSave', () => {
  it('reads the job’s tick by its own column, off when there is no row', async () => {
    expect(await loadPhotoSave(`project:${HELOTES}`)).toBeNull()
    expect(db.ops).toEqual([
      ['from', ['photo_saves']],
      ['select', ['on_since']],
      ['eq', ['project_id', HELOTES]],
    ])
    db.row = { on_since: '2026-10-13T14:05:00.000Z' }
    expect(await loadPhotoSave(`pipeline:${HELOTES}`)).toBe('2026-10-13T14:05:00.000Z')
  })

  it('reads nothing for a key that is not a job', async () => {
    expect(await loadPhotoSave('nothing')).toBeNull()
    expect(db.ops).toEqual([])
  })
})

describe('setPhotoSave', () => {
  it('presses set_photo_save for one job and answers since when', async () => {
    db.rpc = { data: '2026-10-13T14:05:00.000Z', error: null }
    expect(await setPhotoSave(`bid:${HELOTES}`, true)).toBe('2026-10-13T14:05:00.000Z')
    expect(db.rpcArgs).toEqual({ p_bid_id: HELOTES, p_project_id: null, p_jobs_ledger_id: null, p_on: true })
  })

  it('passes the function’s own refusals through in its words', async () => {
    db.rpc = { data: null, error: { code: '42501', message: 'A training account cannot change where a job’s photos go.' } }
    await expect(setPhotoSave(`bid:${HELOTES}`, true)).rejects.toThrow('A training account cannot change where a job’s photos go.')
    db.rpc = { data: null, error: { code: '22023', message: 'Name one job: a bid, a GC project or a Pipeline job.' } }
    await expect(setPhotoSave(`bid:${HELOTES}`, false)).rejects.toThrow('Name one job: a bid, a GC project or a Pipeline job.')
  })

  it('refuses a line on no job before it asks', async () => {
    await expect(setPhotoSave('nothing', true)).rejects.toThrow('This message is not tied to a job.')
    expect(db.ops).toEqual([])
  })
})
