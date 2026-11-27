/**
 * Throwing a painted map away takes its places' pictures (punch list #345): the files under the map's id go after
 * the row, only when the row went, and a bucket that refuses or fails never reaches the answer. The door that keeps
 * a copy of a test map (punch list #443, row 15) is one call to its function, with no delete and no sweep beside it.
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
  /** What the function that keeps a copy answers. */
  rpc: { data: null as unknown, error: null as unknown },
  rpcThrows: null as unknown,
  /** Every call, in order: `delete <id>`, `list <folder> <offset>`, `remove <n>`, `rpc <name> <args>`. */
  calls: [] as string[],
  removed: [] as string[],
}))

vi.mock('../supabase', () => ({
  supabase: {
    rpc: (name: string, args: unknown) => {
      db.calls.push(`rpc ${name} ${JSON.stringify(args)}`)
      if (db.rpcThrows) return Promise.reject(db.rpcThrows)
      return Promise.resolve(db.rpc)
    },
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

import { deletePaintedMap, removePaintedMapPhotoFiles, throwAwayTestPaintedMap } from './paintedMapIo'

/** The sweep is not waited on by the delete: let it run out. */
const settle = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  db.deleted = { data: [{ id: MAP }], error: null }
  db.deleteThrows = false
  db.files = []
  db.listError = null
  db.listThrows = false
  db.removeThrows = false
  db.rpc = { data: null, error: null }
  db.rpcThrows = null
  db.calls = []
  db.removed = []
})

describe('throwAwayTestPaintedMap (punch list #443, row 15)', () => {
  const CALL = `rpc throw_away_test_painted_map {"p_map_id":"${MAP}"}`
  const ANSWER = { ok: true, map_id: MAP, name: 'ZZ Test way in', copied: { painted_maps: 1, painted_map_lines: 2, painted_map_places: 2, painted_map_links: 1, painted_map_link_visits: 1 }, total: 7, carriers: { checklist_items: 1, checklist_tech_tree_group_tasks: 0, job_places: 2 } }

  it('calls the function once with the map’s id, and touches no row and no file itself', async () => {
    db.rpc = { data: ANSWER, error: null }
    db.files = ['aaa.jpg', 'bbb.jpg']
    expect(await throwAwayTestPaintedMap(MAP)).toEqual({ ok: true, value: { copied: 7, tasks: 1, places: 2 } })
    await settle()
    // No delete of the row from here, and no sweep of the bucket: the photos stay for the put-back.
    expect(db.calls).toEqual([CALL])
    expect(db.removed).toEqual([])
  })

  it('passes each refusal the function raises on as its own sentence, with nothing in front', async () => {
    for (const words of [
      'Sign in first.',
      'Only a developer can throw a map away and keep a copy.',
      'The map is not there any more. Read the list again.',
      'Only a test map keeps a copy. This map’s name does not start with ZZ.',
    ]) {
      db.calls = []
      db.rpc = { data: null, error: { code: 'P0001', message: words, details: null, hint: null } }
      db.files = ['aaa.jpg']
      expect(await throwAwayTestPaintedMap(MAP)).toEqual({ ok: false, error: words })
      await settle()
      expect(db.calls).toEqual([CALL])
    }
  })

  it('shows PostgREST’s own answer while the database does not hold the function yet, and falls back to no delete', async () => {
    const missing = 'Could not find the function public.throw_away_test_painted_map(p_map_id) in the schema cache'
    db.rpc = { data: null, error: { code: 'PGRST202', message: missing, details: null, hint: null } }
    db.files = ['aaa.jpg']
    expect(await throwAwayTestPaintedMap(MAP)).toEqual({ ok: false, error: missing })
    await settle()
    expect(db.calls).toEqual([CALL])
    expect(db.removed).toEqual([])
  })

  it('says the map was not thrown away when the refusal carries no words', async () => {
    db.rpc = { data: null, error: {} }
    expect(await throwAwayTestPaintedMap(MAP)).toEqual({ ok: false, error: 'The map was not thrown away.' })
  })

  it('takes an answer it cannot read for no answer, never for a yes', async () => {
    for (const data of [null, { ok: false }, 'ok', []]) {
      db.rpc = { data, error: null }
      expect(await throwAwayTestPaintedMap(MAP)).toEqual({ ok: false, error: 'The database gave no answer. Open the map again to see if it is still there.' })
    }
  })

  it('sends the call once when the signal drops, and says so', async () => {
    db.rpcThrows = new TypeError('Failed to fetch')
    const res = await throwAwayTestPaintedMap(MAP)
    await settle()
    expect(res.ok).toBe(false)
    expect(res.ok ? '' : res.error).not.toBe('')
    expect(db.calls).toEqual([CALL])
  })
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
