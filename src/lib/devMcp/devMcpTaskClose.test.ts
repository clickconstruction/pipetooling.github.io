/** A task closed without the work done, from the dev seat (v2.7823): the call's shape, the function's own rules held by the read, and where the verbs are named. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TASK_CLOSE_RPC, TASK_CLOSE_VERBS, isTaskCloseVerb, taskCloseDryRun, taskCloseInput, type TaskCloseWorld } from '../../../supabase/functions/_shared/devMcpTaskClose'
import { WRITE_VERBS, isWriteVerb, planVerbFor, stateGuarded, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import * as doerActs from '../tasks/taskDoerActs'
import { DROP_REASON_MAX, DROP_REASON_MIN, DROP_TITLE, dropPush, dropReasonTidy, dropRule } from '../tasks/taskDrop'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const MIGRATION = readFileSync('supabase/migrations/20261117120000_task_doer_acts.sql', 'utf8')
const HOOK = readFileSync('src/hooks/useTaskDoerActs.tsx', 'utf8')

const TASK = '99999999-1111-4111-8111-111111111111'
const DAY = '99999999-2222-4222-8222-222222222222'
const DEV = 'ffffffff-1111-4111-8111-111111111111'
const BEN = 'bbbbbbbb-1111-4111-8111-111111111111'
const HASH = 'a'.repeat(64)
const WHY = 'ZZ never reported back that it was done'
const open = { id: DAY, day: '2026-11-10', done_at: null, done_by: null }
const worldOf = (over: Partial<TaskCloseWorld> = {}): TaskCloseWorld => ({ task: { id: TASK, words: 'ZZ walk the yard' }, repeats: 'once', roadmap: false, giver: { id: DEV, name: 'Dev Person' }, people: ['ZZ Ana Field'], days: [open], picked: open, vehicle: false, ...over })
const me = { userId: DEV, name: 'Dev Person' }
const refusal = (close: Record<string, unknown>): string => {
  const built = taskCloseInput('plan_task_close', { close })
  if (built.ok) throw new Error('expected a refusal')
  return built.error
}
const dryRefusal = (world: TaskCloseWorld, day?: string): string => {
  const dry = taskCloseDryRun({ task: TASK, why: WHY, ...(day ? { day } : {}) }, world, me)
  if (dry.ok) throw new Error('expected a refusal')
  return dry.refused
}

describe('the close verbs are on the allowlist, and the write is the card\'s own function', () => {
  it('are two write verbs, plan before apply, named by the server and the README', () => {
    expect(TASK_CLOSE_VERBS).toEqual(['plan_task_close', 'apply_task_close'])
    for (const v of TASK_CLOSE_VERBS) {
      expect(isTaskCloseVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`name: '${v}'`)
      expect(SERVER).toContain(`case '${v}':`)
      expect(README).toContain(v)
    }
    expect(planVerbFor('apply_task_close')).toBe('plan_task_close')
    expect(stateGuarded('apply_task_close')).toBe(true)
    expect(SERVER).toContain('plan_task_close → apply_task_close')
  })

  it('calls the function the card\'s press calls, which the migration creates and grants', () => {
    expect(TASK_CLOSE_RPC).toBe('task_no_longer_applies')
    expect(MIGRATION).toContain(`CREATE OR REPLACE FUNCTION public.${TASK_CLOSE_RPC}(p_instance_id uuid, p_reason text)`)
    expect(MIGRATION).toContain(`GRANT EXECUTE ON FUNCTION public.${TASK_CLOSE_RPC}(uuid, text) TO authenticated`)
    expect(readFileSync('src/lib/tasks/taskDoerActsIo.ts', 'utf8')).toContain(`supabase.rpc('${TASK_CLOSE_RPC}' as never, { p_instance_id: instanceId, p_reason: reason }`)
    expect(SERVER).toContain('restPost(session, `rpc/${TASK_CLOSE_RPC}`, { p_instance_id: dry.instanceId, p_reason: p.why })')
  })

  it('holds the reason to the limits the function holds it to', () => {
    expect(MIGRATION).toContain(`'g')), ${DROP_REASON_MAX}), '')`)
    expect(MIGRATION).toContain(`length(v_reason) < ${DROP_REASON_MIN}`)
    expect(dropRule('ab')).toBe('Say why in a few words.')
    expect(dropRule('abc')).toBeNull()
  })

  it('the rule moved to its own file and the card still reads every name from taskDoerActs', () => {
    expect(doerActs.DROP_TITLE).toBe(DROP_TITLE)
    expect(doerActs.dropRule).toBe(dropRule)
    expect(doerActs.dropPush).toBe(dropPush)
    expect(doerActs.dropReasonTidy).toBe(dropReasonTidy)
    expect(doerActs.taskMoreChoices({ once: true, done: false }).some((r) => r.key === 'drop' && r.label === DROP_TITLE)).toBe(true)
  })
})

describe('the call\'s shape', () => {
  it('takes a task and a reason, tidied as the card tidies it', () => {
    const built = taskCloseInput('plan_task_close', { close: { task: ` ${TASK} `, why: '  ZZ plans\n changed ' } })
    expect(built).toEqual({ ok: true, p: { task: TASK, why: 'ZZ plans changed' }, target: TASK, planHash: null })
    const viaWrites = writeRpcBody('apply_task_close', { close: { task: TASK, why: WHY, day: '2026-11-10' }, plan_hash: HASH })
    expect(viaWrites).toMatchObject({ ok: true, rpc: null, step: 'apply', body: { p: { task: TASK, why: WHY, day: '2026-11-10' } }, planHash: HASH })
  })

  it('refuses what it cannot read: no close, no task, no reason, a short one, a long one, a bad day, an apply with no hash', () => {
    expect(taskCloseInput('plan_task_close', {})).toMatchObject({ ok: false })
    expect(refusal({ why: WHY })).toContain('task names the task')
    expect(refusal({ task: TASK })).toContain('why is the reason in words')
    expect(refusal({ task: TASK, why: 'no' })).toContain('Say why in a few words.')
    expect(refusal({ task: TASK, why: 'z'.repeat(DROP_REASON_MAX + 1) })).toContain(`${DROP_REASON_MAX + 1} characters; the most is ${DROP_REASON_MAX}`)
    expect(taskCloseInput('plan_task_close', { close: { task: TASK, why: 'z'.repeat(DROP_REASON_MAX) } })).toMatchObject({ ok: true })
    expect(refusal({ task: TASK, why: WHY, day: 'Tuesday' })).toContain('YYYY-MM-DD')
    expect(taskCloseInput('apply_task_close', { close: { task: TASK, why: WHY } })).toMatchObject({ ok: false, error: expect.stringContaining('needs plan_hash') })
  })
})

describe('the dry run', () => {
  it('says what closes, on which day, in which words, and that nobody is told when the caller gave the task', () => {
    const dry = taskCloseDryRun({ task: TASK, why: WHY }, worldOf(), me)
    if (!dry.ok) throw new Error(dry.refused)
    expect(dry.instanceId).toBe(DAY)
    expect(dry.tell).toBeNull()
    expect(dry.reply).toMatchObject({ day: '2026-11-10', day_row: DAY, why: WHY, for: ['ZZ Ana Field'], given_by: 'Dev Person' })
    expect(JSON.stringify(dry.reply)).not.toMatch(/\d{4}-\d{2}-\d{2}T/)
  })

  it('tells whoever gave the task with the words the card\'s press sends, as the hook does', () => {
    const dry = taskCloseDryRun({ task: TASK, why: WHY }, worldOf({ giver: { id: BEN, name: 'ZZ Ben Field' } }), me)
    if (!dry.ok) throw new Error(dry.refused)
    expect(dry.tell).toEqual({ giverId: BEN, ...dropPush('Dev Person', 'ZZ walk the yard', WHY) })
    expect(HOOK).toContain('const push = dropPush(who, target.title, reason)')
    expect(HOOK).toContain('target.giverId !== authUserId')
  })

  it('refuses in the function\'s order: no day, a day not there, all done, several open, done, a repeat, a roadmap task, a vehicle task', () => {
    const done = { ...open, done_at: '2026-11-11T15:00:00Z', done_by: BEN }
    const second = { id: 'd2', day: '2026-11-12', done_at: null, done_by: null }
    expect(dryRefusal(worldOf({ days: [], picked: null }))).toContain('no day row to close')
    expect(dryRefusal(worldOf({ picked: null }), '2026-11-11')).toContain('no day row on 2026-11-11')
    expect(dryRefusal(worldOf({ days: [done], picked: null }))).toContain('already done')
    expect(dryRefusal(worldOf({ days: [open, second], picked: null }))).toContain('2 open days (2026-11-10, 2026-11-12). Pass day')
    expect(dryRefusal(worldOf({ days: [done], picked: done }), '2026-11-10')).toContain('already done for 2026-11-10')
    expect(dryRefusal(worldOf({ repeats: 'days_of_week' }))).toContain('repeats')
    expect(dryRefusal(worldOf({ roadmap: true }))).toContain('belongs to a roadmap')
    expect(dryRefusal(worldOf({ vehicle: true }))).toContain('vehicle task')
    for (const said of ['A task that repeats', 'This task belongs to a roadmap', 'This is a vehicle task', 'This task is already done.']) expect(MIGRATION).toContain(said)
  })
})
