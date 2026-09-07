import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The ✓ Complete shared by Today, Manage and Review: the guarded completion
 * write, the cross-surface `checklist-instance-completed` event, and the two
 * best-effort side effects — watcher notifications and the next
 * days-after-completion occurrence with its assignees copied.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string, steps: Step[]) => { data: unknown; error: { message: string } | null } = () => ({ data: null, error: null })
const invoke = vi.fn(async (_fn: string, _opts: unknown) => ({ data: null, error: null }))
vi.mock('./supabase', () => ({
  supabase: {
    functions: { invoke: (fn: string, opts: unknown) => invoke(fn, opts) },
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(route(table, steps))
            return (...a: unknown[]) => {
              steps.push({ method: String(prop), args: a })
              return p
            }
          },
        },
      )
      return p
    },
  },
}))
const dispatchEvent = vi.fn()
;(globalThis as unknown as { window: unknown }).window = { dispatchEvent }

import { completeChecklistInstance } from './checklistCompleteInstance'

const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
const has = (steps: Step[], m: string, first?: unknown) => steps.some((s) => s.method === m && (first === undefined || s.args[0] === first))
const selectOf = (steps: Step[]) => String(argsOf(steps, 'select')[0]?.[0] ?? '')
const flush = () => new Promise((r) => setTimeout(r, 0))
const args = { instanceId: 'inst-1', checklistItemId: 'item-1', scheduledDate: '2026-09-07', authUserId: 'me' }

type Scenario = {
  updated?: Array<{ id: string }> | null
  updateError?: string
  item?: Record<string, unknown> | null
  me?: { name: string | null } | null
  repeat?: Record<string, unknown> | null
  assignees?: Array<{ user_id: string }>
  existing?: { id: string } | null
  newInst?: { id: string } | null
}
let sc: Scenario = {}
const routeScenario = (table: string, steps: Step[]) => {
  if (table === 'checklist_instances' && has(steps, 'update')) return sc.updateError ? { data: null, error: { message: sc.updateError } } : { data: 'updated' in sc ? sc.updated : [{ id: 'inst-1' }], error: null }
  if (table === 'checklist_items' && selectOf(steps).startsWith('notify_on_complete')) return { data: sc.item === undefined ? { notify_on_complete_user_id: null, notify_creator_on_complete: false, created_by_user_id: 'creator', title: 'Pull permit' } : sc.item, error: null }
  if (table === 'checklist_items' && selectOf(steps).startsWith('repeat_type')) return { data: sc.repeat === undefined ? { repeat_type: 'none', repeat_days_after: null, repeat_end_date: null } : sc.repeat, error: null }
  if (table === 'users') return { data: sc.me === undefined ? { name: 'Ana' } : sc.me, error: null }
  if (table === 'checklist_item_assignees') return { data: sc.assignees ?? [], error: null }
  if (table === 'checklist_instances' && has(steps, 'insert')) return { data: sc.newInst === undefined ? { id: 'inst-2' } : sc.newInst, error: null }
  if (table === 'checklist_instances') return { data: sc.existing ?? null, error: null }
  if (table === 'checklist_instance_assignees') return { data: null, error: null }
  throw new Error(`unrouted ${table}`)
}
const inserts = (table: string) => queries.filter((q) => q.table === table && has(q.steps, 'insert')).map((q) => argsOf(q.steps, 'insert')[0]![0])

