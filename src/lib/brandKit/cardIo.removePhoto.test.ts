import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

import { PERSON_PHOTOS_BUCKET, supabaseCardIo } from './cardIo'

/** A client that records the row write and the file removal, and answers each as told. */
function fakeClient(row: { data: unknown; error: unknown }, file: { data: unknown; error: unknown } | Error) {
  const calls: Array<[string, unknown[]]> = []
  const query: Record<string, unknown> = {
    update: (...a: unknown[]) => (calls.push(['update', a]), query),
    eq: (...a: unknown[]) => (calls.push(['eq', a]), query),
    select: (...a: unknown[]) => (calls.push(['select', a]), Promise.resolve(row)),
  }
  const client = {
    from: (table: string) => (calls.push(['from', [table]]), query),
    storage: {
      from: (bucket: string) => ({
        remove: (paths: string[]) => {
          calls.push(['remove', [bucket, paths]])
          return file instanceof Error ? Promise.reject(file) : Promise.resolve(file)
        },
      }),
    },
  }
  return { client, calls }
}

const PATH = 'u1/photo-1.jpg'

describe('supabaseCardIo().removePhoto', () => {
  it('clears the path and the crop on the row that still names the photo, then deletes the file', async () => {
    const { client, calls } = fakeClient({ data: [{ id: 'u1' }], error: null }, { data: [{ name: PATH }], error: null })
    expect(await supabaseCardIo(client).removePhoto('u1', PATH)).toEqual({ fileGone: true })
    expect(calls).toEqual([
      ['from', ['users']],
      ['update', [{ photo_path: null, photo_crop: null }]],
      ['eq', ['id', 'u1']],
      ['eq', ['photo_path', PATH]],
      ['select', ['id']],
      ['remove', [PERSON_PHOTOS_BUCKET, [PATH]]],
    ])
  })
  it('throws and leaves the file when the row is refused or names another photo', async () => {
    const { client, calls } = fakeClient({ data: [], error: null }, { data: [{ name: PATH }], error: null })
    await expect(supabaseCardIo(client).removePhoto('u1', PATH)).rejects.toThrow(/was not removed/)
    expect(calls.some(([op]) => op === 'remove')).toBe(false)
  })
  it('throws the database’s reason and leaves the file', async () => {
    const { client, calls } = fakeClient({ data: null, error: { message: 'permission denied for table users', code: '42501' } }, { data: [], error: null })
    await expect(supabaseCardIo(client).removePhoto('u1', PATH)).rejects.toBeTruthy()
    expect(calls.some(([op]) => op === 'remove')).toBe(false)
  })
  it('says the file stayed when the bucket removes nothing, refuses, or fails', async () => {
    for (const file of [{ data: [], error: null }, { data: null, error: { message: 'refused' } }, new Error('no signal')]) {
      const { client } = fakeClient({ data: [{ id: 'u1' }], error: null }, file)
      expect(await supabaseCardIo(client).removePhoto('u1', PATH)).toEqual({ fileGone: false })
    }
  })
})
