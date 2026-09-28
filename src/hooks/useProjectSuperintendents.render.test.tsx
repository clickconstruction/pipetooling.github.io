// @vitest-environment jsdom
/**
 * v2.3936: the Workflow page's superintendent reads and writes as a hook. Pins the seam — nothing
 * loads without a project or for a viewer who may not assign; with both, the project's list is
 * the users behind its rows and the add list is every active superintendent; an add re-reads the
 * project's list, a remove drops the row in hand; a failed write goes to onError and a failed
 * read leaves its list empty.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, screen } from '@testing-library/react'
import { renderSettled, renderWithProviders, settle } from '../test/renderSmokeMocks'
import { useProjectSuperintendents, type ProjectSuperintendents } from './useProjectSuperintendents'

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
const sam = { id: 'u1', name: 'Sam Ortiz', email: 'sam@example.test' }
const lee = { id: 'u2', name: 'Lee Park', email: 'lee@example.test' }

/** The project has `assignedIds`; `users` answers the by-ids read and the role read apart. */
function world(assignedIds: string[], opts: { insertFails?: boolean; deleteFails?: boolean; linksFail?: boolean; roleReadFails?: boolean } = {}) {
  const assigned = [...assignedIds]
  route = (table, steps) => {
    if (table === 'project_superintendents') {
      if (has(steps, 'insert')) {
        if (opts.insertFails) return { data: null, error: { message: 'rls' } }
        const row = steps.find((s) => s.method === 'insert')!.args[0] as { superintendent_id: string }
        assigned.push(row.superintendent_id)
        return { data: null, error: null }
      }
      if (has(steps, 'delete')) {
        return opts.deleteFails ? { data: null, error: { message: 'rls' } } : { data: null, error: null }
      }
      if (opts.linksFail) return { data: null, error: { message: 'down' } }
      return { data: assigned.map((id) => ({ superintendent_id: id })), error: null }
    }
    if (table === 'users') {
      if (has(steps, 'in')) {
        const ids = steps.find((s) => s.method === 'in')!.args[1] as string[]
        return { data: [sam, lee].filter((u) => ids.includes(u.id)), error: null }
      }
      if (opts.roleReadFails) return { data: null, error: { message: 'down' } }
      return { data: [lee, sam], error: null }
    }
    return { data: [], error: null }
  }
}

let latest: ProjectSuperintendents
const onError = vi.fn()

function Probe({ projectId, canAssign }: { projectId: string | undefined; canAssign: boolean }) {
  const s = useProjectSuperintendents(projectId, canAssign, onError)
  latest = s
  return (
    <div data-testid="s">
      {`on:${s.projectSuperintendents.map((u) => u.id).join(',') || '-'} all:${s.allSuperintendents.map((u) => u.id).join(',') || '-'} ${s.saving ? 'saving' : 'idle'}`}
    </div>
  )
}

afterEach(() => {
  cleanup()
  queries.length = 0
  onError.mockReset()
  vi.restoreAllMocks()
})

