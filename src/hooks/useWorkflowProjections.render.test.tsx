// @vitest-environment jsdom
/**
 * v2.4005: the Workflow page's projections as a hook. Pins the seam — dev and master only, and
 * nothing is read for anyone else; the first read waits for the workflow; a save checks the
 * workflow before the words, writes the fields the kernel builds, closes the window and re-reads;
 * a delete re-reads whether or not it was refused; every failure goes to onError — a refused delete
 * too since v2.5103 (it said nothing before; the map's quirk 24).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, screen } from '@testing-library/react'
import { renderSettled, renderWithProviders, settle } from '../test/renderSmokeMocks'
import { useWorkflowProjections, type WorkflowProjection, type WorkflowProjections } from './useWorkflowProjections'

type Step = { method: string; args: unknown[] }
type Result = { data: unknown; error: { message: string } | null }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string, steps: Step[]) => Result = () => ({ data: [], error: null })
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: Result) => void) => resolve(route(table, steps))
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

const has = (steps: Step[], method: string) => steps.some((s) => s.method === method)
const writes = (method: string) => queries.filter((q) => has(q.steps, method))
const reads = () => queries.filter((q) => has(q.steps, 'select'))

function row(id: string, sequence_order: number, extra: Partial<WorkflowProjection> = {}): WorkflowProjection {
  return {
    id,
    workflow_id: 'w1',
    stage_name: 'Rough',
    memo: 'draw',
    amount: 100,
    sequence_order,
    step_id: null,
    placement: null,
    collected: false,
    created_at: null,
    updated_at: null,
    ...extra,
  }
}

/** A table of projections the mock reads from and writes to. */
function world(initial: WorkflowProjection[], opts: { readFails?: boolean; writeFails?: boolean } = {}) {
  let rows = [...initial]
  route = (_table, steps) => {
    if (has(steps, 'insert')) {
      if (opts.writeFails) return { data: null, error: { message: 'rls' } }
      const payload = steps.find((s) => s.method === 'insert')!.args[0] as Partial<WorkflowProjection>
      rows.push(row(`new${rows.length}`, payload.sequence_order ?? 0, payload))
      return { data: null, error: null }
    }
    if (has(steps, 'update')) {
      if (opts.writeFails) return { data: null, error: { message: 'rls' } }
      const id = steps.find((s) => s.method === 'eq')!.args[1]
      const patch = steps.find((s) => s.method === 'update')!.args[0] as Partial<WorkflowProjection>
      rows = rows.map((r) => (r.id === id ? { ...r, ...patch } : r))
      return { data: null, error: null }
    }
    if (has(steps, 'delete')) {
      if (opts.writeFails) return { data: null, error: { message: 'rls' } }
      const id = steps.find((s) => s.method === 'eq')!.args[1]
      rows = rows.filter((r) => r.id !== id)
      return { data: null, error: null }
    }
    if (opts.readFails) return { data: null, error: { message: 'down' } }
    return { data: [...rows].sort((a, b) => a.sequence_order - b.sequence_order), error: null }
  }
}

let latest: WorkflowProjections
const onError = vi.fn()
const ensureWorkflow = vi.fn(async () => 'w-found' as string | null)

function Probe({ workflowId, userRole, projectId = 'p1' }: { workflowId: string | null; userRole: string | null; projectId?: string }) {
  const p = useWorkflowProjections({ workflowId, projectId, userRole, ensureWorkflow, onError })
  latest = p
  return (
    <div data-testid="p">
      {`list:${p.projections.map((r) => `${r.id}=${r.amount}`).join(',') || '-'} window:${p.editingProjection ? (p.editingProjection.item?.id ?? 'new') : 'closed'}`}
    </div>
  )
}

afterEach(() => {
  cleanup()
  queries.length = 0
  onError.mockReset()
  ensureWorkflow.mockClear()
  ensureWorkflow.mockImplementation(async () => 'w-found')
})

