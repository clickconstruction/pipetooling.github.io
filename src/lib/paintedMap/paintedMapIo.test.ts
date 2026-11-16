/**
 * Throwing a painted map away takes its places' pictures (punch list #345): the files under the map's id go after
 * the row, only when the row went, and a bucket that refuses or fails never reaches the answer.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const MAP = '11111111-2222-4333-8444-555555555555'

const db = vi.hoisted(() => ({
  /** What the delete of the row answers. */
  deleted: { data: [] as Array<{ id: string }> | null, error: null as null | { message: string } },
  deleteThrows: false,
  /** The file names the bucket shows the caller under the map's id. */
  files: [] as string[],
  listError: null as null | { message: string },
  listThrows: false,
  removeThrows: false,
  /** Every call, in order: `delete <id>`, `list <folder> <offset>`, `remove <n>`. */
  calls: [] as string[],
  removed: [] as string[],
}))

vi.mock('../supabase', () => ({
  supabase: {
    from: () => ({
      delete: () => ({
        eq: (_column: string, id: string) => ({
          select: () => {
            db.calls.push(`delete ${id}`)
            if (db.deleteThrows) return Promise.reject(new Error('offline'))
            return Promise.resolve(db.deleted)
          },
        }),
      }),
    }),
    storage: {
      from: (bucket: string) => ({
        list: (folder: string, opts: { limit: number; offset: number }) => {
          db.calls.push(`list ${bucket} ${folder} ${opts.offset}`)
          if (db.listThrows) return Promise.reject(new Error('offline'))
          if (db.listError) return Promise.resolve({ data: null, error: db.listError })
          return Promise.resolve({ data: db.files.slice(opts.offset, opts.offset + opts.limit).map((name) => ({ name })), error: null })
        },
        remove: (paths: string[]) => {
          db.calls.push(`remove ${paths.length}`)
          if (db.removeThrows) return Promise.reject(new Error('offline'))
          db.removed.push(...paths)
          return Promise.resolve({ data: [], error: null })
        },
      }),
    },
  },
}))

import { deletePaintedMap, removePaintedMapPhotoFiles } from './paintedMapIo'

/** The sweep is not waited on by the delete: let it run out. */
const settle = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  db.deleted = { data: [{ id: MAP }], error: null }
  db.deleteThrows = false
  db.files = []
  db.listError = null
  db.listThrows = false
  db.removeThrows = false
  db.calls = []
  db.removed = []
})

describe('deletePaintedMap', () => {
  it('removes the files under the map after the row is gone', async () => {
    db.files = ['aaa.jpg', 'bbb.jpg']
    expect(await deletePaintedMap(MAP)).toEqual({ ok: true, value: true })
    await settle()
    expect(db.calls).toEqual([`delete ${MAP}`, `list painted-map-photos ${MAP} 0`, 'remove 2'])
    expect(db.removed).toEqual([`${MAP}/aaa.jpg`, `${MAP}/bbb.jpg`])
  })

  it('touches no file when the row did not go', async () => {
    db.deleted = { data: [], error: null }
    db.files = ['aaa.jpg']
    expect(await deletePaintedMap(MAP)).toEqual({ ok: true, value: false })
    await settle()
    expect(db.calls).toEqual([`delete ${MAP}`])
  })

  it('touches no file when the delete is refused, and says why', async () => {
    db.deleted = { data: null, error: { message: 'new row violates row-level security policy' } }
    db.files = ['aaa.jpg']
    const res = await deletePaintedMap(MAP)
    await settle()
    expect(res.ok).toBe(false)
    expect(db.calls).toEqual([`delete ${MAP}`])
  })

  it('touches no file when the delete never lands', async () => {
    db.deleteThrows = true
    db.files = ['aaa.jpg']
    const res = await deletePaintedMap(MAP)
    await settle()
    expect(res.ok).toBe(false)
    expect(db.calls).toEqual([`delete ${MAP}`])
  })

  it('answers that the map went though the bucket fails every way it can', async () => {
    db.files = ['aaa.jpg']
    db.listThrows = true
    expect(await deletePaintedMap(MAP)).toEqual({ ok: true, value: true })
    await settle()
    db.listThrows = false
    db.listError = { message: 'no' }
    expect(await deletePaintedMap(MAP)).toEqual({ ok: true, value: true })
    await settle()
    db.listError = null
    db.removeThrows = true
    expect(await deletePaintedMap(MAP)).toEqual({ ok: true, value: true })
    await settle()
    expect(db.removed).toEqual([])
  })
})

describe('removePaintedMapPhotoFiles', () => {
  it('removes nothing when the bucket shows the caller no file', async () => {
    await removePaintedMapPhotoFiles(MAP)
    expect(db.calls).toEqual([`list painted-map-photos ${MAP} 0`])
  })

  it('leaves a name of any other shape alone', async () => {
    db.files = ['aaa.jpg', 'notes.txt', 'folder', '.emptyFolderPlaceholder']
    await removePaintedMapPhotoFiles(MAP)
    expect(db.removed).toEqual([`${MAP}/aaa.jpg`])
  })

  it('reads every page and removes a hundred at a time', async () => {
    db.files = Array.from({ length: 230 }, (_, i) => `p${String(i).padStart(3, '0')}.jpg`)
    await removePaintedMapPhotoFiles(MAP)
    expect(db.calls).toEqual([
      `list painted-map-photos ${MAP} 0`,
      `list painted-map-photos ${MAP} 100`,
      `list painted-map-photos ${MAP} 200`,
      'remove 100',
      'remove 100',
      'remove 30',
    ])
    expect(db.removed).toHaveLength(230)
  })

  it('stops at a thousand files', async () => {
    db.files = Array.from({ length: 1200 }, (_, i) => `p${String(i).padStart(4, '0')}.jpg`)
    await removePaintedMapPhotoFiles(MAP)
    expect(db.removed).toHaveLength(1000)
  })

  it('lists nothing for an id that is not one, so the top folder is never read', async () => {
    await removePaintedMapPhotoFiles('')
    await removePaintedMapPhotoFiles('not-a-map')
    await removePaintedMapPhotoFiles(`${MAP}/deeper`)
    expect(db.calls).toEqual([])
  })

  it('never throws', async () => {
    db.files = ['aaa.jpg']
    db.removeThrows = true
    await expect(removePaintedMapPhotoFiles(MAP)).resolves.toBeUndefined()
  })
})
