// @vitest-environment jsdom
/**
 * My Inbox's Forward (v2.7563): the card's own wiring. A press on a task's Forward opens the one Forward window,
 * and the window's press hands on the same task through `task_hand_on`. The card writes nothing itself: until
 * v2.7563 it made a copy for the other person and deleted the first day row, which lost the thread, the place, the
 * lines and the photos. A refusal stays in the window in the database's words.
 *
 * The card draws in four places (the Dashboard, Job Mode, Dispatch Mode and Quickfill). All four mount this one
 * component, so one test of the card covers them.
 */
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { installDomShims, renderWithProviders, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import type { ChecklistInstance } from '../../lib/dashboardBootTypes'

installDomShims()

const H = vi.hoisted(() => ({
  /** The viewer's day rows for today, as the Dashboard's boot seeds them and as the card reads them again. */
  today: [] as Record<string, unknown>[],
  /** The viewer's open one-time rows, which the card reads itself for Overdue. */
  overdue: [] as Record<string, unknown>[],
  rpcs: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  /** Every insert, update, upsert and delete the card sends to a table. */
  writes: [] as Array<{ table: string; op: string }>,
  pushes: [] as Array<{ fn: string; body: Record<string, unknown> }>,
  refuse: null as string | null,
}))

/** What Forward sent before v2.7563, by name: the copy, its people, and the delete of the first day row. */
const OLD_FORWARD_WRITES = [
  'checklist_items.insert',
  'checklist_item_assignees.insert',
  'checklist_instances.insert',
  'checklist_instance_assignees.insert',
  'checklist_instances.delete',
]
const oldForwardWrites = () => H.writes.map((w) => `${w.table}.${w.op}`).filter((w) => OLD_FORWARD_WRITES.includes(w))

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../../lib/people/fetchActiveUsers', async (orig) => {
  const { SMOKE_AUTH_USER_ID: me } = await import('../../test/renderSmokeMocks')
  return {
    ...(await orig<typeof import('../../lib/people/fetchActiveUsers')>()),
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
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  /** The shared stub's builder, with every write counted and the day rows answered from `H`. */
  const from = (table: string): Record<string, unknown> => {
    const b = stub.from()
    for (const op of ['insert', 'update', 'upsert', 'delete']) {
      b[op] = () => {
        H.writes.push({ table, op })
        return b
      }
    }
    if (table !== 'checklist_instances') return b
    // Three reads of the day rows: the open ones ask with `is`, today's with neither, and the two that get
    // nothing here are the older days (`lt`) and Recently completed (`not`).
    const asked = new Set<string>()
    for (const m of ['is', 'lt', 'not']) {
      b[m] = () => {
        asked.add(m)
        return b
      }
    }
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) =>
      Promise.resolve({ data: asked.has('lt') || asked.has('not') ? [] : asked.has('is') ? H.overdue : H.today, error: null }).then(ok, bad)
    return b
  }
  return {
    supabase: {
      ...stub,
      from,
      rpc: (fn: string, args: Record<string, unknown>) => {
        if (fn !== 'task_hand_on') return stub.rpc()
        H.rpcs.push({ fn, args })
        if (H.refuse) return Promise.resolve({ data: null, error: { message: H.refuse, details: '', hint: '', code: 'P0001' } })
        // The task is the taker's now, so the viewer's next reads come back without it.
        H.today = []
        H.overdue = []
        return Promise.resolve({ data: null, error: null })
      },
      functions: {
        invoke: (fn: string, opts: { body: Record<string, unknown> }) => {
          H.pushes.push({ fn, body: opts.body })
          return Promise.resolve({ data: null, error: null })
        },
      },
    },
  }
})

const { DashboardMyInboxCard } = await import('./DashboardMyInboxCard')

const TASK = 'Call the inspector about the rough-in'
const dayRow = (): Record<string, unknown> => ({
  id: 'inst-a',
  checklist_item_id: 'item-a',
  scheduled_date: '2026-11-19',
  completed_at: null,
  percent_complete: 0,
  notes: null,
  completed_by_user_id: null,
  created_at: '2026-11-19T12:00:00Z',
  reviewed_at: null,
  checklist_items: { title: TASK, links: null, repeat_type: 'once', notify_on_complete_user_id: null, notify_creator_on_complete: false, created_by_user_id: 'u-abe' },
  checklist_instance_assignees: [{ user_id: SMOKE_AUTH_USER_ID }],
})

const noop = () => {}