describe('useWorkflowProjections', () => {
  it('reads nothing for a role that is not dev or master, or before the workflow is known', async () => {
    world([row('a', 1)])
    for (const userRole of ['assistant', 'superintendent', 'subcontractor', null]) {
      await renderSettled(<Probe workflowId="w1" userRole={userRole} />, { loaded: () => screen.findByTestId('p') })
      expect(screen.getByTestId('p').textContent).toBe('list:- window:closed')
      cleanup()
    }
    await renderSettled(<Probe workflowId={null} userRole="dev" />, { loaded: () => screen.findByTestId('p') })
    expect(queries).toEqual([])
  })

  it('reads the workflow’s projections in sequence order for dev and master', async () => {
    world([row('b', 2), row('a', 1)])
    renderWithProviders(<Probe workflowId="w1" userRole="master_technician" />)
    await screen.findByText('list:a=100,b=100 window:closed')
    expect(queries).toHaveLength(1)
    expect(queries[0]!.table).toBe('workflow_projections')
    expect(queries[0]!.steps).toEqual([
      { method: 'select', args: ['*'] },
      { method: 'eq', args: ['workflow_id', 'w1'] },
      { method: 'order', args: ['sequence_order', { ascending: true }] },
    ])
  })

  it('empties the list when the role stops being dev or master', async () => {
    world([row('a', 1)])
    const { rerender } = renderWithProviders(<Probe workflowId="w1" userRole="dev" />)
    await screen.findByText('list:a=100 window:closed')
    rerender(<Probe workflowId="w1" userRole="assistant" />)
    await screen.findByText('list:- window:closed')
  })

  it('a failed read goes to onError and leaves the list as it was', async () => {
    world([row('a', 1)], { readFails: true })
    renderWithProviders(<Probe workflowId="w1" userRole="dev" />)
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith('Failed to load projections: down'))
    expect(screen.getByTestId('p').textContent).toBe('list:- window:closed')
  })

  it('opens the window on a projection, or blank on a step', async () => {
    world([row('a', 1)])
    renderWithProviders(<Probe workflowId="w1" userRole="dev" />)
    await screen.findByText('list:a=100 window:closed')
    await settle()
    act(() => latest.openEditProjection(latest.projections[0]!))
    expect(screen.getByTestId('p').textContent).toBe('list:a=100 window:a')
    act(() => latest.openEditProjection(null, { step_id: 's3', placement: 'before' }))
    expect(latest.editingProjection).toMatchObject({ item: null, step_id: 's3', placement: 'before' })
    act(() => latest.setEditingProjection(null))
    expect(screen.getByTestId('p').textContent).toBe('list:a=100 window:closed')
  })

  it('a new projection is written after the last in hand, then the window closes and the list is re-read', async () => {
    world([row('a', 1), row('b', 7)])
    renderWithProviders(<Probe workflowId="w1" userRole="dev" />)
    await screen.findByText('list:a=100,b=100 window:closed')
    await settle()
    act(() => latest.openEditProjection(null))
    await act(async () => {
      await latest.saveProjection(null, ' Top Out ', ' draw 2 ', '2500', { step_id: 's2', placement: 'before' })
    })
    expect(writes('insert')[0]!.steps[0]).toEqual({
      method: 'insert',
      args: [{ workflow_id: 'w1', stage_name: 'Top Out', memo: 'draw 2', amount: 2500, step_id: 's2', placement: 'before', sequence_order: 8 }],
    })
    await screen.findByText('list:a=100,b=100,new2=2500 window:closed')
    expect(onError).not.toHaveBeenCalled()
  })

  it('an edit updates the row by id and leaves its sequence alone', async () => {
    world([row('a', 1)])
    renderWithProviders(<Probe workflowId="w1" userRole="dev" />)
    await screen.findByText('list:a=100 window:closed')
    await settle()
    await act(async () => {
      await latest.saveProjection(latest.projections[0]!, 'Rough', 'draw 1', '-40', { step_id: '', placement: 'after' })
    })
    const update = writes('update')[0]!
    expect(update.steps).toEqual([
      { method: 'update', args: [{ stage_name: 'Rough', memo: 'draw 1', amount: -40, step_id: null, placement: null }] },
      { method: 'eq', args: ['id', 'a'] },
    ])
    await screen.findByText('list:a=-40 window:closed')
  })

  it('a save with blank words is refused before anything is written, and the window stays open', async () => {
    world([row('a', 1)])
    renderWithProviders(<Probe workflowId="w1" userRole="dev" />)
    await screen.findByText('list:a=100 window:closed')
    await settle()
    act(() => latest.openEditProjection(null))
    await act(async () => {
      await latest.saveProjection(null, 'Rough', '  ', '10')
    })
    expect(onError).toHaveBeenLastCalledWith('Step name and memo are required')
    expect(writes('insert')).toEqual([])
    expect(screen.getByTestId('p').textContent).toBe('list:a=100 window:new')
  })

  it('a refused write names the action, keeps the window open and does not re-read', async () => {
    world([row('a', 1)], { writeFails: true })
    renderWithProviders(<Probe workflowId="w1" userRole="dev" />)
    await screen.findByText('list:a=100 window:closed')
    await settle()
    act(() => latest.openEditProjection(null))
    const readsBefore = reads().length
    await act(async () => {
      await latest.saveProjection(null, 'Rough', 'x', '10')
    })
    expect(onError).toHaveBeenLastCalledWith('Failed to insert projection: rls')
    await act(async () => {
      await latest.saveProjection(latest.projections[0]!, 'Rough', 'x', '10')
    })
    expect(onError).toHaveBeenLastCalledWith('Failed to update projection: rls')
    expect(reads().length).toBe(readsBefore)
    expect(screen.getByTestId('p').textContent).toBe('list:a=100 window:new')
  })

  it('a delete removes the row and re-reads; a refused delete is reported, and the re-read shows the row still there', async () => {
    world([row('a', 1), row('b', 2)])
    renderWithProviders(<Probe workflowId="w1" userRole="dev" />)
    await screen.findByText('list:a=100,b=100 window:closed')
    await settle()
    await act(async () => {
      await latest.deleteProjection('a')
    })
    expect(writes('delete')[0]!.steps).toContainEqual({ method: 'eq', args: ['id', 'a'] })
    await screen.findByText('list:b=100 window:closed')

    cleanup()
    queries.length = 0
    world([row('a', 1)], { writeFails: true })
    renderWithProviders(<Probe workflowId="w1" userRole="dev" />)
    await screen.findByText('list:a=100 window:closed')
    await settle()
    const readsBefore = reads().length
    await act(async () => {
      await latest.deleteProjection('a')
    })
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenLastCalledWith('Failed to delete projection: rls')
    expect(reads().length).toBe(readsBefore + 1)
    expect(screen.getByTestId('p').textContent).toBe('list:a=100 window:closed')
  })

  it('with no workflow in hand, a write finds the project’s workflow first — and checks it before the words', async () => {
    world([])
    await renderSettled(<Probe workflowId={null} userRole="dev" />, { loaded: () => screen.findByTestId('p') })
    await act(async () => {
      await latest.saveProjection(null, 'Rough', 'x', '10')
    })
    expect(ensureWorkflow).toHaveBeenCalledWith('p1')
    expect((writes('insert')[0]!.steps[0]!.args[0] as { workflow_id: string }).workflow_id).toBe('w-found')

    ensureWorkflow.mockImplementation(async () => null)
    queries.length = 0
    await act(async () => {
      await latest.saveProjection(null, '', '', '10')
    })
    expect(onError).toHaveBeenLastCalledWith('Workflow not found. Please refresh the page.')
    await act(async () => {
      await latest.deleteProjection('a')
    })
    expect(onError).toHaveBeenLastCalledWith('Workflow not found. Please refresh the page.')
    expect(queries).toEqual([])
  })
})
