/**
 * The send behind a bid photo (punch list #306): the bytes to the bucket, never as an upsert, then the row. v2.7133: a
 * resend whose first upload landed (its answer lost to the signal) finds its own bytes in the bucket and goes on to
 * the row. Before, the upload was an upsert, and the bucket has no update policy: the project refused every resend
 * with *new row violates row-level security policy*, so a kept photo waited until the next morning and never landed.
 * The storage client is mocked here with the shapes the project answered on 2026-11-13.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  uploads: [] as Array<{ bucket: string; path: string; upsert: unknown }>,
  removed: [] as string[][],
  rows: [] as Array<{ table: string; row: Record<string, unknown>; onConflict: unknown }>,
  uploadError: null as unknown,
  rowError: null as unknown,
}))

vi.mock('../supabase', () => ({
  supabase: {
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, _blob: Blob, opts?: { upsert?: unknown }) => {
          db.uploads.push({ bucket, path, upsert: opts?.upsert })
          return db.uploadError ? { data: null, error: db.uploadError } : { data: { path }, error: null }
        },
        remove: async (paths: string[]) => {
          db.removed.push(paths)
          return { data: [], error: null }
        },
      }),
    },
    from: (table: string) => ({
      upsert: async (row: Record<string, unknown>, opts?: { onConflict?: unknown }) => {
        db.rows.push({ table, row, onConflict: opts?.onConflict })
        return { error: db.rowError }
      },
    }),
  },
}))

import { sendBidPhoto } from './bidPhotosIo'

/** A storage answer as the client keeps it: the body's status code on an HTTP 400. */
const storageError = (message: string, statusCode: string) => Object.assign(new Error(message), { name: 'StorageApiError', status: 400, statusCode })

const input = {
  id: '11111111-2222-4333-8444-555555555555',
  jobId: 'a0000000-0000-4000-8000-000000000306',
  blob: new Blob([new Uint8Array(310)], { type: 'image/jpeg' }),
  byUserId: 'u1',
  byName: 'Dana Whitfield',
  takenAt: '2026-11-12T20:41:00Z',
  originalBytes: 4_200_000,
  width: 1600,
  height: 1200,
}
const path = `${input.jobId}/${input.id}.jpg`

beforeEach(() => {
  db.uploads.length = 0
  db.removed.length = 0
  db.rows.length = 0
  db.uploadError = null
  db.rowError = null
})

describe('sendBidPhoto', () => {
  it('uploads once, never as an upsert, then writes the row on the shot’s id', async () => {
    expect(await sendBidPhoto(input)).toEqual({ storagePath: path })
    expect(db.uploads).toEqual([{ bucket: 'bid-photos', path, upsert: false }])
    expect(db.rows).toHaveLength(1)
    expect(db.rows[0]).toMatchObject({ table: 'bid_photos', onConflict: 'id', row: { id: input.id, bid_id: input.jobId, by_user_id: 'u1', by_name: 'Dana Whitfield', storage_path: path } })
  })

  it('a resend whose bytes are already in the bucket goes on to the row and takes nothing back', async () => {
    db.uploadError = storageError('The resource already exists', '409')
    expect(await sendBidPhoto(input)).toEqual({ storagePath: path })
    expect(db.rows).toHaveLength(1)
    expect(db.removed).toEqual([])
  })

  it('an upload refused for any other reason throws the refusal and writes no row', async () => {
    db.uploadError = storageError('new row violates row-level security policy', '403')
    await expect(sendBidPhoto(input)).rejects.toMatchObject({ name: 'PhotoSendError', message: expect.stringContaining('row-level security') })
    expect(db.rows).toEqual([])
  })

  it('a lost signal at the upload throws with the network kind, so the shot is kept', async () => {
    db.uploadError = new TypeError('Failed to fetch')
    await expect(sendBidPhoto(input)).rejects.toMatchObject({ name: 'PhotoSendError', kind: 'network' })
    expect(db.rows).toEqual([])
  })

  it('a row that refuses takes the bytes back, as before', async () => {
    db.rowError = { message: 'permission denied for table bid_photos', code: '42501' }
    await expect(sendBidPhoto(input)).rejects.toMatchObject({ name: 'PhotoSendError' })
    expect(db.removed).toEqual([[path]])
  })
})
