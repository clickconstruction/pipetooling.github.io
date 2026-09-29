// @vitest-environment jsdom
/**
 * Render smoke for the Workflow page — the safety net for the map's steps 9 and 10 (the engine
 * hooks and the stage cards; docs/WORKFLOW_PAGE_ARCHITECTURE.md). It mounts the page at
 * `/workflows/:projectId` against a stateful Supabase stand-in and reads what a viewer sees:
 * the header, the stage list per role, the Hide Old Steps summary, the Projections & Ledger bar,
 * a subcontractor's filtered view, and what Approve does to the list — the approved card folds,
 * the next one opens. Not a test of every region.
 */
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '../contexts/ToastContext'
import { ConfirmDialogProvider } from '../contexts/ConfirmDialogContext'

type Row = Record<string, unknown>
type Step = { method: string; args: unknown[] }

const world = vi.hoisted(() => ({
  role: 'dev' as string,
  userName: 'Pat Office',
  steps: [] as Array<Record<string, unknown>>,
  lineItems: [] as Array<Record<string, unknown>>,
  projections: [] as Array<Record<string, unknown>>,
  templates: [] as Array<Record<string, unknown>>,
  templateSteps: [] as Array<Record<string, unknown>>,
  writes: [] as Array<{ table: string; method: string; payload: unknown; id: unknown }>,
  stepReads: [] as Array<Array<{ method: string; args: unknown[] }>>,
}))

