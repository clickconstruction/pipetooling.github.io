// @vitest-environment jsdom
/**
 * v2.4065: the Workflow page's window-free step writes as a hook, run against the real steps engine.
 * Pins the seam — each lifecycle move writes and re-reads (the count is not pinned: a re-read's
 * new steps also set off the engine's own effects), and Approve hands the step and its
 * next one to onApproved only after that; a refused update stops before the re-read; the percent
 * cell merges without a re-read and toasts a refusal; the notify toggles, the notes (RPC first,
 * then a direct update), delete (both dependency directions, then the step) and assign
 * (optimistic, the RPC ladder, reverted on a refusal, the first assignee's notify toggles on).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, screen } from '@testing-library/react'
import { renderWithProviders, settle } from '../test/renderSmokeMocks'
import { useWorkflowStepsEngine, type WorkflowStepsEngine } from './useWorkflowStepsEngine'
import { useWorkflowStepWrites } from './useWorkflowStepWrites'

type Step = { method: string; args: unknown[] }
type Res = { data: unknown; error: { message: string } | null }
type Call = { table: string; steps: Step[] }
const calls: Call[] = []
const rpcs: Array<{ fn: string; args: unknown }> = []
const opts = { refuse: new Set<string>(), rpcMissing: new Set<string>() }
let rows: Array<Record<string, unknown>> = []

vi.mock('../lib/supabase', () => {
  const has = (steps: Step[], m: string) => steps.some((s) => s.method === m)
  const arg = (steps: Step[], m: string) => steps.find((s) => s.method === m)?.args[0]
  const eqOf = (steps: Step[], col: string) => steps.find((s) => s.method === 'eq' && s.args[0] === col)?.args[1]
  function answer(table: string, steps: Step[]): Res {
    const verb = ['insert', 'update', 'delete', 'upsert'].find((m) => has(steps, m))
    if (verb && opts.refuse.has(`${table}.${verb}`)) return { data: null, error: { message: 'rls' } }
    if (table === 'project_workflow_steps') {
      if (verb === 'update') {
        const id = eqOf(steps, 'id')
        rows = rows.map((r) => (r.id === id ? { ...r, ...(arg(steps, 'update') as object) } : r))
        return { data: null, error: null }
      }
      if (verb === 'delete') {
        rows = rows.filter((r) => r.id !== eqOf(steps, 'id'))
        return { data: null, error: null }
      }
      return { data: [...rows].sort((a, b) => (a.sequence_order as number) - (b.sequence_order as number)), error: null }
    }
    if (table === 'project_workflow_step_actions' && verb === 'insert') return { data: { id: 'a-new', ...(arg(steps, 'insert') as object) }, error: null }
    if (table === 'project_workflows') return { data: has(steps, 'single') ? { id: 'w1' } : [{ id: 'w1', project_id: 'p1' }], error: null }
    if (table === 'projects') return { data: { id: 'p1', name: 'Elm Street' }, error: null }
    if (table === 'users') return { data: { name: 'Pat Office', email: 'pat@example.test' }, error: null }
    return { data: has(steps, 'single') ? null : [], error: null }
  }
  function from(table: string) {
    const steps: Step[] = []
    calls.push({ table, steps })
    const p: unknown = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'then') return (resolve: (v: Res) => void) => resolve(answer(table, steps))
          return (...a: unknown[]) => {
            steps.push({ method: String(prop), args: a })
            return p
          }
        },
      },
    )
    return p
  }
  return {
    supabase: {
      from,
      rpc: async (fn: string, args: unknown) => {
        rpcs.push({ fn, args })
        if (opts.rpcMissing.has(fn)) return { data: null, error: { message: `Could not find the function public.${fn}` } }
        if (opts.refuse.has(`rpc.${fn}`)) return { data: null, error: { message: 'not allowed' } }
        const a = args as { p_step_id: string; p_assigned_to_name?: string; p_notes?: string }
        if (fn.startsWith('update_step_assign')) rows = rows.map((r) => (r.id === a.p_step_id ? { ...r, assigned_to_name: a.p_assigned_to_name } : r))
        return { data: null, error: null }
      },
      functions: { invoke: async () => ({ data: null, error: null }) },
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
    },
  }
})

const has = (steps: Step[], m: string) => steps.some((s) => s.method === m)
const eqOf = (steps: Step[], col: string) => steps.find((s) => s.method === 'eq' && s.args[0] === col)?.args[1]
const writes = (table: string, verb: string) => calls.filter((c) => c.table === table && has(c.steps, verb))
const stepReads = () => calls.filter((c) => c.table === 'project_workflow_steps' && has(c.steps, 'select')).length

function row(id: string, sequence_order: number, status: string, extra: Record<string, unknown> = {}) {
  return { id, workflow_id: 'w1', name: id.toUpperCase(), sequence_order, status, assigned_to_name: null, started_at: null, ended_at: null, notes: null, private_notes: null, percent_complete: null, ...extra }
}

const onApproved = vi.fn()
const showToast = vi.fn()
let engine: WorkflowStepsEngine
let w: ReturnType<typeof useWorkflowStepWrites>

function Probe() {
  engine = useWorkflowStepsEngine({ projectId: 'p1', authUserId: 'u1', userRole: 'dev', currentUserName: 'Pat Office' })
  w = useWorkflowStepWrites(engine, { authUserId: 'u1', showToast, onApproved })
  return <div data-testid="s">{engine.loading ? 'loading' : engine.steps.map((s) => `${s.id}:${s.status}:${s.assigned_to_name ?? '-'}`).join(' ')}</div>
}

async function mount(initial: Array<Record<string, unknown>>) {
  rows = initial
  vi.spyOn(console, 'log').mockImplementation(() => {})
  renderWithProviders(<Probe />)
  await screen.findByText(new RegExp(`^${initial[0]!.id}:`))
  await settle()
  calls.length = 0
}

const byId = (id: string) => engine.steps.find((s) => s.id === id)!

afterEach(() => {
  cleanup()
  calls.length = 0
  rpcs.length = 0
  opts.refuse.clear()
  opts.rpcMissing.clear()
  onApproved.mockReset()
  showToast.mockReset()
  vi.restoreAllMocks()
})

describe('useWorkflowStepWrites', () => {
  it('Start writes the step, records the action and re-reads', async () => {
    await mount([row('s1', 1, 'pending')])
    await act(async () => { await w.markStarted(byId('s1')) })
    expect(writes('project_workflow_steps', 'update')[0]!.steps[0]!.args[0]).toMatchObject({ status: 'in_progress' })
    expect((writes('project_workflow_step_actions', 'insert')[0]!.steps[0]!.args[0] as { action_type: string }).action_type).toBe('started')
    expect(stepReads()).toBeGreaterThan(0)
    expect(screen.getByTestId('s').textContent).toBe('s1:in_progress:-')
  })

  it('Approve writes, re-reads, then hands the step and the next one to onApproved', async () => {
    await mount([row('s1', 1, 'completed'), row('s2', 2, 'pending')])
    await act(async () => { await w.markApproved(byId('s1')) })
    expect(writes('project_workflow_steps', 'update')[0]!.steps[0]!.args[0]).toMatchObject({ status: 'approved', approved_by: 'Pat Office' })
    expect(onApproved).toHaveBeenCalledTimes(1)
    const [approved, next] = onApproved.mock.calls[0]!
    expect([approved.id, next?.id]).toEqual(['s1', 's2'])
    expect(stepReads()).toBeGreaterThan(0)
  })

  it('Approve on the last step hands null as the next one', async () => {
    await mount([row('s1', 1, 'completed')])
    await act(async () => { await w.markApproved(byId('s1')) })
    expect(onApproved.mock.calls[0]![1]).toBeNull()
  })

  it('a refused lifecycle update stops before the re-read, and onApproved is not called', async () => {
    await mount([row('s1', 1, 'completed'), row('s2', 2, 'pending')])
    opts.refuse.add('project_workflow_steps.update')
    await act(async () => { await w.markApproved(byId('s1')) })
    expect(onApproved).not.toHaveBeenCalled()
    expect(stepReads()).toBe(0)
    expect(engine.error).toBe('Failed to update step: rls')
  })

  it('Complete and Reopen write and re-read', async () => {
    await mount([row('s1', 1, 'in_progress'), row('s2', 2, 'completed')])
    await act(async () => { await w.markCompleted(byId('s1')) })
    await act(async () => { await w.markReopened(byId('s2')) })
    const updates = writes('project_workflow_steps', 'update').map((c) => [eqOf(c.steps, 'id'), (c.steps[0]!.args[0] as { status?: string }).status])
    expect(updates).toContainEqual(['s1', 'completed'])
    expect(updates).toContainEqual(['s2', 'pending'])
    expect(stepReads()).toBeGreaterThanOrEqual(2)
  })

  it('the percent cell merges into the steps without a re-read, and toasts a refusal', async () => {
    await mount([row('s1', 1, 'in_progress')])
    await act(async () => { await w.updatePercentComplete(byId('s1'), 40) })
    expect(byId('s1').percent_complete).toBe(40)
    expect(stepReads()).toBe(0)
    opts.refuse.add('project_workflow_steps.update')
    await act(async () => { await w.updatePercentComplete(byId('s1'), 55) })
    expect(showToast).toHaveBeenCalledWith('Failed to save % complete: rls', 'error')
    expect(byId('s1').percent_complete).toBe(40)
  })

  it('a step’s notify toggles write the column and re-read; a refusal reaches the page', async () => {
    await mount([row('s1', 1, 'pending')])
    await act(async () => { await w.updateNotifyAssigned(byId('s1'), 'notify_assigned_when_started', true) })
    await act(async () => { await w.updateCrossStepNotify(byId('s1'), 'notify_prior_assignee_when_rejected', false) })
    expect(writes('project_workflow_steps', 'update').map((c) => c.steps[0]!.args[0])).toEqual([
      { notify_assigned_when_started: true },
      { notify_prior_assignee_when_rejected: false },
    ])
    expect(stepReads()).toBeGreaterThanOrEqual(2)
    opts.refuse.add('project_workflow_steps.update')
    await act(async () => { await w.updateNotifyAssigned(byId('s1'), 'notify_assigned_when_complete', true) })
    expect(engine.error).toBe('Failed to update notification setting: rls')
  })

  it('my own notify toggles insert a subscription, then update it, keeping the other two', async () => {
    await mount([row('s1', 1, 'pending')])
    await act(async () => { await w.updateNotifyMe(byId('s1'), 'notify_when_complete', true) })
    expect(writes('step_subscriptions', 'insert')[0]!.steps[0]!.args[0]).toEqual({
      step_id: 's1', user_id: 'u1', notify_when_started: false, notify_when_complete: true, notify_when_reopened: false,
    })
    await act(async () => { await w.updateNotifyMe(byId('s1'), 'notify_when_started', true) })
    const update = writes('step_subscriptions', 'update')[0]!
    expect(update.steps[0]!.args[0]).toMatchObject({ notify_when_started: true, notify_when_complete: true })
    expect(eqOf(update.steps, 'user_id')).toBe('u1')
    expect(engine.userSubscriptions.s1).toMatchObject({ notify_when_started: true, notify_when_complete: true })
  })

  it('notes go through the RPC, trimmed; without the RPC they update the column directly', async () => {
    await mount([row('s1', 1, 'pending')])
    await act(async () => { await w.updateNotes(byId('s1'), '  call first  ') })
    expect(rpcs).toEqual([{ fn: 'update_step_notes', args: { p_step_id: 's1', p_notes: 'call first' } }])
    opts.rpcMissing.add('update_step_private_notes')
    await act(async () => { await w.updatePrivateNotes(byId('s1'), '   ') })
    expect(writes('project_workflow_steps', 'update')[0]!.steps[0]!.args[0]).toEqual({ private_notes: null })
    expect(stepReads()).toBeGreaterThanOrEqual(2)
    opts.refuse.add('rpc.update_step_notes')
    await act(async () => { await w.updateNotes(byId('s1'), 'x') })
    expect(engine.error).toBe('Failed to update notes: not allowed')
  })

  it('delete removes the step’s dependencies both ways, then the step, then re-reads', async () => {
    await mount([row('s1', 1, 'pending'), row('s2', 2, 'pending')])
    await act(async () => { await w.deleteStep(byId('s1')) })
    const deletes = calls.filter((c) => has(c.steps, 'delete')).map((c) => [c.table, c.steps.find((s) => s.method === 'eq')!.args])
    expect(deletes).toEqual([
      ['workflow_step_dependencies', ['step_id', 's1']],
      ['workflow_step_dependencies', ['depends_on_step_id', 's1']],
      ['project_workflow_steps', ['id', 's1']],
    ])
    expect(screen.getByTestId('s').textContent).toBe('s2:pending:-')
    opts.refuse.add('workflow_step_dependencies.delete')
    await act(async () => { await w.deleteStep(byId('s2')) })
    expect(engine.error).toBe('Failed to delete step dependencies: rls')
    expect(calls.filter((c) => c.table === 'project_workflow_steps' && has(c.steps, 'delete'))).toHaveLength(1)
  })

  it('assign shows the name at once, writes through the RPC with the person id, and turns the first assignee’s notify toggles on', async () => {
    await mount([row('s1', 1, 'pending')])
    let done: Promise<void> | undefined
    act(() => { done = w.assignPerson(byId('s1'), 'Sam Sub', 'pp1') })
    expect(screen.getByTestId('s').textContent).toBe('s1:pending:Sam Sub')
    await act(async () => { await done })
    expect(rpcs[0]).toEqual({ fn: 'update_step_assignment', args: { p_step_id: 's1', p_assigned_to_name: 'Sam Sub', p_person_id: 'pp1' } })
    expect(writes('project_workflow_steps', 'update')[0]!.steps[0]!.args[0]).toEqual({
      notify_assigned_when_started: true, notify_assigned_when_complete: true, notify_assigned_when_reopened: true,
    })
  })

  it('assign falls back to the legacy RPC, then the direct update, when a function is missing', async () => {
    await mount([row('s1', 1, 'pending', { assigned_to_name: 'Old Hand' })])
    opts.rpcMissing.add('update_step_assignment')
    opts.rpcMissing.add('update_step_assigned_to')
    await act(async () => { await w.assignPerson(byId('s1'), 'Sam Sub') })
    expect(rpcs.map((r) => r.fn)).toEqual(['update_step_assignment', 'update_step_assigned_to'])
    expect(writes('project_workflow_steps', 'update')[0]!.steps[0]!.args[0]).toEqual({ assigned_to_name: 'Sam Sub' })
    // A reassignment, not a first assignee: no notify patch.
    expect(writes('project_workflow_steps', 'update')).toHaveLength(1)
  })

  it('a refused assignment puts the old name back and reports it', async () => {
    await mount([row('s1', 1, 'pending', { assigned_to_name: 'Old Hand' })])
    opts.refuse.add('rpc.update_step_assignment')
    await act(async () => { await w.assignPerson(byId('s1'), 'Sam Sub') })
    expect(screen.getByTestId('s').textContent).toBe('s1:pending:Old Hand')
    expect(engine.error).toBe('Failed to assign person: not allowed')
  })
})