/** The card as the Dashboard mounts it: the parent holds today's rows and hands the card their setter. */
function Inbox() {
  const [today, setToday] = useState<ChecklistInstance[]>(H.today as unknown as ChecklistInstance[])
  return (
    <DashboardMyInboxCard
      authUserId={SMOKE_AUTH_USER_ID}
      role="assistant"
      isMobile={false}
      todayChecklist={today}
      setTodayChecklist={setToday}
      checklistLoading={false}
      userLoading={false}
      setUserError={noop}
      getCurrentUserName={() => Promise.resolve('Office Me')}
      onVisibleChange={noop}
    />
  )
}

beforeEach(() => {
  H.today = []
  H.overdue = []
  H.rpcs = []
  H.writes = []
  H.pushes = []
  H.refuse = null
  localStorage.clear()
})

/** Draws the card, waits for the task and for the people the window offers, then presses the task's Forward. */
async function openForward(press: string): Promise<HTMLElement> {
  renderWithProviders(<Inbox />)
  await screen.findByText(TASK)
  fireEvent.click(await screen.findByRole('button', { name: press }))
  const win = await screen.findByRole('dialog', { name: 'Forward task' })
  await within(win).findByRole('option', { name: 'Dana' })
  return win
}

describe('My Inbox’s Forward', () => {
  it('hands on the same task to the picked person, and writes no copy and no delete', async () => {
    H.today = [dayRow()]
    const win = await openForward('fwd')
    expect(win.querySelector('[data-fwd-title]')?.textContent).toBe(TASK)
    fireEvent.change(within(win).getByLabelText('Assign to'), { target: { value: 'u-dana' } })
    fireEvent.click(within(win).getByRole('button', { name: 'Forward to Dana' }))

    await waitFor(() => expect(H.rpcs).toHaveLength(1))
    expect(H.rpcs[0]).toEqual({ fn: 'task_hand_on', args: { p_instance_id: 'inst-a', p_to: 'u-dana', p_reason: null, p_from: null } })
    // The window closes, and the card reads its lists again: the task is no longer the viewer's.
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Forward task' })).toBeNull())
    await waitFor(() => expect(screen.queryByText(TASK)).toBeNull())
    // Whoever takes it is told, once.
    await waitFor(() => expect(H.pushes).toHaveLength(1))
    expect(H.pushes[0]).toMatchObject({ fn: 'send-checklist-notification', body: { recipient_user_id: 'u-dana', tag: 'checklist-inst-a' } })

    expect(oldForwardWrites()).toEqual([])
    // Nothing else either: the hand-on is the one thing Forward sends.
    expect(H.writes).toEqual([])
    expect(H.rpcs).toHaveLength(1)
  })

  it('hands on from Overdue too, through the same press', async () => {
    H.overdue = [{ ...dayRow(), scheduled_date: '2026-11-12' }]
    const win = await openForward('Forward')
    fireEvent.change(within(win).getByLabelText('Assign to'), { target: { value: 'u-abe' } })
    fireEvent.click(within(win).getByRole('button', { name: 'Forward to Abe' }))

    await waitFor(() => expect(H.rpcs).toHaveLength(1))
    expect(H.rpcs[0]?.args).toEqual({ p_instance_id: 'inst-a', p_to: 'u-abe', p_reason: null, p_from: null })
    await waitFor(() => expect(screen.queryByText(TASK)).toBeNull())
    expect(oldForwardWrites()).toEqual([])
    expect(H.writes).toEqual([])
  })

  it('a refusal stays in the window in its own words, the window stays open, and nothing else is sent', async () => {
    H.today = [dayRow()]
    H.refuse = 'A roadmap task is not handed on.'
    const win = await openForward('fwd')
    fireEvent.change(within(win).getByLabelText('Assign to'), { target: { value: 'u-dana' } })
    fireEvent.click(within(win).getByRole('button', { name: 'Forward to Dana' }))

    expect((await within(win).findByRole('alert')).textContent).toContain('A roadmap task is not handed on.')
    expect(screen.getByRole('dialog', { name: 'Forward task' })).toBeTruthy()
    // The press is live again with the name still on it, and the task is still the viewer's.
    await waitFor(() => expect((within(win).getByRole('button', { name: 'Forward to Dana' }) as HTMLButtonElement).disabled).toBe(false))
    expect(within(document.getElementById('dash-my-inbox') as HTMLElement).getByText(TASK)).toBeTruthy()
    expect(H.rpcs).toHaveLength(1)
    expect(H.writes).toEqual([])
    expect(H.pushes).toEqual([])
  })
})