beforeEach(() => {
  queries.length = 0
  invoke.mockClear()
  dispatchEvent.mockClear()
  sc = {}
  route = routeScenario
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-07T18:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('the completion write', () => {
  it('stamps completed_at/by only on a still-open row the caller can see, returns ok, and tells mounted queues', async () => {
    expect(await completeChecklistInstance(args)).toEqual({ ok: true })
    const w = queries[0]!
    expect(w.table).toBe('checklist_instances')
    expect(argsOf(w.steps, 'update')).toEqual([[{ completed_at: '2026-09-07T18:00:00.000Z', completed_by_user_id: 'me' }]])
    expect(argsOf(w.steps, 'eq')).toEqual([['id', 'inst-1']])
    expect(argsOf(w.steps, 'is')).toEqual([['completed_at', null]])
    expect(argsOf(w.steps, 'select')).toEqual([['id']])
    expect(dispatchEvent).toHaveBeenCalledTimes(1)
    const ev = dispatchEvent.mock.calls[0]![0] as CustomEvent
    expect([ev.type, ev.detail]).toEqual(['checklist-instance-completed', 'inst-1'])
  })

  it('a write error comes back with its message; zero rows means already complete or no access — either way no side effects and no event', async () => {
    sc = { updateError: 'permission denied' }
    expect(await completeChecklistInstance(args)).toEqual({ ok: false, error: 'permission denied' })
    sc = { updated: [] }
    expect(await completeChecklistInstance(args)).toEqual({ ok: false, error: 'Could not complete this task (already complete, or no access).' })
    sc = { updated: null }
    expect((await completeChecklistInstance(args)).ok).toBe(false)
    await flush()
    expect(queries.filter((q) => q.table !== 'checklist_instances')).toEqual([])
    expect(invoke).not.toHaveBeenCalled()
    expect(dispatchEvent).not.toHaveBeenCalled()
  })
})

describe('completion notifications (best-effort)', () => {
  it('tells the notify-on-complete user and, when asked, the creator — once each, never the completer — with "<name> completed: <title>"', async () => {
    sc = { item: { notify_on_complete_user_id: 'u1', notify_creator_on_complete: true, created_by_user_id: 'u2', title: 'Pull permit' } }
    await completeChecklistInstance(args)
    await flush()
    expect(invoke.mock.calls.map((c) => [c[0], (c[1] as { body: { recipient_user_id: string } }).body.recipient_user_id])).toEqual([
      ['send-checklist-notification', 'u1'],
      ['send-checklist-notification', 'u2'],
    ])
    expect((invoke.mock.calls[0]![1] as { body: unknown }).body).toEqual({
      recipient_user_id: 'u1',
      push_title: 'Checklist completed',
      push_body: 'Ana completed: Pull permit',
      push_url: '/checklist',
      tag: 'checklist-inst-1',
    })
    const items = queries.find((q) => q.table === 'checklist_items' && selectOf(q.steps).startsWith('notify'))!
    expect(argsOf(items.steps, 'eq')).toEqual([['id', 'item-1']])
    expect(argsOf(queries.find((q) => q.table === 'users')!.steps, 'eq')).toEqual([['id', 'me']])

    invoke.mockClear()
    sc = { item: { notify_on_complete_user_id: 'u2', notify_creator_on_complete: true, created_by_user_id: 'u2', title: 'T' } } // same person twice
    await completeChecklistInstance(args)
    await flush()
    expect(invoke).toHaveBeenCalledTimes(1)

    invoke.mockClear()
    sc = { item: { notify_on_complete_user_id: 'me', notify_creator_on_complete: true, created_by_user_id: 'me', title: 'T' } } // completer is the watcher
    await completeChecklistInstance(args)
    await flush()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('an unnamed completer reads as "Someone"; a missing item or a failing send never affects the result', async () => {
    sc = { item: { notify_on_complete_user_id: 'u1', notify_creator_on_complete: false, created_by_user_id: 'x', title: 'T' }, me: { name: '  ' } }
    await completeChecklistInstance(args)
    await flush()
    expect((invoke.mock.calls[0]![1] as { body: { push_body: string } }).body.push_body).toBe('Someone completed: T')

    invoke.mockClear()
    invoke.mockRejectedValueOnce(new Error('edge down'))
    expect(await completeChecklistInstance(args)).toEqual({ ok: true })
    await flush()

    invoke.mockClear()
    sc = { item: null }
    expect(await completeChecklistInstance(args)).toEqual({ ok: true })
    await flush()
    expect(invoke).not.toHaveBeenCalled()
  })
})

describe('the next days-after-completion occurrence (best-effort)', () => {
  const repeat = { repeat_type: 'days_after_completion', repeat_days_after: 3, repeat_end_date: null }

  it('inserts the next occurrence at scheduled date + N days, unless one already exists, and copies every assignee onto it', async () => {
    sc = { repeat, assignees: [{ user_id: 'a' }, { user_id: 'b' }] }
    await completeChecklistInstance(args)
    await flush()
    const existing = queries.find((q) => q.table === 'checklist_instances' && !has(q.steps, 'update') && !has(q.steps, 'insert'))!
    expect(argsOf(existing.steps, 'eq')).toEqual([
      ['checklist_item_id', 'item-1'],
      ['scheduled_date', '2026-09-10'],
    ])
    expect(inserts('checklist_instances')).toEqual([{ checklist_item_id: 'item-1', scheduled_date: '2026-09-10' }])
    expect(inserts('checklist_instance_assignees')).toEqual([
      { checklist_instance_id: 'inst-2', user_id: 'a' },
      { checklist_instance_id: 'inst-2', user_id: 'b' },
    ])
    expect(argsOf(queries.find((q) => q.table === 'checklist_item_assignees')!.steps, 'eq')).toEqual([['checklist_item_id', 'item-1']])

    queries.length = 0
    sc = { repeat, assignees: [{ user_id: 'a' }], existing: { id: 'already' } }
    await completeChecklistInstance(args)
    await flush()
    expect(inserts('checklist_instances')).toEqual([])
    expect(inserts('checklist_instance_assignees')).toEqual([])
  })

  it('skips when the task does not repeat after completion, has no day count, has no assignees, or the next date passes the end date', async () => {
    const cases: Scenario[] = [
      { repeat: { ...repeat, repeat_type: 'weekly' }, assignees: [{ user_id: 'a' }] },
      { repeat: { ...repeat, repeat_days_after: 0 }, assignees: [{ user_id: 'a' }] },
      { repeat, assignees: [] },
      { repeat: { ...repeat, repeat_end_date: '2026-09-09' }, assignees: [{ user_id: 'a' }] },
      { repeat: null, assignees: [{ user_id: 'a' }] },
    ]
    for (const c of cases) {
      queries.length = 0
      sc = c
      expect(await completeChecklistInstance(args)).toEqual({ ok: true })
      await flush()
      expect(inserts('checklist_instances'), JSON.stringify(c)).toEqual([])
    }
    sc = { repeat: { ...repeat, repeat_end_date: '2026-09-10' }, assignees: [{ user_id: 'a' }] } // end date inclusive
    queries.length = 0
    await completeChecklistInstance(args)
    await flush()
    expect(inserts('checklist_instances')).toHaveLength(1)
  })

  it('a failed insert leaves no assignee rows and never affects the result; a thrown read is swallowed', async () => {
    sc = { repeat, assignees: [{ user_id: 'a' }], newInst: null }
    expect(await completeChecklistInstance(args)).toEqual({ ok: true })
    await flush()
    expect(inserts('checklist_instance_assignees')).toEqual([])
    route = (table, steps) => {
      if (table === 'checklist_item_assignees') throw new Error('boom')
      return routeScenario(table, steps)
    }
    expect(await completeChecklistInstance(args)).toEqual({ ok: true })
    await flush()
  })
})
