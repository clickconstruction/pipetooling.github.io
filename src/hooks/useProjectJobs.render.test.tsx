// @vitest-environment jsdom
/**
 * v2.3943: the Workflow page's jobs read as a hook. Pins the seam — nothing is read without a
 * project; with one, the list is the project's jobs_ledger rows; a new project re-reads and no
 * project empties the list; a failed read logs and leaves the list empty.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { renderSettled, renderWithProviders } from '../test/renderSmokeMocks'
import { useProjectJobs } from './useProjectJobs'

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

const jobsByProject: Record<string, Array<{ id: string; hcp_number: string; job_name: string; status: string }>> = {
  p1: [
    { id: 'j1', hcp_number: '978', job_name: 'Elm St rough', status: 'working' },
    { id: 'j2', hcp_number: '', job_name: 'Elm St trim', status: 'working' },
  ],
  p2: [{ id: 'j3', hcp_number: '1001', job_name: 'Oak Ave', status: 'billed' }],
}

function Probe({ projectId }: { projectId: string | undefined }) {
  const jobs = useProjectJobs(projectId)
  return <div data-testid="jobs">{`jobs:${jobs.map((j) => j.id).join(',') || '-'}`}</div>
}

afterEach(() => {
  cleanup()
  queries.length = 0
  route = () => ({ data: [], error: null })
  vi.restoreAllMocks()
})

describe('useProjectJobs', () => {
  it('reads nothing without a project', async () => {
    await renderSettled(<Probe projectId={undefined} />, { loaded: () => screen.findByTestId('jobs') })
    expect(screen.getByTestId('jobs').textContent).toBe('jobs:-')
    expect(queries).toEqual([])
  })

  it('reads the project’s jobs off jobs_ledger', async () => {
    route = (_t, steps) => {
      const pid = steps.find((s) => s.method === 'eq')!.args[1] as string
      return { data: jobsByProject[pid] ?? [], error: null }
    }
    renderWithProviders(<Probe projectId="p1" />)
    await screen.findByText('jobs:j1,j2')
    expect(queries).toHaveLength(1)
    expect(queries[0]!.table).toBe('jobs_ledger')
    expect(queries[0]!.steps).toEqual([
      { method: 'select', args: ['id, hcp_number, job_name, status'] },
      { method: 'eq', args: ['project_id', 'p1'] },
    ])
  })

  it('re-reads for a new project and empties the list when the project goes', async () => {
    route = (_t, steps) => {
      const pid = steps.find((s) => s.method === 'eq')!.args[1] as string
      return { data: jobsByProject[pid] ?? [], error: null }
    }
    const { rerender } = renderWithProviders(<Probe projectId="p1" />)
    await screen.findByText('jobs:j1,j2')
    rerender(<Probe projectId="p2" />)
    await screen.findByText('jobs:j3')
    rerender(<Probe projectId={undefined} />)
    await screen.findByText('jobs:-')
    expect(queries).toHaveLength(2)
  })

  it('a failed read logs and leaves the list empty', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    route = () => ({ data: null, error: { message: 'down' } })
    await renderSettled(<Probe projectId="p1" />, { loaded: () => screen.findByText('jobs:-') })
    expect(logged).toHaveBeenCalledTimes(1)
  })
})
