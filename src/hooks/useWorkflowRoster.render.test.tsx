// @vitest-environment jsdom
/**
 * v2.4062: the Workflow page's viewer and roster read as a hook. Pins the seam — nothing is read
 * without a signed-in user; the viewer's role and name (else email); the Assign picker's roster
 * (active accounts, then roster people carrying their id, by name); every account name kept for
 * the ghost check; a roster person's contact winning over an account's; the sub identity; and a
 * superintendent's roster read through the masters that adopted them.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { renderSettled, renderWithProviders } from '../test/renderSmokeMocks'
import { useWorkflowRoster, type WorkflowRoster } from './useWorkflowRoster'

type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let answers: Record<string, (steps: Step[]) => unknown> = {}
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: unknown) => void) => resolve({ data: answers[table]?.(steps) ?? [], error: null })
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

const eqOf = (steps: Step[], col: string) => steps.find((s) => s.method === 'eq' && s.args[0] === col)?.args[1]

const accounts = [
  { name: 'Pat Office', email: 'pat@example.test', role: 'assistant', archived_at: null, is_digital_twin: false },
  { name: 'Sam Sub', email: 'sam@example.test', role: 'subcontractor', archived_at: null, is_digital_twin: false },
  { name: 'Old Hand', email: 'old@example.test', role: 'helpers', archived_at: '2026-01-01T00:00:00Z', is_digital_twin: false },
  { name: 'Robot Estimator', email: 'twin@example.test', role: 'estimator', archived_at: null, is_digital_twin: true },
]
const rosterPeople = [
  { id: 'pp1', name: 'Behar Plumbing', email: 'behar@example.test', phone: '555-0100', kind: 'sub' },
  { id: 'pp2', name: 'Pat Office', email: 'pat.personal@example.test', phone: '555-0101', kind: 'helper' },
]

function viewer(role: string, name: string | null = 'Dana Dev', email = 'dana@example.test') {
  answers = {
    users: (steps) => (eqOf(steps, 'id') ? { role, name, email } : accounts),
    people: () => rosterPeople,
    master_superintendents: () => [{ master_id: 'm1' }, { master_id: 'm2' }],
  }
}

let latest: WorkflowRoster
function Probe({ authUserId }: { authUserId: string | undefined }) {
  latest = useWorkflowRoster(authUserId)
  return <div data-testid="r">{`role:${latest.userRole ?? '-'} name:${latest.currentUserName ?? '-'} roster:${latest.roster.length}`}</div>
}

afterEach(() => {
  cleanup()
  queries.length = 0
})

describe('useWorkflowRoster', () => {
  it('reads nothing without a signed-in user', async () => {
    viewer('dev')
    await renderSettled(<Probe authUserId={undefined} />, { loaded: () => screen.findByTestId('r') })
    expect(screen.getByTestId('r').textContent).toBe('role:- name:- roster:0')
    expect(queries).toEqual([])
  })

  it('reads the viewer’s role and name, else their email', async () => {
    viewer('master_technician')
    renderWithProviders(<Probe authUserId="u1" />)
    await screen.findByText(/^role:master_technician name:Dana Dev/)
    cleanup()
    viewer('assistant', null, 'nameless@example.test')
    renderWithProviders(<Probe authUserId="u1" />)
    await screen.findByText(/^role:assistant name:nameless@example\.test/)
  })

  it('builds the picker from active accounts and the viewer’s roster people, sorted by name', async () => {
    viewer('dev')
    renderWithProviders(<Probe authUserId="u1" />)
    await screen.findByText(/roster:4$/)
    expect(latest.roster).toEqual([
      { name: 'Behar Plumbing', personId: 'pp1' },
      { name: 'Pat Office', personId: null },
      { name: 'Pat Office', personId: 'pp2' },
      { name: 'Sam Sub', personId: null },
    ])
    const people = queries.find((q) => q.table === 'people')!
    expect(people.steps).toContainEqual({ method: 'eq', args: ['master_user_id', 'u1'] })
    expect(people.steps).toContainEqual({ method: 'is', args: ['archived_at', null] })
  })

  it('keeps every readable account name for the ghost check, archived and twins included', async () => {
    viewer('dev')
    renderWithProviders(<Probe authUserId="u1" />)
    await screen.findByText(/roster:4$/)
    expect([...latest.userNames].sort()).toEqual(['old hand', 'pat office', 'robot estimator', 'sam sub'])
  })

  it('takes a roster person’s contact over an account of the same name', async () => {
    viewer('dev')
    renderWithProviders(<Probe authUserId="u1" />)
    await screen.findByText(/roster:4$/)
    expect(latest.personContacts['Pat Office']).toEqual({ email: 'pat.personal@example.test', phone: '555-0101' })
    expect(latest.personContacts['Sam Sub']).toEqual({ email: 'sam@example.test', phone: null })
    expect(latest.personContacts['Behar Plumbing']).toEqual({ email: 'behar@example.test', phone: '555-0100' })
  })

  it('names the subs: roster people of kind sub by id, and sub names from people and subcontractor accounts', async () => {
    viewer('dev')
    renderWithProviders(<Probe authUserId="u1" />)
    await screen.findByText(/roster:4$/)
    expect([...latest.subIdentity.ids]).toEqual(['pp1'])
    expect([...latest.subIdentity.namesLower].sort()).toEqual(['behar plumbing', 'sam sub'])
  })

  it('reads a superintendent’s roster through the masters that adopted them', async () => {
    viewer('superintendent')
    renderWithProviders(<Probe authUserId="u1" />)
    await screen.findByText(/^role:superintendent/)
    await screen.findByText(/roster:4$/)
    expect(queries.find((q) => q.table === 'master_superintendents')!.steps).toContainEqual({ method: 'eq', args: ['superintendent_id', 'u1'] })
    expect(queries.find((q) => q.table === 'people')!.steps).toContainEqual({ method: 'in', args: ['master_user_id', ['m1', 'm2']] })
  })

  it('a superintendent no master has adopted gets no roster people and no people read', async () => {
    viewer('superintendent')
    answers.master_superintendents = () => []
    renderWithProviders(<Probe authUserId="u1" />)
    await screen.findByText(/^role:superintendent.*roster:2$/)
    expect(queries.some((q) => q.table === 'people')).toBe(false)
  })
})
