// @vitest-environment jsdom
/**
 * v2.4077: the Workflow page's steps engine (data half) as a hook. Pins the seam — the load
 * (project and workflow together, then the steps, the viewer's subscriptions and the last 100
 * actions); a subcontractor's filtered read and its access error; the workflow found, created,
 * or adopted after a lost insert race, and one find-or-create per project at a time; line items
 * for the roles that see them, an RLS refusal swallowed; refreshSteps forcing a re-read; and the
 * lifecycle runner (updates in order, the first failure stops it, then the action rows). Since
 * v2.5108 a load that leaves nothing to draw (a failed first steps read, a subcontractor with no
 * step here) lands in `loadError`, which the page shows instead of itself; every other failure,
 * a failed re-read after a write among them, stays in `error`, which the page shows as a banner.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, settle } from '../test/renderSmokeMocks'
import { useWorkflowStepsEngine, type WorkflowStepsEngine } from './useWorkflowStepsEngine'
import type { WorkflowViewerRole } from './useWorkflowRoster'

type Step = { method: string; args: unknown[] }
type Res = { data: unknown; error: { message: string; code?: string } | null }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string, steps: Step[]) => Res = () => ({ data: [], error: null })
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: Res) => void) => resolve(route(table, steps))
            return (...a: unknown[]) => {
              steps.push({ method: String(prop), args: a })
              return p
            }
          },
        },
      )
      return p
    },
    functions: { invoke: async () => ({ data: null, error: null }) },
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
  },
}))

const has = (steps: Step[], m: string) => steps.some((s) => s.method === m)
const eqOf = (steps: Step[], col: string) => steps.find((s) => s.method === 'eq' && s.args[0] === col)?.args[1]
const ok = (data: unknown): Res => ({ data, error: null })
const fail = (message: string, code?: string): Res => ({ data: null, error: { message, code } })
const reads = (table: string) => queries.filter((q) => q.table === table && has(q.steps, 'select') && !has(q.steps, 'insert'))

const stepRows = [
  { id: 's1', workflow_id: 'w1', name: 'Rough', sequence_order: 1, status: 'completed', assigned_to_name: 'Sam Sub' },
  { id: 's2', workflow_id: 'w1', name: 'Top Out', sequence_order: 2, status: 'in_progress', assigned_to_name: 'Lee Sub' },
  { id: 's3', workflow_id: 'w1', name: 'Trim', sequence_order: 3, status: 'pending', assigned_to_name: null },
]

type Opts = { workflows?: unknown[]; insertFails?: boolean; lineItems?: Res; updateFailsFor?: string; stepsReadFails?: boolean }
function world(opts: Opts = {}) {
  let workflows = opts.workflows ?? [{ id: 'w1', project_id: 'p1' }]
  route = (table, steps) => {
    const single = has(steps, 'single')
    switch (table) {
      case 'projects':
        return ok(single ? { id: 'p1', name: 'Elm Street' } : [{ id: 'p1', name: 'Elm Street' }])
      case 'project_workflows':
        if (has(steps, 'insert')) {
          if (opts.insertFails) {
            workflows = [{ id: 'w-raced', project_id: 'p1' }]
            return fail('duplicate key')
          }
          const row = { id: 'w-new', ...(steps.find((s) => s.method === 'insert')!.args[0] as object) }
          workflows = [row]
          return ok(row)
        }
        return ok(single ? workflows[0] : workflows)
      case 'project_workflow_steps': {
        if (has(steps, 'update')) {
          return eqOf(steps, 'id') === opts.updateFailsFor ? fail('rls') : ok(null)
        }
        if (opts.stepsReadFails) return fail('timeout')
        const who = eqOf(steps, 'assigned_to_name')
        return ok(stepRows.filter((s) => who === undefined || s.assigned_to_name === who))
      }
      case 'step_subscriptions':
        return ok([{ step_id: 's2', notify_when_started: true, notify_when_complete: null, notify_when_reopened: false }])
      case 'project_workflow_step_actions':
        if (has(steps, 'insert')) return ok({ id: 'a-new', ...(steps.find((s) => s.method === 'insert')!.args[0] as object) })
        return ok([
          { id: 'a1', step_id: 's1', action_type: 'completed' },
          { id: 'a2', step_id: 's1', action_type: 'started' },
        ])
      case 'workflow_step_line_items':
        return opts.lineItems ?? ok([{ id: 'li1', step_id: 's1', amount: 10 }, { id: 'li2', step_id: 's2', amount: 20 }])
      case 'gc_projects':
        // Not a GC project (v2.4846): maybeSingle() answers null when no row matches.
        return ok(has(steps, 'maybeSingle') ? null : [])
      case 'users':
        return ok({ name: 'Pat Office', email: 'pat@example.test' })
      default:
        return ok([])
    }
  }
}

let latest: WorkflowStepsEngine
function Probe({ role, name = 'Pat Office' }: { role: WorkflowViewerRole | null; name?: string }) {
  latest = useWorkflowStepsEngine({ projectId: 'p1', authUserId: 'u1', userRole: role, currentUserName: name })
  return (
    <>
      <div data-testid="e">
        {latest.loading ? 'loading' : `wf:${latest.workflow?.id ?? '-'} steps:${latest.steps.map((s) => s.id).join(',') || '-'} items:${Object.keys(latest.lineItems).sort().join(',') || '-'} error:${latest.error ?? '-'}`}
      </div>
      <div data-testid="load">{`load:${latest.loadError ?? '-'}`}</div>
    </>
  )
}

afterEach(() => {
  cleanup()
  queries.length = 0
  vi.restoreAllMocks()
})

describe('useWorkflowStepsEngine', () => {
  it('loads the project and its workflow, then the steps, the viewer’s subscriptions and the action ledger', async () => {
    world()
    renderWithProviders(<Probe role="dev" />)
    await screen.findByText(/^wf:w1 steps:s1,s2,s3 /)
    const stepRead = reads('project_workflow_steps')[0]!
    expect(stepRead.steps).toContainEqual({ method: 'eq', args: ['workflow_id', 'w1'] })
    expect(stepRead.steps).toContainEqual({ method: 'order', args: ['sequence_order', { ascending: true }] })
    expect(latest.project?.name).toBe('Elm Street')
    expect(latest.userSubscriptions).toEqual({ s2: { notify_when_started: true, notify_when_complete: false, notify_when_reopened: false } })
    expect(latest.stepActions.s1?.map((a) => a.id)).toEqual(['a1', 'a2'])
    const actions = reads('project_workflow_step_actions')[0]!
    expect(actions.steps).toContainEqual({ method: 'limit', args: [100] })
  })

  it('reads line items for the roles that see them, keyed by step', async () => {
    world()
    renderWithProviders(<Probe role="assistant" />)
    await screen.findByText(/items:s1,s2 error:-$/)
    cleanup()
    queries.length = 0
    world()
    // A helper is subcontractor-like: their own steps only, and no line items.
    renderWithProviders(<Probe role="helpers" name="Sam Sub" />)
    await screen.findByText(/^wf:w1 steps:s1 items:- /)
    await settle()
    await new Promise((r) => setTimeout(r, 80))
    expect(reads('workflow_step_line_items')).toEqual([])
  })

  it('swallows an RLS refusal on line items but reports any other failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    world({ lineItems: fail('permission denied for table workflow_step_line_items') })
    renderWithProviders(<Probe role="superintendent" />)
    await screen.findByText(/^wf:w1 steps:s1,s2,s3 items:- error:-$/)
    await new Promise((r) => setTimeout(r, 80))
    expect(screen.getByTestId('e').textContent).toMatch(/error:-$/)
    cleanup()
    world({ lineItems: fail('timeout') })
    renderWithProviders(<Probe role="dev" />)
    await screen.findByText(/error:Failed to load line items: timeout$/)
  })

  it('filters a subcontractor’s read to their own name, and refuses a workflow with none of theirs', async () => {
    world()
    renderWithProviders(<Probe role="subcontractor" name="Sam Sub" />)
    await screen.findByText(/^wf:w1 steps:s1 /)
    expect(reads('project_workflow_steps').some((q) => eqOf(q.steps, 'assigned_to_name') === 'Sam Sub')).toBe(true)
    cleanup()
    world()
    renderWithProviders(<Probe role="subcontractor" name="Nobody" />)
    await screen.findByText(/^load:You do not have access to this workflow/)
    expect(screen.getByTestId('e').textContent).toMatch(/error:-$/)
  })

  it('puts a failed first steps read in loadError, not error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    world({ stepsReadFails: true })
    renderWithProviders(<Probe role="dev" />)
    await screen.findByText('load:Failed to load steps: timeout')
    expect(screen.getByTestId('e').textContent).toMatch(/error:-$/)
  })

  it('creates the project’s workflow when there is none, named after the project', async () => {
    world({ workflows: [] })
    renderWithProviders(<Probe role="dev" />)
    await screen.findByText(/^wf:w-new /)
    const insert = queries.find((q) => q.table === 'project_workflows' && has(q.steps, 'insert'))!
    expect(insert.steps[0]).toEqual({ method: 'insert', args: [{ project_id: 'p1', name: 'Elm Street workflow', status: 'draft' }] })
  })

  it('adopts the workflow another caller created when its own insert loses the race', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    world({ workflows: [], insertFails: true })
    renderWithProviders(<Probe role="dev" />)
    await screen.findByText(/^wf:w-raced /)
  })

  it('runs one find-or-create per project at a time', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    world()
    renderWithProviders(<Probe role="dev" />)
    await screen.findByText(/^wf:w1 /)
    await settle()
    queries.length = 0
    let a: string | null = null
    let b: string | null = null
    await act(async () => {
      ;[a, b] = await Promise.all([latest.ensureWorkflow('p1'), latest.ensureWorkflow('p1')])
    })
    expect([a, b]).toEqual(['w1', 'w1'])
    expect(reads('project_workflows')).toHaveLength(1)
  })

  it('refreshSteps reads the steps again even when nothing changed', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    world()
    renderWithProviders(<Probe role="dev" />)
    await screen.findByText(/^wf:w1 steps:s1,s2,s3 /)
    await settle()
    const before = reads('project_workflow_steps').length
    await act(async () => {
      expect(await latest.refreshSteps()).toBeNull()
    })
    expect(reads('project_workflow_steps').length).toBe(before + 1)
  })

  it('a re-read that fails after a write keeps the steps and goes to error, not loadError', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    world()
    renderWithProviders(<Probe role="dev" />)
    await screen.findByText(/^wf:w1 steps:s1,s2,s3 /)
    await settle()
    let okRun = false
    await act(async () => {
      okRun = await latest.executeLifecyclePlan(
        { updates: [{ stepId: 's2', update: { status: 'completed' } }], actions: [], notifications: [] } as never,
        new Map(latest.steps.map((s) => [s.id, s])),
      )
    })
    expect(okRun).toBe(true)
    world({ stepsReadFails: true })
    await act(async () => {
      await latest.refreshSteps()
    })
    expect(screen.getByTestId('e').textContent).toMatch(/^wf:w1 steps:s1,s2,s3 .* error:Failed to load steps: timeout$/)
    expect(screen.getByTestId('load').textContent).toBe('load:-')
  })

  it('runs a lifecycle plan: updates in order, then the action rows; the first failed update stops it', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    world({ updateFailsFor: 's3' })
    renderWithProviders(<Probe role="dev" />)
    await screen.findByText(/^wf:w1 steps:s1,s2,s3 /)
    await settle()
    const byId = new Map(latest.steps.map((s) => [s.id, s]))
    queries.length = 0
    let okRun = false
    await act(async () => {
      okRun = await latest.executeLifecyclePlan(
        {
          updates: [
            { stepId: 's2', update: { status: 'completed' } },
            { stepId: 's1', update: { status: 'approved' } },
          ],
          actions: [{ stepId: 's2', actionType: 'completed' }],
          notifications: [],
        } as never,
        byId,
      )
    })
    expect(okRun).toBe(true)
    const updates = queries.filter((q) => q.table === 'project_workflow_steps' && has(q.steps, 'update')).map((q) => eqOf(q.steps, 'id'))
    expect(updates).toEqual(['s2', 's1'])
    const action = queries.find((q) => q.table === 'project_workflow_step_actions' && has(q.steps, 'insert'))!
    expect(action.steps[0]!.args[0]).toMatchObject({ step_id: 's2', action_type: 'completed', performed_by: 'Pat Office' })
    await waitFor(() => expect(latest.stepActions.s2?.[0]?.id).toBe('a-new'))

    queries.length = 0
    await act(async () => {
      okRun = await latest.executeLifecyclePlan(
        {
          updates: [
            { stepId: 's3', update: { status: 'completed' } },
            { stepId: 's2', update: { status: 'approved' } },
          ],
          actions: [{ stepId: 's3', actionType: 'completed' }],
          notifications: [],
        } as never,
        byId,
      )
    })
    expect(okRun).toBe(false)
    expect(queries.filter((q) => q.table === 'project_workflow_steps' && has(q.steps, 'update'))).toHaveLength(1)
    expect(queries.some((q) => q.table === 'project_workflow_step_actions')).toBe(false)
    expect(latest.error).toBe('Failed to update step: rls')
    expect(latest.loadError).toBeNull()
  })

  it('finds a step’s neighbours by sequence order', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    world()
    renderWithProviders(<Probe role="dev" />)
    await screen.findByText(/^wf:w1 steps:s1,s2,s3 /)
    const [s1, s2, s3] = latest.steps
    expect(latest.findPreviousStep(s2!)?.id).toBe('s1')
    expect(latest.findNextStep(s2!)?.id).toBe('s3')
    expect(latest.findPreviousStep(s1!)).toBeNull()
    expect(latest.findNextStep(s3!)).toBeNull()
  })
})
