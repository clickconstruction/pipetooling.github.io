/** A task's place from the dev seat (v2.7589): the four ways to say one, the point behind each, and the map rule held equal to the windows'. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  TASK_PLACE_VERBS,
  findPlace,
  geocodeKey,
  isTaskPlaceVerb,
  mapAfterPlaceChange,
  placeAskInput,
  placeNameFromAddress,
  taskPlaceDryRun,
  taskPlaceInput,
  taskPlacePatch,
  type CensusGeocode,
  type TaskPlaceWorld,
} from '../../../supabase/functions/_shared/devMcpTaskPlace'
import type { Reader, Row, RowsQuery } from '../../../supabase/functions/_shared/devMcpComposites'
import { WRITE_VERBS, isWriteVerb, planVerbFor, stateGuarded, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { taskMapAfterPlace, taskMapColumn, taskMapDraftFromSaved } from '../tasks/taskMapPick'
import { taskPlaceColumns, type TaskPlace } from '../tasks/taskPlace'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const GEOCODE_ONE = readFileSync('supabase/functions/geocode-one/index.ts', 'utf8')
const EDIT_WINDOW = readFileSync('src/components/ChecklistItemEditModal.tsx', 'utf8')

const TASK = '99999999-1111-4111-8111-111111111111'
const DEV = 'ffffffff-1111-4111-8111-111111111111'
const HASH = 'a'.repeat(64)
const ME = { userId: DEV }

const ask = (src: Record<string, unknown>) => placeAskInput(src)
const noCensus: CensusGeocode = async () => ({ ok: false, error: 'not_found' })
function readerOf(tables: Record<string, Row[]>, asked: string[] = []): Reader {
  return {
    rpc: async () => [],
    rows: async (table: string, query: RowsQuery) => {
      asked.push(table)
      return (tables[table] ?? []).filter((r) => (query.filters ?? []).every((f) => (f.op === 'eq' ? String(r[f.column] ?? '') === String(f.value) : f.op === 'gte' ? typeof r[f.column] === 'number' : true)))
    },
  }
}
const before: TaskPlace = { name: 'ZZ gate', lat: 30.2, lng: -97.7, accuracyM: null, setBy: DEV, setAt: '2026-11-10T15:00:00Z', mapId: null }
const worldOf = (over: Partial<TaskPlaceWorld> = {}): TaskPlaceWorld => ({ task: { id: TASK, words: 'ZZ walk the yard' }, home: { table: 'checklist_items', rowId: TASK, on: 'task' }, before: null, mapBefore: null, found: { ok: true, lat: 30.3, lng: -97.6, name: 'ZZ pump house', found_by: 'the point you gave' }, ...over })

describe('the place verbs are on the allowlist with no wrapper RPC', () => {
  it('are two write verbs, plan before apply, named by the server and the README', () => {
    expect(TASK_PLACE_VERBS).toEqual(['plan_task_place', 'apply_task_place'])
    for (const v of TASK_PLACE_VERBS) {
      expect(isTaskPlaceVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`name: '${v}'`)
      expect(SERVER).toContain(`case '${v}':`)
    }
    expect(planVerbFor('apply_task_place')).toBe('plan_task_place')
    expect(SERVER).toContain("const SERVER_VERSION = '0.97.0'")
    expect(SERVER).toContain('plan_task_place → apply_task_place')
    expect(README).toContain('`plan_task_place(place)`')
    // A place set, taken off and set again is a second act: the world refuses a replay, the call log is not asked.
    expect(stateGuarded('apply_task_place')).toBe(true)
    expect(SERVER.slice(SERVER.indexOf("    case 'plan_task_place':"), SERVER.indexOf("    case 'plan_activity_note':"))).not.toContain('hooks.priorApply')
  })

  it('writes what the Edit window writes: the place kernel\'s columns, and the map by the window\'s rule', () => {
    expect(EDIT_WINDOW).toContain('taskPlaceColumns(place, authUser?.id ?? null, new Date().toISOString())')
    expect(EDIT_WINDOW).toContain('taskMapColumn(taskMap)')
    // The one write: an update that asks for the row it changed.
    expect(SERVER).toContain("const wrote = await restRows(session, 'PATCH', world.home.table, `id=eq.${world.home.rowId}&select=id`, taskPlacePatch(p, dry.patch, world.home, new Date().toISOString()), 'return=representation')")
    // No geocoder that fills the cache: the plan must write nothing.
    expect(SERVER).not.toContain("'geocode-one'")
  })

  it('the cache key is geocode-one\'s own normalizing', () => {
    expect(GEOCODE_ONE).toContain("return address.trim().replace(/\\s+/g, ' ').toLowerCase()")
    expect(geocodeKey('  14 Maple  Ct,  Marlow, TX ')).toBe('14 maple ct, marlow, tx')
    expect(placeNameFromAddress('14 Maple Ct, Marlow, TX 78000')).toBe('14 Maple Ct')
  })
})

describe('a place, said one of four ways', () => {
  it('takes exactly one way, and a short name with all but like', () => {
    expect(ask({ lat: 30.1, lng: -97.7, name: ' ZZ  gate ' })).toEqual({ ok: true, ask: { how: 'point', lat: 30.1, lng: -97.7, name: 'ZZ gate' } })
    expect(ask({ address: ' 14 Maple Ct,  Marlow, TX ' })).toEqual({ ok: true, ask: { how: 'address', address: '14 Maple Ct, Marlow, TX' } })
    expect(ask({ job: 'J1032', name: 'ZZ slab' })).toEqual({ ok: true, ask: { how: 'job', job: 'J1032', name: 'ZZ slab' } })
    expect(ask({ like: 'ZZ gate' })).toEqual({ ok: true, ask: { how: 'like', like: 'ZZ gate' } })
    expect(ask({})).toMatchObject({ ok: false, why: expect.stringContaining('not none') })
    expect(ask({ lat: 30.1, lng: -97.7, address: '14 Maple Ct, Marlow' })).toMatchObject({ ok: false, why: expect.stringContaining('not several') })
    expect(ask({ lat: 30.1 })).toMatchObject({ ok: false, why: expect.stringContaining('both of them') })
    expect(ask({ lat: 0, lng: 0 })).toMatchObject({ ok: false })
    expect(ask({ address: '1 A' })).toMatchObject({ ok: false, why: expect.stringContaining('street address') })
    expect(ask({ like: 'ZZ gate', name: 'ZZ other' })).toMatchObject({ ok: false, why: expect.stringContaining('as it is named already') })
    expect(ask({ lat: 30.1, lng: -97.7, name: 'x'.repeat(41) })).toMatchObject({ ok: false, why: expect.stringContaining('the most is 40') })
  })

  it('the verb needs a task and a place or a clear, never both', () => {
    expect(taskPlaceInput('plan_task_place', { place: { task: TASK, clear: true } })).toMatchObject({ ok: true, p: { action: 'clear', task: TASK } })
    expect(taskPlaceInput('plan_task_place', { place: { task: TASK, clear: true, lat: 1, lng: 1 } })).toMatchObject({ ok: false })
    expect(taskPlaceInput('plan_task_place', { place: { task: TASK, clear: false } })).toMatchObject({ ok: false })
    expect(taskPlaceInput('plan_task_place', { place: { lat: 30.1, lng: -97.7 } })).toMatchObject({ ok: false, error: expect.stringContaining('task names the task') })
    expect(taskPlaceInput('plan_task_place', {})).toMatchObject({ ok: false })
    expect(writeRpcBody('apply_task_place', { place: { task: TASK, clear: true } })).toMatchObject({ ok: false })
    expect(writeRpcBody('apply_task_place', { place: { task: TASK, clear: true }, plan_hash: HASH })).toMatchObject({ ok: true, rpc: null, step: 'apply', planHash: HASH })
  })
})

describe('the point behind the words', () => {
  it('an address is the saved point first; the Census is asked only when the app has none, and a failed save is no point', async () => {
    let asked = 0
    const census: CensusGeocode = async () => (asked++, { ok: true, lat: 30.44, lng: -97.52 })
    const saved = readerOf({ address_geocodes: [{ address_normalized: '14 maple ct, marlow, tx', lat: 30.31, lng: -97.61, geocode_error: null }] })
    expect(await findPlace(saved, census, { how: 'address', address: '14 Maple Ct, Marlow, TX' })).toMatchObject({ ok: true, lat: 30.31, lng: -97.61, name: '14 Maple Ct' })
    expect(asked).toBe(0)
    const failed = readerOf({ address_geocodes: [{ address_normalized: '14 maple ct, marlow, tx', lat: 0, lng: 0, geocode_error: 'not_found' }] })
    expect(await findPlace(failed, census, { how: 'address', address: '14 Maple Ct, Marlow, TX', name: 'ZZ lot' })).toMatchObject({ ok: true, lat: 30.44, name: 'ZZ lot', found_by: expect.stringContaining('the Census geocoder') })
    expect(asked).toBe(1)
  })

  it('says which of the two failed when no point is found', async () => {
    const none = await findPlace(readerOf({}), noCensus, { how: 'address', address: '1 Nowhere Rd, Marlow, TX' })
    expect(none).toMatchObject({ ok: false, refused: expect.stringContaining('knows no such address') })
    const down = await findPlace(readerOf({}), async () => ({ ok: false, error: 'census_upstream', detail: 'HTTP 503' }), { how: 'address', address: '1 Nowhere Rd, Marlow, TX' })
    expect(down).toMatchObject({ ok: false, refused: expect.stringContaining('did not answer (HTTP 503)') })
  })

  it('like finds a place in use by its name: the newest point a name was given, and several names are listed', async () => {
    const rows = (name: string, lat: number, at: string): Row => ({ place_name: name, place_lat: lat, place_lng: -97.7, place_accuracy_m: null, place_set_by: DEV, place_set_at: at, painted_map_id: null })
    const reader = readerOf({ checklist_items: [rows('ZZ gate', 30.2, '2026-11-01T00:00:00Z'), rows('ZZ gate', 30.9, '2026-11-09T00:00:00Z'), rows('ZZ gate house', 30.5, '2026-11-02T00:00:00Z')], checklist_tech_tree_group_tasks: [rows('ZZ slab', 30.6, '2026-11-03T00:00:00Z')] })
    expect(await findPlace(reader, noCensus, { how: 'like', like: 'zz GATE' })).toMatchObject({ ok: true, lat: 30.9, name: 'ZZ gate' })
    expect(await findPlace(reader, noCensus, { how: 'like', like: 'slab' })).toMatchObject({ ok: true, lat: 30.6, name: 'ZZ slab' })
    expect(await findPlace(reader, noCensus, { how: 'like', like: 'ZZ' })).toMatchObject({ ok: false, refused: expect.stringContaining('matches 3 places') })
    expect(await findPlace(readerOf({}), noCensus, { how: 'like', like: 'ZZ gate' })).toMatchObject({ ok: false, refused: expect.stringContaining('No task carries a named place yet') })
  })
})

describe('the dry run and the map rule', () => {
  it('the map after a place change is the task windows\' own rule, case for case', () => {
    const next = { lat: 30.3, lng: -97.6, name: 'ZZ pump house', accuracyM: null }
    for (const [place, mapBefore] of [[before, 'map-1'], [before, null], [null, 'map-1'], [null, null]] as const) {
      const saved = place ? { ...place, mapId: mapBefore } : null
      const windowMap = taskMapAfterPlace(taskMapDraftFromSaved(saved, saved ? null : mapBefore), next)
      expect(mapAfterPlaceChange(place, mapBefore), `${place ? 'a place' : 'no place'}, ${mapBefore ?? 'no map'}`).toBe(taskMapColumn(windowMap).painted_map_id)
      // A place that brings its own way in, as a chip does, makes that the task's map whatever was there.
      const chip = taskMapAfterPlace(taskMapDraftFromSaved(saved, saved ? null : mapBefore), { ...next, mapId: 'map-of-the-chip' })
      expect(mapAfterPlaceChange(place, mapBefore, 'map-of-the-chip')).toBe(taskMapColumn(chip).painted_map_id)
      // And when the place goes.
      if (place) expect(mapAfterPlaceChange(place, mapBefore)).toBe(taskMapColumn(taskMapAfterPlace(taskMapDraftFromSaved(saved, null), null)).painted_map_id)
    }
  })

  it('a set is the place kernel\'s columns less the stamp, and the apply adds the write\'s own clock', () => {
    const dry = taskPlaceDryRun({ action: 'set', task: TASK, ask: { how: 'point', lat: 30.3, lng: -97.6, name: 'ZZ pump house' } }, worldOf(), ME)
    if (!dry.ok) throw new Error(dry.refused)
    const { place_set_at: _at, ...columns } = taskPlaceColumns({ lat: 30.3, lng: -97.6, name: 'ZZ pump house', accuracyM: null }, DEV, 'x')
    expect(dry.patch).toEqual(columns)
    expect(JSON.stringify(dry.reply)).not.toContain('place_set_at":')
    const now = '2026-11-17T18:00:00.000Z'
    expect(taskPlacePatch({ action: 'set', task: TASK, ask: { how: 'point', lat: 30.3, lng: -97.6 } }, dry.patch, { table: 'checklist_items', rowId: TASK, on: 'task' }, now)).toEqual({ ...columns, place_set_at: now, updated_at: now })
    expect(taskPlacePatch({ action: 'clear', task: TASK }, { place_lat: null }, { table: 'checklist_tech_tree_group_tasks', rowId: 'r', on: 'roadmap task' }, now)).toEqual({ place_lat: null })
  })

  it('a place with no name says what that costs, and a clear writes the kernel\'s seven nulls', () => {
    const bare = taskPlaceDryRun({ action: 'set', task: TASK, ask: { how: 'point', lat: 30.3, lng: -97.6 } }, worldOf({ found: { ok: true, lat: 30.3, lng: -97.6, name: '', found_by: 'the point you gave' } }), ME)
    expect(bare.ok && bare.reply.no_name).toContain('Pass name')
    const clear = taskPlaceDryRun({ action: 'clear', task: TASK }, worldOf({ before, mapBefore: 'map-1', found: null }), ME)
    expect(clear.ok && clear.patch).toEqual(taskPlaceColumns(null, DEV, ''))
    expect(taskPlaceDryRun({ action: 'clear', task: TASK }, worldOf({ found: null }), ME)).toMatchObject({ ok: false, refused: expect.stringContaining('no place to take off') })
  })

  it('the same point under the same name is no change, whatever map leads to it or margin a phone left; a new name is a rename', () => {
    const same = { ok: true as const, lat: 30.2, lng: -97.7, name: 'ZZ gate', found_by: 'the point you gave' }
    const ask = { action: 'set' as const, task: TASK, ask: { how: 'point' as const, lat: 30.2, lng: -97.7, name: 'ZZ gate' } }
    expect(taskPlaceDryRun(ask, worldOf({ before: { ...before, mapId: 'map-1' }, mapBefore: 'map-1', found: same }), ME)).toMatchObject({ ok: false, refused: expect.stringContaining('already has this place') })
    // A place a phone set carries its margin; naming it again must not drop the margin and the map for nothing.
    expect(taskPlaceDryRun(ask, worldOf({ before: { ...before, accuracyM: 6, mapId: 'map-1' }, mapBefore: 'map-1', found: same }), ME)).toMatchObject({ ok: false, refused: expect.stringContaining('already has this place') })
    expect(taskPlaceDryRun(ask, worldOf({ before, found: { ...same, name: '' } }), ME)).toMatchObject({ ok: false })
    const renamed = taskPlaceDryRun(ask, worldOf({ before, found: { ...same, name: 'ZZ west gate' } }), ME)
    expect(renamed.ok && renamed.reply.reads).toBe('The place of "ZZ walk the yard" keeps its point and is named "ZZ west gate" in place of "ZZ gate".')
  })

  it('a place taken by its name brings the painted map that leads to it, as its chip does', () => {
    const dry = taskPlaceDryRun({ action: 'set', task: TASK, ask: { how: 'like', like: 'ZZ gate' } }, worldOf({ before: { ...before, lat: 31, name: 'ZZ far' }, mapBefore: 'map-old', found: { ok: true, lat: 30.2, lng: -97.7, name: 'ZZ gate', found_by: 'x', mapId: 'map-of-the-gate' } }), ME)
    expect(dry.ok && dry.patch.painted_map_id).toBe('map-of-the-gate')
    expect(dry.ok && String(dry.reply.painted_map)).toContain('brings the painted map')
  })
})
