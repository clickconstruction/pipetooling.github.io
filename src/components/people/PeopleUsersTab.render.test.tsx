// @vitest-environment jsdom
/**
 * Render smoke for the Users tab: it mounts, lists the accounts it is handed, and reads its
 * own row signals (v2.3912) — the active projects a name is assigned to arrive from the
 * tab's load, not from a prop.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { PeopleUsersTab } from './PeopleUsersTab'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { UsersTabTagsApi } from '../../hooks/useUsersTabTags'
import type { UserRow } from '../../hooks/usePeopleRoster'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const TABLE_ROWS: Record<string, unknown[]> = {
  users: [{ role: 'dev' }],
  project_workflow_steps: [
    { workflow_id: 'w1', assigned_to_name: 'Alex Rivera' },
    { workflow_id: 'w1', assigned_to_name: 'Alex Rivera' },
  ],
  project_workflows: [{ id: 'w1', project_id: 'p1' }],
  projects: [{ id: 'p1', name: 'Oak Ridge Rough-in' }],
  push_subscriptions: [{ user_id: 'u1' }],
  person_contract_documents: [],
}

vi.mock('../../lib/supabase', () => {
  function makeBuilder(rows: unknown[]): Record<string, unknown> {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'in', 'order', 'range', 'limit', 'or', 'lt', 'lte', 'gt', 'gte', 'is', 'not', 'filter', 'match']) {
      builder[m] = () => builder
    }
    builder.single = () => Promise.resolve({ data: rows[0] ?? null, error: null })
    builder.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null })
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null, count: rows.length }).then(onFulfilled, onRejected)
    return builder
  }
  return {
    supabase: {
      from: (table: string) => makeBuilder(TABLE_ROWS[table] ?? []),
      rpc: () => Promise.resolve({ data: [], error: null }),
      auth: { getSession: () => Promise.resolve({ data: { session: null }, error: null }) },
      functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    },
  }
})

const USERS: UserRow[] = [
  { id: 'u1', email: 'alex@example.com', name: 'Alex Rivera', role: 'master_technician', notes: null, phone: null },
  { id: 'u2', email: 'sam@example.com', name: 'Sam Lee', role: 'assistant', notes: null, phone: null },
]

const TAGS = { showUsersTabTags: false, showUsersTabTagOrgSignals: false } as unknown as UsersTabTagsApi

function renderTab() {
  return renderWithProviders(
    <PeopleUsersTab
      isDev={false}
      narrowViewport={false}
      users={USERS}
      people={[]}
      error={null}
      setError={() => {}}
      canAccessContracts
      canSeePushStatus
      canEditUserNotes
      canCreatePeopleInRoster
      authUserId="u2"
      creatorNames={{}}
      archivedPeople={[]}
      usersTabTags={TAGS}
      showToast={() => {}}
      setEditingUserNote={() => {}}
      openAdd={() => {}}
      openEdit={() => {}}
      linkPersonToAccount={() => Promise.resolve(true)}
      archivePerson={() => {}}
      archivingId={null}
      restorePerson={() => {}}
      restoringId={null}
      isAlreadyUser={() => false}
      invitingId={null}
      setInviteConfirm={() => {}}
    />,
  )
}

describe('PeopleUsersTab', () => {
  it('lists the accounts and the active projects its own load finds', async () => {
    renderTab()

    // Produced by the tab's load: two steps on one workflow name the project once, under Alex only.
    const links = await screen.findAllByText('Oak Ridge Rough-in')
    expect(links).toHaveLength(1)
    expect(links[0]?.closest('a')?.getAttribute('href')).toBe('/workflows/p1')

    expect(screen.getAllByText('Alex Rivera').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sam Lee').length).toBeGreaterThan(0)
  })
})
