/** The dev seat's task verbs (v2.7584): the call's shape, who the window offers, and the draft the window's own send runs on. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TASK_PEOPLE_MAX, TASK_TEXT_MAX, TASK_VERBS, isTaskVerb, notOfferedWhy, taskDraft, taskDryRun, taskInput, type TaskPayload, type TaskWorld } from '../../../supabase/functions/_shared/devMcpTasks'
import { mapLink, type PlaceFound } from '../../../supabase/functions/_shared/devMcpTaskPlace'
import { WRITE_VERBS, isWriteVerb, planVerbFor, stateGuarded, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import { asksForPhotoDefault } from '../taskProgress'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const WINDOW = readFileSync('src/components/ChecklistAddModal.tsx', 'utf8')
const KERNELS = readFileSync('scripts/edge-kernels.mjs', 'utf8')

const ANA = 'aaaaaaaa-1111-4111-8111-111111111111'
const BEN = 'bbbbbbbb-1111-4111-8111-111111111111'
const DEV = 'ffffffff-1111-4111-8111-111111111111'
const HASH = 'a'.repeat(64)
const TODAY = '2026-11-17'
const ME = { userId: DEV, name: 'Dev Person' }

const shaped = (task: Record<string, unknown>, verb: 'plan_task' | 'apply_task' = 'plan_task') => taskInput(verb, { task, ...(verb === 'apply_task' ? { plan_hash: HASH } : {}) })
const p = (over: Record<string, unknown> = {}): TaskPayload => {
  const built = shaped({ for: ANA, text: 'ZZ check the pump', ...over })
  if (!built.ok) throw new Error(built.error)
  return built.p
}
const refusal = (task: Record<string, unknown>): string => {
  const built = shaped({ for: ANA, text: 'ZZ check the pump', ...task })
  if (built.ok) throw new Error('expected a refusal')
  return built.error
}
const worldOf = (over: Partial<TaskWorld> = {}): TaskWorld => ({ people: [{ ref: ANA, person: { id: ANA, name: 'ZZ Ana Field', role: 'master_technician' } }], tell: null, held: [], already: [], place: null, ...over })

describe('the task verbs are on the allowlist with no wrapper RPC', () => {
  it('are two write verbs, plan before apply, and the server and the README name them and the reads', () => {
    expect(TASK_VERBS).toEqual(['plan_task', 'apply_task'])
    for (const v of TASK_VERBS) {
      expect(isTaskVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`name: '${v}'`)
      expect(SERVER).toContain(`case '${v}':`)
    }
    expect(planVerbFor('apply_task')).toBe('plan_task')
    for (const read of ['find_task', 'get_task']) {
      expect(isWriteVerb(read)).toBe(false)
      expect(SERVER).toContain(`name: '${read}'`)
      expect(SERVER).toContain(`case '${read}':`)
    }
    expect(SERVER).toContain("const SERVER_VERSION = '0.99.0'")
    expect(SERVER).toContain('plan_task → apply_task')
    expect(README).toContain('`plan_task(task)`')
    expect(README).toContain('`get_task(task)`')
    expect(README).toContain('`find_task(text?, for?)`')
  })

  it('the window and the seat run one send: both import newTaskSend, and the seat reads it through the kernel copy', () => {
    expect(WINDOW).toContain("import { newTaskAssigneeRows, newTaskSend } from '../lib/tasks/newTaskSend'")
    expect(WINDOW).toContain('.insert(send.row as never)')
    expect(SERVER).toContain("import { newTaskSend } from '../_shared/gcKernels/lib/tasks/newTaskSend.ts'")
    expect(KERNELS).toContain("'lib/tasks/newTaskSend.ts'")
    // Only a dev's own key writes, and the write is the window's row.
    expect(SERVER).toContain("const made = await restRows(session, 'POST', 'checklist_items', 'select=id', send.row)")
  })

  it('every table the verbs read is in the catalog with the columns they name', () => {
    for (const [table, cols] of Object.entries({
      users: ['id', 'name', 'role', 'archived_at', 'is_digital_twin', 'is_sample', 'is_walk_tester', 'login_attached_at'],
      checklist_items: ['title', 'created_by_user_id', 'start_date', 'place_lat', 'spot_photo_path', 'asks_for_photo', 'roadmap_group_task_id'],
      checklist_item_assignees: ['checklist_item_id', 'user_id', 'display_order'],
      checklist_instances: ['checklist_item_id', 'scheduled_date', 'completed_at', 'percent_complete'],
      checklist_instance_events: ['instance_id', 'event_type', 'body'],
      task_criteria: ['checklist_item_id', 'body', 'sort_index', 'retired_at'],
      task_photos: ['instance_id', 'kind', 'caption', 'by_name', 'taken_at', 'drive_file_id'],
    })) {
      for (const col of cols) expect(Object.keys(CATALOG_TABLES[table]!.columns), `${table}.${col}`).toContain(col)
    }
  })

  it('a replay is refused by the world, never by the call log: a task given, deleted and given again is a second act', () => {
    expect(stateGuarded('apply_task')).toBe(true)
    expect(stateGuarded('plan_task')).toBe(false)
    const branch = SERVER.slice(SERVER.indexOf("    case 'plan_task':"), SERVER.indexOf("    case 'plan_task_place':"))
    expect(branch).not.toContain('hooks.priorApply')
    // After the task exists, every write goes through the helper that turns a throw into a named step.
    expect(branch.match(/await post\('/g)?.length).toBe(4)
  })
})

describe('taskInput — the call, shaped', () => {
  it('takes one person or a list, an id lowercased, a name as written, each once', () => {
    expect(p().for).toEqual([ANA])
    expect(p({ for: [ANA.toUpperCase(), 'ZZ Ben Field', ANA] }).for).toEqual([ANA, 'ZZ Ben Field'])
    expect(refusal({ for: [] })).toContain('it is empty')
    expect(refusal({ for: 7 })).toContain('for names who the task is for')
    expect(refusal({ for: Array.from({ length: TASK_PEOPLE_MAX + 1 }, (_, i) => `ZZ person ${i}`) })).toContain(`the most is ${TASK_PEOPLE_MAX}`)
  })

  it('needs words, capped', () => {
    expect(refusal({ text: '   ' })).toContain('text is the task\'s words')
    expect(refusal({ text: 'x'.repeat(TASK_TEXT_MAX + 1) })).toContain(`the most is ${TASK_TEXT_MAX}`)
  })

  it('a day is a real day, and a repeat is one of two kinds', () => {
    expect(p({ on: '2026-11-20', due: '2026-11-21' })).toMatchObject({ on: '2026-11-20', due: '2026-11-21' })
    expect(refusal({ on: '2026-02-30' })).toContain('"2026-02-30" is not one')
    expect(p({ repeat: { weekdays: ['Wednesday', 'mon', 3], until: '2026-12-31' } }).repeat).toEqual({ weekdays: [1, 3], until: '2026-12-31' })
    expect(p({ repeat: { weekdays: [0, 6] } }).repeat).toEqual({ weekdays: [0, 6] })
    expect(p({ repeat: { days_after_done: 7 } }).repeat).toEqual({ days_after_done: 7 })
    expect(refusal({ repeat: { weekdays: ['funday'] } })).toContain('not a weekday')
    expect(refusal({ repeat: { weekdays: [1], days_after_done: 2 } })).toContain('not both and not neither')
    expect(refusal({ repeat: {} })).toContain('not both and not neither')
    expect(refusal({ repeat: { days_after_done: 0 } })).toContain('1 to 365')
    expect(refusal({ repeat: { days_after_done: 3, until: '2026-12-31' } })).toContain('no end day')
    expect(refusal({ repeat: { weekdays: [1] }, due: '2026-11-21' })).toContain('a repeating task has no due day')
  })

  it('the Done when… lines are the window\'s own parse, refused out loud when too many or too long', () => {
    expect(p({ done_when: ['- ZZ one', 'ZZ two', 'zz ONE', '  '] }).done_when).toEqual(['ZZ one', 'ZZ two'])
    expect(p({ done_when: [] }).done_when).toBeUndefined()
    expect(refusal({ done_when: Array.from({ length: 13 }, (_, i) => `ZZ line ${i}`) })).toContain('the most is 12')
    expect(refusal({ done_when: ['x'.repeat(201)] })).toContain('the most is 200')
    expect(refusal({ done_when: 'ZZ one' })).toContain('a list of lines')
  })

  it('a reminder\'s extras need a reminder time, and a time is HH:MM', () => {
    expect(p({ remind_at: '08:00', remind_daily: false, remind_day_before: true, escalate_after_days: 2 })).toMatchObject({ remind_at: '08:00', remind_daily: false, remind_day_before: true, escalate_after_days: 2 })
    expect(refusal({ remind_at: '8am' })).toContain('HH:MM')
    expect(refusal({ remind_day_before: true })).toContain('go with remind_at')
    expect(refusal({ asks_for_photo: 'yes' })).toContain('true or false')
  })

  it('links are http(s) addresses, and a place is a whole point with a short name', () => {
    expect(p({ links: [' https://example.test/a ', 'https://example.test/a'] }).links).toEqual(['https://example.test/a'])
    expect(refusal({ links: ['ftp://example.test'] })).toContain('http(s) address')
    expect(p({ place: { name: '  ZZ pump   house ', lat: 30.1, lng: -97.7 } }).place).toEqual({ how: 'point', name: 'ZZ pump house', lat: 30.1, lng: -97.7 })
    expect(p({ place: { lat: 30.1, lng: -97.7 } }).place).toEqual({ how: 'point', lat: 30.1, lng: -97.7 })
    // The four ways are the place verb's own (devMcpTaskPlace.test.ts holds each).
    expect(p({ place: { address: '14 Maple Ct, Marlow, TX 78000' } }).place).toEqual({ how: 'address', address: '14 Maple Ct, Marlow, TX 78000' })
    expect(p({ place: { like: 'ZZ gate' } }).place).toEqual({ how: 'like', like: 'ZZ gate' })
    expect(refusal({ place: { name: 'ZZ gate', lat: 0, lng: 0 } })).toContain('place: lat and lng are numbers on the globe')
    expect(refusal({ place: { name: 'ZZ gate' } })).toContain('a place is said one way, not none')
    expect(refusal({ place: { name: 'x'.repeat(41), lat: 30.1, lng: -97.7 } })).toContain('the most is 40')
  })

  it('apply needs the plan\'s hash, by the grammar and by the verb', () => {
    expect(writeRpcBody('apply_task', { task: { for: ANA, text: 'ZZ a task' } })).toMatchObject({ ok: false })
    const built = writeRpcBody('apply_task', { task: { for: ANA, text: 'ZZ a task' }, plan_hash: HASH.toUpperCase() })
    expect(built).toMatchObject({ ok: true, rpc: null, step: 'apply', planHash: HASH })
    expect(shaped({ for: ANA, text: 'ZZ a task' }, 'apply_task')).toMatchObject({ ok: true, planHash: HASH })
  })
})

describe('who the window offers', () => {
  const row = (over: Record<string, unknown> = {}) => ({ id: ANA, name: 'ZZ Ana Field', role: 'master_technician', archived_at: null, is_digital_twin: false, is_sample: false, is_walk_tester: false, login_attached_at: '2026-01-05T00:00:00Z', ...over })
  it('an active person with a login, a dev among them, and nobody else', () => {
    expect(notOfferedWhy(row())).toBeNull()
    expect(notOfferedWhy(row({ role: 'dev' }))).toBeNull()
    expect(notOfferedWhy(row({ archived_at: '2026-06-01T00:00:00Z' }))).toContain('is archived')
    for (const flag of ['is_digital_twin', 'is_sample', 'is_walk_tester']) expect(notOfferedWhy(row({ [flag]: true })), flag).toContain('does not offer them')
    expect(notOfferedWhy(row({ login_attached_at: null }))).toContain('has no login')
  })
})

describe('the draft and the dry run', () => {
  const ana = { id: ANA, name: 'ZZ Ana Field', role: 'master_technician' }
  it('the draft is the window as it opens, where the call says nothing', () => {
    expect(taskDraft(p(), [ana], null, TODAY)).toMatchObject({ when: 'today', startDate: TODAY, showUntilCompleted: true, notifyCreatorOnComplete: true, reminderDaily: true, escalateEnabled: false, escalateDays: 3, repeatDaysAfter: 1, asksForPhoto: false, place: null, map: null })
    expect(taskDraft(p({ on: '2026-11-20' }), [ana], null, TODAY).when).toBe('date')
    expect(taskDraft(p({ on: TODAY }), [ana], null, TODAY).when).toBe('today')
    expect(taskDraft(p({ repeat: { days_after_done: 5 } }), [ana], null, TODAY)).toMatchObject({ when: 'repeat', repeatMode: 'after_done', repeatDaysAfter: 5 })
  })

  it('the photo switch follows the window: on once a line is written, unless the call says', () => {
    expect(taskDraft(p({ done_when: ['ZZ one'] }), [ana], null, TODAY).asksForPhoto).toBe(asksForPhotoDefault(1))
    expect(taskDraft(p({ done_when: ['ZZ one'], asks_for_photo: false }), [ana], null, TODAY).asksForPhoto).toBe(false)
    expect(taskDraft(p({ asks_for_photo: true }), [ana], null, TODAY).asksForPhoto).toBe(true)
  })

  it('the plan holds no clock and no place in a list, so a task given to them in between does not turn it away', () => {
    const at: PlaceFound = { ok: true, lat: 30.1, lng: -97.7, name: '', found_by: 'the point you gave' }
    const a = taskDryRun(p({ place: { lat: 30.1, lng: -97.7 } }), worldOf({ held: [{ user_id: ANA, display_order: 4 }], place: at }), ME, TODAY)
    const b = taskDryRun(p({ place: { lat: 30.1, lng: -97.7 } }), worldOf({ held: [{ user_id: ANA, display_order: 9 }], place: at }), ME, TODAY)
    if (!a.ok || !b.ok) throw new Error('expected two plans')
    expect(a.reply).toEqual(b.reply)
    expect(JSON.stringify(a.reply)).not.toContain('place_set_at":')
    expect(a.reply.stamped_at_apply).toEqual(['place_set_at'])
    expect(mapLink(30.1, -97.7)).toBe('https://www.google.com/maps?q=30.1,-97.7')
  })

  it('a place that cannot be found turns the plan away in the finder\'s words, and a found one names how it was found', () => {
    expect(taskDryRun(p({ place: { address: '1 Nowhere Rd, Marlow, TX' } }), worldOf({ place: { ok: false, refused: 'No point was found' } }), ME, TODAY)).toMatchObject({ ok: false, refused: 'place: No point was found' })
    const found = taskDryRun(p({ place: { like: 'ZZ gate' } }), worldOf({ place: { ok: true, lat: 30.2, lng: -97.7, name: 'ZZ gate', found_by: 'the place "ZZ gate" another task already carries' } }), ME, TODAY)
    expect(found.ok && found.reply.place).toEqual({ name: 'ZZ gate', lat: 30.2, lng: -97.7, found_by: 'the place "ZZ gate" another task already carries', check_it_here: 'https://www.google.com/maps?q=30.2,-97.7' })
    expect(found.ok && found.reply.row).toMatchObject({ place_name: 'ZZ gate', place_lat: 30.2, place_lng: -97.7, place_accuracy_m: null })
  })

  it('refuses the same person named twice, a repeat that ends before it starts, and a repeat with no day in five weeks', () => {
    const twice = taskDryRun(p({ for: [ANA, 'ZZ Ana Field'] }), worldOf({ people: [{ ref: ANA, person: ana }, { ref: 'ZZ Ana Field', person: ana }] }), ME, TODAY)
    expect(twice).toMatchObject({ ok: false, refused: expect.stringContaining('the same person') })
    expect(taskDryRun(p({ repeat: { weekdays: [1], until: '2026-11-01' } }), worldOf(), ME, TODAY)).toMatchObject({ ok: false, refused: expect.stringContaining('before the task starts') })
    // A Monday-only repeat that ends on the Wednesday it starts on has no Monday in it.
    expect(taskDryRun(p({ on: '2026-11-18', repeat: { weekdays: [1], until: '2026-11-18' } }), worldOf(), ME, TODAY)).toMatchObject({ ok: false, refused: expect.stringContaining('no day in the next five weeks') })
  })

  it('a task already given with these words for that day to one of these people is refused, and another person\'s is not', () => {
    const mine = { id: 't1', start_date: TODAY, created_at: '2026-11-17T15:00:00Z', for: [ANA] }
    expect(taskDryRun(p(), worldOf({ already: [mine] }), ME, TODAY)).toMatchObject({ ok: false, refused: expect.stringContaining('allow_duplicate: true') })
    expect(taskDryRun(p(), worldOf({ already: [{ ...mine, for: [BEN] }] }), ME, TODAY).ok).toBe(true)
    const meant = taskDryRun(p({ allow_duplicate: true }), worldOf({ already: [mine] }), ME, TODAY)
    expect(meant.ok && meant.reply.already_given).toEqual([{ id: 't1', given_at: '2026-11-17T15:00:00Z' }])
  })
})
