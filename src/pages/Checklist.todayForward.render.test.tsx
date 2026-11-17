// @vitest-environment jsdom
/**
 * Checklist → Today, the office's Forward (v2.7587): the card's Forward press opens the one Forward window, the
 * one My Inbox draws. Nobody is picked for the office, the press is dead until a name is picked, and a refusal
 * stays in the window in the database's words.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { installDomShims, renderWithProviders, SMOKE_AUTH_USER_ID } from '../test/renderSmokeMocks'

installDomShims()

const H = vi.hoisted(() => ({
  today: [] as Record<string, unknown>[],
  rpcs: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  refuse: null as string | null,
}))

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../lib/people/fetchActiveUsers', async (orig) => {
  const { SMOKE_AUTH_USER_ID: me } = await import('../test/renderSmokeMocks')
  return {
    ...(await orig<typeof import('../lib/people/fetchActiveUsers')>()),
    activeUsersQuery: () =>
      Promise.resolve({
        data: [
          { id: me, name: 'Office Me', email: '' },
          { id: 'u-dana', name: 'Dana', email: '' },
          { id: 'u-abe', name: 'Abe', email: '' },
        ],
        error: null,
      }),
  }
})
vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  /** Today's read asks for one date with `eq`; the older read asks with `lt` and gets nothing. */
  const instances = (): Record<string, unknown> => {
    let older = false
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'gt', 'gte', 'lte', 'order', 'limit', 'in', 'not']) b[m] = () => b
    b.lt = () => {
      older = true
      return b
    }
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve({ data: older ? [] : H.today, error: null }).then(ok, bad)
    return b
  }
  return {
    supabase: {
      ...stub,
      from: (table: string) =>
        // the page reads the role off the users row
        table === 'users' ? { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { role: 'assistant' }, error: null }) }), in: () => Promise.resolve({ data: [], error: null }) }) } : table === 'checklist_instances' ? instances() : stub.from(),
      rpc: (fn: string, args: Record<string, unknown>) => {
        if (fn !== 'task_hand_on') return stub.rpc()
        H.rpcs.push({ fn, args })
        return Promise.resolve({ data: null, error: H.refuse ? { message: H.refuse, details: '', hint: '', code: 'P0001' } : null })
      },
    },
  }
})
vi.mock('../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))

const { default: Checklist } = await import('./Checklist')

beforeEach(() => {
  H.rpcs = []
  H.refuse = null
  localStorage.clear()
  H.today = [
    {
      id: 'inst-a',
      checklist_item_id: 'item-a',
      scheduled_date: '2026-11-16',
      completed_at: null,
      percent_complete: 0,
      notes: null,
      completed_by_user_id: null,
      created_at: '2026-11-16T12:00:00Z',
      reviewed_at: null,
      reviewed_by: null,
      checklist_items: { title: 'Check the truck fluids', links: null, repeat_type: 'once', show_until_completed: false, notify_on_complete_user_id: null, notify_creator_on_complete: false, created_by_user_id: SMOKE_AUTH_USER_ID },
    },
  ]
})

async function openForward(): Promise<HTMLElement> {
  // Opened on Today by its address. With no tab named, the office is sent to Review once its role is read, and a
  // press on Today could land before that redirect and lose to it (the first case timed out in a queue build).
  renderWithProviders(<Checklist />, { route: '/checklist?tab=today' })
  await screen.findByText('Check the truck fluids')
  fireEvent.click(await screen.findByRole('button', { name: 'Forward' }))
  return screen.findByRole('dialog', { name: 'Forward task' })
}

describe('Checklist → Today, the office’s Forward', () => {
  it('opens the one Forward window: the task’s words, nobody picked, a dead press, and no line of required fields', async () => {
    const win = await openForward()
    expect(win.querySelector('[data-fwd-title]')?.textContent).toBe('Check the truck fluids')
    const pick = within(win).getByLabelText('Assign to') as HTMLSelectElement
    expect(pick.value).toBe('')
    // the people by name, without the one forwarding
    expect(Array.from(pick.options).map((o) => o.textContent)).toEqual(['Pick a person', 'Abe', 'Dana'])
    expect((within(win).getByRole('button', { name: 'Forward' }) as HTMLButtonElement).disabled).toBe(true)
    expect(win.textContent).not.toMatch(/Required/)
    expect(H.rpcs).toHaveLength(0)
  })

  it('a picked name is on the press, and the press hands on the same task to that person', async () => {
    const win = await openForward()
    fireEvent.change(within(win).getByLabelText('Assign to'), { target: { value: 'u-dana' } })
    fireEvent.click(within(win).getByRole('button', { name: 'Forward to Dana' }))
    await waitFor(() => expect(H.rpcs).toHaveLength(1))
    expect(H.rpcs[0]?.args).toMatchObject({ p_instance_id: 'inst-a', p_to: 'u-dana', p_from: null })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Forward task' })).toBeNull())
  })

  it('a refusal stays in the window in its own words, and the window stays open', async () => {
    H.refuse = 'A roadmap task is not handed on.'
    const win = await openForward()
    fireEvent.change(within(win).getByLabelText('Assign to'), { target: { value: 'u-abe' } })
    fireEvent.click(within(win).getByRole('button', { name: 'Forward to Abe' }))
    expect((await within(win).findByRole('alert')).textContent).toContain('A roadmap task is not handed on.')
    expect(screen.getByRole('dialog', { name: 'Forward task' })).toBeTruthy()
  })
})
