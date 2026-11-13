/**
 * Reads and one write for a task's place (punch list #328). Each read stands alone: a task's own
 * place, a roadmap task's place behind it (PR 5), and the chips from both. A read that fails costs
 * what it was reading and nothing beside it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const db = vi.hoisted(() => ({
  /** What each table answers; an Error makes that read fail. Keyed `table` or `table:bare` for a read with no place column. */
  answers: {} as Record<string, Row[] | Error>,
  reads: [] as string[],
  updates: [] as Array<{ table: string; cols: Row; id: string }>,
  updateError: null as null | { message: string },
}))

vi.mock('../supabase', () => {
  function builder(table: string) {
    let select = ''
    const b: Record<string, unknown> = {}
    for (const m of ['eq', 'in', 'not', 'order', 'limit']) b[m] = () => b
    b.select = (cols: string) => {
      select = cols
      return b
    }
    b.update = (cols: Row) => ({
      eq: (_col: string, id: string) => {
        db.updates.push({ table, cols, id })
        return Promise.resolve({ error: db.updateError })
      },
    })
    b.then = (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
      const key = select.includes('place_') ? table : `${table}:bare`
      db.reads.push(key)
      const answer = db.answers[key] ?? []
      const result = answer instanceof Error ? { data: null, error: { message: answer.message } } : { data: answer, error: null }
      return Promise.resolve(result).then(ok, bad)
    }
    return b
  }
  return { supabase: { from: (table: string) => builder(table) } }
})

import { loadRecentTaskPlaces, loadRoadmapTaskPlace, loadTaskPlacesForItems, saveRoadmapTaskPlace } from './taskPlaceIo'

const place = (name: string, lat: number, at = '2026-11-03T15:00:00Z') => ({ place_name: name, place_lat: lat, place_lng: -98.3, place_accuracy_m: null, place_set_by: 'u1', place_set_at: at })
const none = { place_name: null, place_lat: null, place_lng: null, place_accuracy_m: null, place_set_by: null, place_set_at: null }

beforeEach(() => {
  db.answers = {}
  db.reads = []
  db.updates = []
  db.updateError = null
})

describe('loadTaskPlacesForItems', () => {
  it('a task\'s own place is its place, and a task with none and no roadmap behind it is absent', async () => {
    db.answers.checklist_items = [
      { id: 'a', roadmap_group_task_id: null, ...place('Pump house', 29.55) },
      { id: 'b', roadmap_group_task_id: null, ...none },
    ]
    const got = await loadTaskPlacesForItems(['a', 'b'])
    expect([...got.keys()]).toEqual(['a'])
    expect(got.get('a')?.name).toBe('Pump house')
    // Nothing came from a roadmap, so the roadmap is not asked.
    expect(db.reads).toEqual(['checklist_items'])
  })

  it('a task from a roadmap takes its roadmap task\'s place, and its own place wins when it has one', async () => {
    db.answers.checklist_items = [
      { id: 'a', roadmap_group_task_id: 't1', ...none },
      { id: 'b', roadmap_group_task_id: 't2', ...place('Shop bay 2', 29.56) },
      { id: 'c', roadmap_group_task_id: 't3', ...none },
    ]
    db.answers.checklist_tech_tree_group_tasks = [{ id: 't1', ...place('North gate', 29.57) }, { id: 't2', ...place('Ignored', 29.6) }]
    const got = await loadTaskPlacesForItems(['a', 'b', 'c'])
    expect(got.get('a')?.name).toBe('North gate')
    expect(got.get('b')?.name).toBe('Shop bay 2')
    expect(got.has('c')).toBe(false)
  })

  it('when the tasks\' own place cannot be read, the link is asked for bare and the roadmap\'s places still come', async () => {
    db.answers.checklist_items = new Error('column checklist_items.place_name does not exist')
    db.answers['checklist_items:bare'] = [{ id: 'a', roadmap_group_task_id: 't1' }]
    db.answers.checklist_tech_tree_group_tasks = [{ id: 't1', ...place('North gate', 29.57) }]
    const got = await loadTaskPlacesForItems(['a'])
    expect(got.get('a')?.name).toBe('North gate')
  })

  it('when the roadmap\'s places cannot be read, the tasks\' own stand', async () => {
    db.answers.checklist_items = [
      { id: 'a', roadmap_group_task_id: null, ...place('Pump house', 29.55) },
      { id: 'b', roadmap_group_task_id: 't1', ...none },
    ]
    db.answers.checklist_tech_tree_group_tasks = new Error('column does not exist')
    const got = await loadTaskPlacesForItems(['a', 'b'])
    expect([...got.keys()]).toEqual(['a'])
  })

  it('every read failing is no places, never a throw, and no ids is no read at all', async () => {
    db.answers.checklist_items = new Error('nope')
    db.answers['checklist_items:bare'] = new Error('nope')
    expect((await loadTaskPlacesForItems(['a'])).size).toBe(0)
    db.reads = []
    expect((await loadTaskPlacesForItems([])).size).toBe(0)
    expect(db.reads).toEqual([])
  })
})

describe('loadRecentTaskPlaces', () => {
  it('offers the places of tasks and of roadmap tasks together, one chip a name, newest first', async () => {
    db.answers.checklist_items = [place('Pump house', 29.55, '2026-11-03T15:00:00Z')]
    db.answers.checklist_tech_tree_group_tasks = [place('North gate', 29.57, '2026-11-10T15:00:00Z'), place('pump house', 29.551, '2026-11-01T15:00:00Z')]
    expect((await loadRecentTaskPlaces()).map((p) => p.name)).toEqual(['North gate', 'Pump house'])
  })

  it('one table failing still offers the other\'s', async () => {
    db.answers.checklist_items = [place('Pump house', 29.55)]
    db.answers.checklist_tech_tree_group_tasks = new Error('column does not exist')
    expect((await loadRecentTaskPlaces()).map((p) => p.name)).toEqual(['Pump house'])
  })
})

describe('a roadmap task\'s place', () => {
  it('reads it, and reads nothing as no place', async () => {
    db.answers.checklist_tech_tree_group_tasks = [place('North gate', 29.57)]
    expect((await loadRoadmapTaskPlace('t1'))?.name).toBe('North gate')
    db.answers.checklist_tech_tree_group_tasks = [none]
    expect(await loadRoadmapTaskPlace('t1')).toBeNull()
  })

  it('saves all six columns, clears with six nulls, and hands back the reason when the write is refused', async () => {
    expect(await saveRoadmapTaskPlace('t1', { lat: 29.57, lng: -98.3, name: 'North gate', accuracyM: 6 }, 'u9')).toBeNull()
    expect(db.updates[0]).toMatchObject({ table: 'checklist_tech_tree_group_tasks', id: 't1', cols: { place_name: 'North gate', place_lat: 29.57, place_lng: -98.3, place_accuracy_m: 6, place_set_by: 'u9' } })
    expect(await saveRoadmapTaskPlace('t1', null, 'u9')).toBeNull()
    expect(db.updates[1]!.cols).toEqual(none)
    db.updateError = { message: 'new row violates row-level security policy' }
    expect(await saveRoadmapTaskPlace('t1', null, 'u9')).toContain('row-level security')
  })
})