vi.mock('../lib/supabase', () => {
  const has = (steps: Step[], m: string) => steps.some((s) => s.method === m)
  const arg = (steps: Step[], m: string, i = 0) => steps.find((s) => s.method === m)?.args[i]
  const eqValue = (steps: Step[], col: string) => steps.find((s) => s.method === 'eq' && s.args[0] === col)?.args[1]

  function answer(table: string, steps: Step[]): { data: unknown; error: null } {
    const single = has(steps, 'single') || has(steps, 'maybeSingle')
    const list = (rows: Row[]) => ({ data: single ? (rows[0] ?? null) : rows, error: null })
    for (const m of ['insert', 'update', 'delete', 'upsert']) {
      if (has(steps, m)) {
        world.writes.push({ table, method: m, payload: arg(steps, m), id: eqValue(steps, 'id') })
        if (table === 'project_workflow_steps' && m === 'update') {
          const id = eqValue(steps, 'id')
          world.steps = world.steps.map((s) => (s.id === id ? { ...s, ...(arg(steps, m) as Row) } : s))
        }
        if (table === 'project_workflow_steps' && m === 'insert') {
          const row = arg(steps, m) as Row
          world.steps = [...world.steps, { id: `new-${world.steps.length + 1}`, assigned_to_name: null, started_at: null, ended_at: null, ...row }]
          return { data: [{ id: `new-${world.steps.length}` }], error: null }
        }
        if (table === 'project_workflow_step_actions' && m === 'insert') {
          return { data: { id: `act-${world.writes.length}`, ...(arg(steps, m) as Row) }, error: null }
        }
        return { data: null, error: null }
      }
    }
    switch (table) {
      case 'users':
        if (eqValue(steps, 'id')) return list([{ role: world.role, name: world.userName, email: 'pat@example.test' }])
        return list([{ name: world.userName, email: 'pat@example.test', role: world.role, archived_at: null, is_digital_twin: false }])
      case 'projects':
        return list([{ id: 'p1', name: 'Elm Street', project_number: null }])
      case 'project_workflows':
        return list([{ id: 'w1', project_id: 'p1', name: 'Elm Street workflow', status: 'draft' }])
      case 'project_workflow_steps': {
        world.stepReads.push(steps)
        const who = eqValue(steps, 'assigned_to_name')
        const rows = world.steps
          .filter((s) => who === undefined || s.assigned_to_name === who)
          .sort((a, b) => (a.sequence_order as number) - (b.sequence_order as number))
        return list(rows)
      }
      case 'workflow_step_line_items':
        return list(world.lineItems)
      case 'workflow_projections':
        return list(world.projections)
      case 'workflow_templates':
        return list(world.templates)
      case 'workflow_template_steps':
        return list(world.templateSteps)
      default:
        return list([])
    }
  }

  function from(table: string) {
    const steps: Step[] = []
    const p: unknown = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(answer(table, steps))
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
      rpc: async () => ({ data: null, error: null }),
      functions: { invoke: async () => ({ data: null, error: null }) },
      auth: {
        getUser: async () => ({ data: { user: { id: 'smoke-auth-user-1' } }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
      },
    },
  }
})

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import Workflow from './Workflow'
import { installDomShims, settle } from '../test/renderSmokeMocks'

function step(id: string, name: string, sequence_order: number, status: string, extra: Row = {}): Row {
  return {
    id,
    workflow_id: 'w1',
    name,
    sequence_order,
    status,
    assigned_to_name: null,
    assigned_person_id: null,
    assigned_skill: null,
    notes: null,
    private_notes: null,
    started_at: status === 'pending' ? null : '2026-09-01T14:00:00Z',
    ended_at: status === 'completed' || status === 'approved' ? '2026-09-03T14:00:00Z' : null,
    approved_at: null,
    approved_by: null,
    rejection_reason: null,
    skipped_reason: null,
    scheduled_start_date: null,
    scheduled_end_date: null,
    percent_complete: null,
    next_step_rejected_notice: null,
    next_step_rejection_reason: null,
    notify_assigned_when_started: false,
    notify_assigned_when_complete: false,
    notify_assigned_when_reopened: false,
    notify_next_assignee_when_complete_or_approved: true,
    notify_prior_assignee_when_rejected: true,
    inspection_notes: null,
    inspector_name: null,
    step_type: null,
    template_step_id: null,
    created_at: null,
    updated_at: null,
    ...extra,
  }
}

function renderWorkflow(role: string, steps: Row[]) {
  world.role = role
  world.steps = steps
  world.writes = []
  world.stepReads = []
  installDomShims()
  return render(
    <Routes>
      <Route path="/workflows/:projectId" element={<Workflow />} />
    </Routes>,
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ToastProvider>
          <ConfirmDialogProvider>
            <MemoryRouter initialEntries={['/workflows/p1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              {children}
            </MemoryRouter>
          </ConfirmDialogProvider>
        </ToastProvider>
      ),
    },
  )
}

/** The stage list has painted: a card at its #step- anchor. */
async function stagesLoaded(stepId: string) {
  await waitFor(() => expect(document.getElementById(`step-${stepId}`)).toBeTruthy())
  await settle()
}

/** The chevron on a card's first row: ▶ folded, ▼ open. */
function chevronOf(stepId: string): string {
  const card = document.getElementById(`step-${stepId}`)!
  return within(card).getAllByRole('button')[0]!.textContent!.slice(0, 1)
}

const fourSteps = () => [
  step('s1', 'Underground', 1, 'approved'),
  step('s2', 'Rough', 2, 'completed'),
  step('s3', 'Top Out', 3, 'in_progress', { assigned_to_name: 'Sam Sub' }),
  step('s4', 'Trim', 4, 'pending'),
]

afterEach(() => {
  cleanup()
  world.lineItems = []
  world.projections = []
  world.templates = []
  world.templateSteps = []
  vi.restoreAllMocks()
})

describe('Workflow page', () => {
  it('draws the project and every stage, each at its #step- anchor, open or folded by status', async () => {
    renderWorkflow('dev', fourSteps())
    expect(await screen.findByRole('heading', { name: 'Elm Street – Workflow' })).toBeTruthy()
    await stagesLoaded('s3')
    for (const id of ['s1', 's2', 's3', 's4']) expect(document.getElementById(`step-${id}`)).toBeTruthy()
    expect(chevronOf('s1')).toBe('▶')
    expect(chevronOf('s2')).toBe('▶')
    expect(chevronOf('s3')).toBe('▼')
    expect(chevronOf('s4')).toBe('▶')
    // No filter on the steps for an office role.
    expect(world.stepReads[0]!.some((s) => s.method === 'eq' && s.args[0] === 'assigned_to_name')).toBe(false)
  })

  it('shows dev the Projections & Ledger bar and the Add step button', async () => {
    world.projections = [{ id: 'pr1', workflow_id: 'w1', stage_name: 'Rough', memo: 'draw', amount: 5000, sequence_order: 1, step_id: null, placement: null }]
    renderWorkflow('dev', fourSteps())
    await stagesLoaded('s3')
    expect(await screen.findByText('Projections: $5,000.00')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add step' })).toBeTruthy()
  })

  it('hides the older finished stages behind one summary row, keeping the latest finished one', async () => {
    renderWorkflow('dev', fourSteps())
    await stagesLoaded('s3')
    fireEvent.click(screen.getByRole('button', { name: 'Hide Old Steps' }))
    expect(screen.getByText(/^1 previous step · Started/)).toBeTruthy()
    expect(document.getElementById('step-s1')).toBeNull()
    expect(document.getElementById('step-s2')).toBeTruthy()
    fireEvent.click(screen.getByText(/^1 previous step · Started/))
    expect(document.getElementById('step-s1')).toBeTruthy()
  })

  it('shows a subcontractor only the stages assigned to them, without the office controls', async () => {
    world.userName = 'Sam Sub'
    try {
      renderWorkflow('subcontractor', fourSteps())
      await stagesLoaded('s3')
      expect(world.stepReads.some((r) => r.some((s) => s.method === 'eq' && s.args[0] === 'assigned_to_name' && s.args[1] === 'Sam Sub'))).toBe(true)
      expect(document.getElementById('step-s1')).toBeNull()
      expect(document.getElementById('step-s3')).toBeTruthy()
      expect(screen.queryByText(/^Projections:/)).toBeNull()
      expect(screen.queryByRole('button', { name: 'Add step' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
    } finally {
      world.userName = 'Pat Office'
    }
  })

  it('tells a subcontractor with no stages here that they have no access', async () => {
    world.userName = 'Nobody Assigned'
    try {
      renderWorkflow('subcontractor', fourSteps())
      expect(await screen.findByText(/You do not have access to this workflow/)).toBeTruthy()
    } finally {
      world.userName = 'Pat Office'
    }
  })

  it('Approve writes the step, then folds its card and opens the next one', async () => {
    const scrolled = vi.fn()
    Element.prototype.scrollIntoView = scrolled
    renderWorkflow('dev', fourSteps())
    await stagesLoaded('s3')
    const card = document.getElementById('step-s3')!
    await act(async () => {
      fireEvent.click(within(card).getByRole('button', { name: 'Approve' }))
    })
    await waitFor(() => expect(chevronOf('s3')).toBe('▶'))
    expect(chevronOf('s4')).toBe('▼')
    const update = world.writes.find((w) => w.table === 'project_workflow_steps' && w.method === 'update' && w.id === 's3')
    expect(update?.payload).toMatchObject({ status: 'approved', approved_by: 'Pat Office' })
    expect(world.writes.some((w) => w.table === 'project_workflow_step_actions' && (w.payload as Row).action_type === 'approved')).toBe(true)
    await waitFor(() => expect(scrolled).toHaveBeenCalled())
  })
  it('an empty workflow offers the templates, and creating from one adds its steps in order', async () => {
    world.templates = [{ id: 't1', name: 'Standard rough' }]
    world.templateSteps = [
      { sequence_order: 1, name: 'Underground' },
      { sequence_order: 2, name: 'Rough' },
    ]
    renderWorkflow('dev', [])
    expect(await screen.findByText('No steps yet. Add a step or create from a template.')).toBeTruthy()
    const create = screen.getByRole('button', { name: 'Create from template' }) as HTMLButtonElement
    expect(create.disabled).toBe(true)
    fireEvent.change(screen.getByDisplayValue('Select a template'), { target: { value: 't1' } })
    await act(async () => {
      fireEvent.click(create)
    })
    const inserted = world.writes.filter((w) => w.table === 'project_workflow_steps' && w.method === 'insert').map((w) => (w.payload as Row).name)
    expect(inserted).toEqual(['Underground', 'Rough'])
    await waitFor(() => expect(document.querySelectorAll('[id^="step-new-"]').length).toBe(2))
  })

  it('a card’s buttons open the page’s windows: Assign, Set Start, Send Back', async () => {
    renderWorkflow('dev', fourSteps())
    await stagesLoaded('s3')
    const card = (id: string) => document.getElementById(`step-${id}`)!
    fireEvent.click(within(card('s3')).getByRole('button', { name: 'Assign' }))
    expect(screen.getByText('Add person to: Top Out')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(within(card('s3')).getByRole('button', { name: 'Send Back: Previous Work Incomplete' }))
    expect(screen.getByText('Previous work incomplete: Top Out')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    // Trim is pending and starts folded: open it, then Set Start.
    fireEvent.click(within(card('s4')).getAllByRole('button')[0]!)
    fireEvent.click(within(card('s4')).getByRole('button', { name: 'Set Start' }))
    expect(screen.getByText('Set Start Time: Trim')).toBeTruthy()
  })

  it('a wide window shows dev the ledger rail’s margin card when there is money', async () => {
    const was = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1400 })
    try {
      world.projections = [{ id: 'pr1', workflow_id: 'w1', stage_name: 'Rough', memo: 'draw', amount: 10000, sequence_order: 1, step_id: 's2', placement: 'after' }]
      world.lineItems = [{ id: 'li1', step_id: 's2', memo: 'pipe', amount: 2500, sequence_order: 1, item_date: null, link: null }]
      renderWorkflow('dev', fourSteps())
      await stagesLoaded('s3')
      expect(await screen.findByText('Project margin')).toBeTruthy()
      // The line items land 50 ms after the steps: 10,000 projected, 2,500 spent.
      expect(await screen.findByText('75.0%')).toBeTruthy()
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: was })
    }
  })
})