describe('useProjectSuperintendents', () => {
  it('reads nothing without a project, or for a viewer who may not assign', async () => {
    world(['u1'])
    await renderSettled(<Probe projectId={undefined} canAssign />, { loaded: () => screen.findByTestId('s') })
    expect(screen.getByTestId('s').textContent).toBe('on:- all:- idle')
    cleanup()
    await renderSettled(<Probe projectId="p1" canAssign={false} />, { loaded: () => screen.findByTestId('s') })
    expect(screen.getByTestId('s').textContent).toBe('on:- all:- idle')
    expect(queries).toEqual([])
  })

  it('loads the project’s superintendents and every active one', async () => {
    world(['u1'])
    renderWithProviders(<Probe projectId="p1" canAssign />)
    await screen.findByText('on:u1 all:u2,u1 idle')
    const links = queries.find((q) => q.table === 'project_superintendents')!
    expect(links.steps).toContainEqual({ method: 'eq', args: ['project_id', 'p1'] })
    const roleRead = queries.find((q) => q.table === 'users' && !has(q.steps, 'in'))!
    expect(roleRead.steps).toContainEqual({ method: 'eq', args: ['role', 'superintendent'] })
    expect(roleRead.steps).toContainEqual({ method: 'is', args: ['archived_at', null] })
    expect(roleRead.steps).toContainEqual({ method: 'order', args: ['name'] })
  })

  it('skips the users read when the project has nobody', async () => {
    world([])
    renderWithProviders(<Probe projectId="p1" canAssign />)
    await screen.findByText('on:- all:u2,u1 idle')
    expect(queries.filter((q) => q.table === 'users' && has(q.steps, 'in'))).toEqual([])
  })

  it('empties both lists when the viewer stops being able to assign', async () => {
    world(['u1'])
    const { rerender } = renderWithProviders(<Probe projectId="p1" canAssign />)
    await screen.findByText('on:u1 all:u2,u1 idle')
    rerender(<Probe projectId="p1" canAssign={false} />)
    await screen.findByText('on:- all:- idle')
  })

  it('an add writes the row and re-reads the project’s list', async () => {
    world(['u1'])
    renderWithProviders(<Probe projectId="p1" canAssign />)
    await screen.findByText('on:u1 all:u2,u1 idle')
    await settle()
    await act(async () => {
      await latest.addProjectSuperintendent('u2')
    })
    await screen.findByText('on:u1,u2 all:u2,u1 idle')
    const insert = queries.find((q) => q.table === 'project_superintendents' && has(q.steps, 'insert'))!
    expect(insert.steps[0]).toEqual({ method: 'insert', args: [{ project_id: 'p1', superintendent_id: 'u2' }] })
    expect(onError).not.toHaveBeenCalled()
  })

  it('a remove deletes the row and drops it from the list in hand, without a re-read', async () => {
    world(['u1', 'u2'])
    renderWithProviders(<Probe projectId="p1" canAssign />)
    await screen.findByText('on:u1,u2 all:u2,u1 idle')
    await settle()
    const readsBefore = queries.filter((q) => q.table === 'project_superintendents' && has(q.steps, 'select')).length
    await act(async () => {
      await latest.removeProjectSuperintendent('u1')
    })
    await screen.findByText('on:u2 all:u2,u1 idle')
    const del = queries.find((q) => q.table === 'project_superintendents' && has(q.steps, 'delete'))!
    expect(del.steps).toContainEqual({ method: 'eq', args: ['project_id', 'p1'] })
    expect(del.steps).toContainEqual({ method: 'eq', args: ['superintendent_id', 'u1'] })
    expect(queries.filter((q) => q.table === 'project_superintendents' && has(q.steps, 'select')).length).toBe(readsBefore)
  })

  it('a refused add or remove goes to onError and leaves the list as it was', async () => {
    world(['u1'], { insertFails: true, deleteFails: true })
    renderWithProviders(<Probe projectId="p1" canAssign />)
    await screen.findByText('on:u1 all:u2,u1 idle')
    await settle()
    await act(async () => {
      await latest.addProjectSuperintendent('u2')
    })
    expect(onError).toHaveBeenLastCalledWith('Failed to assign superintendent: rls')
    await act(async () => {
      await latest.removeProjectSuperintendent('u1')
    })
    expect(onError).toHaveBeenLastCalledWith('Failed to remove superintendent: rls')
    expect(screen.getByTestId('s').textContent).toBe('on:u1 all:u2,u1 idle')
  })

  it('a failed read logs and leaves its list empty — it does not go to onError', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    world(['u1'], { linksFail: true, roleReadFails: true })
    await renderSettled(<Probe projectId="p1" canAssign />, { loaded: () => screen.findByText('on:- all:- idle') })
    expect(logged).toHaveBeenCalledTimes(2)
    expect(onError).not.toHaveBeenCalled()
  })

  it('writes nothing without a project', async () => {
    world([])
    await renderSettled(<Probe projectId={undefined} canAssign />, { loaded: () => screen.findByTestId('s') })
    await act(async () => {
      await latest.addProjectSuperintendent('u2')
      await latest.removeProjectSuperintendent('u2')
    })
    expect(queries).toEqual([])
  })
})
