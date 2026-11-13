/**
 * The giver's photo of the spot (punch list #328, PR 6): the upload and the pointer are two writes
 * and both must land, a failed pointer takes the upload back, and the reads fall to "no photo".
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const db = vi.hoisted(() => ({
  answers: {} as Record<string, Row[] | Error>,
  uploads: [] as string[],
  uploadError: null as null | { message: string },
  removed: [] as string[],
  updates: [] as Array<{ table: string; cols: Row; id: string }>,
  updateError: null as null | { message: string },
}))

vi.mock('../supabase', () => {
  function builder(table: string) {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'not', 'order', 'limit']) b[m] = () => b
    b.update = (cols: Row) => ({
      eq: (_c: string, id: string) => {
        db.updates.push({ table, cols, id })
        return Promise.resolve({ error: db.updateError })
      },
    })
    b.then = (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
      const answer = db.answers[table] ?? []
      const result = answer instanceof Error ? { data: null, error: { message: answer.message } } : { data: answer, error: null }
      return Promise.resolve(result).then(ok, bad)
    }
    return b
  }
  return {
    supabase: {
      from: (table: string) => builder(table),
      storage: {
        from: () => ({
          upload: (path: string) => {
            db.uploads.push(path)
            return Promise.resolve({ error: db.uploadError })
          },
          remove: (paths: string[]) => {
            db.removed.push(...paths)
            return Promise.resolve({ error: null })
          },
          createSignedUrls: (paths: string[]) => Promise.resolve({ data: paths.map((p) => ({ path: p, signedUrl: `signed:${p}` })) }),
        }),
      },
    },
  }
})

import { loadTaskSpotPhotoPath, loadTaskSpotPhotoPathsForItems, putTaskSpotPhoto, removeTaskSpotPhotoFile, taskSpotPhotoUrls } from './taskSpotPhotoIo'

const ITEM = '20000000-0000-0000-0000-000000000001'
const TASK = '10000000-0000-0000-0000-000000000001'
const blob = new Blob(['x'], { type: 'image/jpeg' })

beforeEach(() => {
  db.answers = {}
  db.uploads = []
  db.uploadError = null
  db.removed = []
  db.updates = []
  db.updateError = null
})

describe('putTaskSpotPhoto', () => {
  it('uploads under the task\'s name and points the task at the picture', async () => {
    expect(await putTaskSpotPhoto({ kind: 'item', id: ITEM }, 'p1', blob)).toEqual({ path: `item/${ITEM}/p1.jpg` })
    expect(db.uploads).toEqual([`item/${ITEM}/p1.jpg`])
    expect(db.updates).toEqual([{ table: 'checklist_items', cols: { spot_photo_path: `item/${ITEM}/p1.jpg` }, id: ITEM }])
  })

  it('a roadmap task\'s picture goes under roadmap/ and onto the roadmap task', async () => {
    await putTaskSpotPhoto({ kind: 'roadmap', id: TASK }, 'p1', blob)
    expect(db.uploads).toEqual([`roadmap/${TASK}/p1.jpg`])
    expect(db.updates[0]!.table).toBe('checklist_tech_tree_group_tasks')
  })

  it('an upload that is refused says why and writes nothing', async () => {
    db.uploadError = { message: 'new row violates row-level security policy' }
    const r = await putTaskSpotPhoto({ kind: 'item', id: ITEM }, 'p1', blob)
    expect('error' in r && r.error).toContain('row-level security')
    expect(db.updates).toEqual([])
  })

  it('a pointer that does not save takes the upload back, so no picture is left with no task', async () => {
    db.updateError = { message: 'column "spot_photo_path" does not exist' }
    const r = await putTaskSpotPhoto({ kind: 'item', id: ITEM }, 'p1', blob)
    expect('error' in r && r.error).toContain('spot_photo_path')
    await new Promise((res) => setTimeout(res, 0))
    expect(db.removed).toEqual([`item/${ITEM}/p1.jpg`])
  })
})

describe('reading', () => {
  it('a task\'s own photo is its photo, and a task from a roadmap with none takes its roadmap task\'s', async () => {
    db.answers.checklist_items = [
      { id: 'a', roadmap_group_task_id: null, spot_photo_path: `item/${ITEM}/p1.jpg` },
      { id: 'b', roadmap_group_task_id: TASK, spot_photo_path: null },
      { id: 'c', roadmap_group_task_id: null, spot_photo_path: null },
    ]
    db.answers.checklist_tech_tree_group_tasks = [{ id: TASK, spot_photo_path: `roadmap/${TASK}/p2.jpg` }]
    const got = await loadTaskSpotPhotoPathsForItems(['a', 'b', 'c'])
    expect(Object.fromEntries(got)).toEqual({ a: `item/${ITEM}/p1.jpg`, b: `roadmap/${TASK}/p2.jpg` })
  })

  it('a path of another shape reads as no photo', async () => {
    db.answers.checklist_items = [{ id: 'a', roadmap_group_task_id: null, spot_photo_path: 'somewhere/else.jpg' }]
    expect((await loadTaskSpotPhotoPathsForItems(['a'])).size).toBe(0)
    db.answers.checklist_items = [{ spot_photo_path: '../../x.jpg' }]
    expect(await loadTaskSpotPhotoPath({ kind: 'item', id: ITEM })).toBeNull()
  })

  it('a read that fails is no photo, never a throw', async () => {
    db.answers.checklist_items = new Error('column does not exist')
    expect((await loadTaskSpotPhotoPathsForItems(['a'])).size).toBe(0)
    expect(await loadTaskSpotPhotoPath({ kind: 'item', id: ITEM })).toBeNull()
  })

  it('signs only paths of the one shape, and removes only those', async () => {
    const urls = await taskSpotPhotoUrls([`item/${ITEM}/p1.jpg`, 'junk'])
    expect(Object.fromEntries(urls)).toEqual({ [`item/${ITEM}/p1.jpg`]: `signed:item/${ITEM}/p1.jpg` })
    await removeTaskSpotPhotoFile('junk')
    await removeTaskSpotPhotoFile(`item/${ITEM}/p1.jpg`)
    expect(db.removed).toEqual([`item/${ITEM}/p1.jpg`])
  })
})
