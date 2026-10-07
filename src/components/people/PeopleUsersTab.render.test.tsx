// @vitest-environment jsdom
/**
 * Render smoke for the Users tab: it mounts, lists the accounts it is handed, and reads its
 * own row signals (v2.3912) — the active projects a name is assigned to arrive from the
 * tab's load, not from a prop.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { PeopleUsersTab } from './PeopleUsersTab'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { UsersTabTagsApi } from '../../hooks/useUsersTabTags'
import type { Person, UserRow } from '../../hooks/usePeopleRoster'

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

const DAY = 86_400_000
const USERS: UserRow[] = [
  { id: 'u1', email: 'alex@example.com', name: 'Alex Rivera', role: 'master_technician', notes: null, phone: null, last_sign_in_at: new Date(Date.now() - 12 * DAY).toISOString(), read_only: false },
  { id: 'u2', email: 'sam@example.com', name: 'Sam Lee', role: 'assistant', notes: null, phone: null, last_sign_in_at: new Date().toISOString(), read_only: false },
  { id: 'u3', email: 'kai@example.com', name: 'Kai Moss', role: 'helpers', notes: null, phone: null, last_sign_in_at: null, read_only: true, needs_supervision: true },
]

const TAGS = { showUsersTabTags: false, showUsersTabTagOrgSignals: false } as unknown as UsersTabTagsApi

/** A roster row with an email and no login: the one row the ⋯ menu offers Invite as user on. */
const ROSTER_ONLY: Person = { id: 'p1', master_user_id: 'u2', kind: 'helper', name: 'Rio Vance', email: 'rio@example.com', phone: null, notes: null, account_user_id: null }

function renderTab(extra: { setTrainingMode?: (userId: string, on: boolean) => void; isDev?: boolean; people?: Person[] } = {}) {
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
      {...extra}
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

  it('the Account lens reads each account\'s own sign-in and training mode', async () => {
    renderTab({ setTrainingMode: () => {} })
    fireEvent.click(await screen.findByRole('button', { name: 'Account' }))

    // Before v2.4336 the roster rows dropped both fields and every account read "never signed in".
    const alexRow = (await screen.findAllByText('Alex Rivera'))[0]!.closest('li')!
    expect(within(alexRow).getByText('12d ago')).toBeTruthy()
    const samRow = screen.getAllByText('Sam Lee')[0]!.closest('li')!
    expect(within(samRow).getByText('today')).toBeTruthy()
    const kaiRow = screen.getAllByText('Kai Moss')[0]!.closest('li')!
    expect(within(kaiRow).getByText('never')).toBeTruthy()
    expect((within(kaiRow).getByLabelText('Training mode (read-only): Kai Moss') as HTMLInputElement).checked).toBe(true)
    expect((within(alexRow).getByLabelText('Training mode (read-only): Alex Rivera') as HTMLInputElement).checked).toBe(false)

    // The Supervision column says it, so the row's own chip steps aside.
    expect(within(kaiRow).queryByText('needs supervision')).toBeNull()
    expect(within(kaiRow).getByText('needs')).toBeTruthy()
  })

  // v2.4877: `invite-user` refuses anyone but a dev, so the ⋯ menu offers Invite as user to a dev alone.
  it.each([
    ['a dev', true],
    ['a leader', false],
    ['an assistant', false],
    ['a controller', false],
  ])('a roster row with no login: %s %s offered Invite as user', async (_who, isDev) => {
    renderTab({ isDev, people: [ROSTER_ONLY] })
    fireEvent.click((await screen.findAllByRole('button', { name: 'Actions for Rio Vance' }))[0]!)
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByText('Edit')).toBeTruthy()
    expect(within(menu).queryByText('Invite as user') !== null).toBe(isDev)
  })
})
