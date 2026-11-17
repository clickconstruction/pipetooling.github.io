// @vitest-environment jsdom
/**
 * Checklist → Today, the day in parts (punch list #369, step A1): one head with the date and where the person stands,
 * a Next card with the page's Mark done, the rest of today under *Then*, what is done as a line each, and in Task Mode
 * one joined Today and History bar in place of the tab strip and the page's title.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { installDomShims, renderWithProviders, SMOKE_AUTH_USER_ID } from '../test/renderSmokeMocks'
import { taskModeStorageKey } from '../lib/taskModeToggle'

installDomShims()

type Row = Record<string, unknown>
const H = vi.hoisted(() => ({ today: [] as Record<string, unknown>[], older: [] as Record<string, unknown>[] }))

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'helpers' })
})
vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  /** Today's read asks for one date with `eq`; the older read asks with `lt`. Each gets its own rows. */
  const instances = (): Record<string, unknown> => {
    let older = false
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'gt', 'gte', 'lte', 'order', 'limit', 'in', 'not']) b[m] = () => b
    b.lt = () => {
      older = true
      return b
    }
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve({ data: older ? H.older : H.today, error: null }).then(ok, bad)
    return b
  }
  return {
    supabase: {
      ...stub,
      from: (table: string) =>
        table === 'users' ? { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { role: 'helpers' }, error: null }) }), in: () => Promise.resolve({ data: [{ id: 'u-imani', name: 'Imani' }], error: null }) }) } : table === 'checklist_instances' ? instances() : stub.from(),
    },
  }
})
vi.mock('../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))

const { default: Checklist } = await import('./Checklist')
const { ChecklistAddModalProvider, useChecklistAddModal } = await import('../contexts/ChecklistAddModalContext')

/** What the New task window was opened with, read off the page. The window itself is mounted by the app shell. */
function AddModalProbe() {
  const m = useChecklistAddModal()
  return <output data-probe-open={m?.isOpen ? '1' : '0'} data-probe-assignee={m?.initialAssigneeUserId ?? ''} data-probe-title={m?.initialPreset?.title ?? ''} data-probe-tell={m?.initialPreset?.tellUserId ?? ''} />
}

function row(id: string, title: string, over: Row = {}, item: Row = {}): Row {
  return {
    id,
    checklist_item_id: `item-${id}`,
    scheduled_date: '2026-11-16',
    completed_at: null,
    percent_complete: 0,
    notes: null,
    completed_by_user_id: null,
    created_at: '2026-11-16T12:00:00Z',
    reviewed_at: null,
    reviewed_by: null,
    checklist_items: { title, links: null, repeat_type: 'day_of_week', show_until_completed: false, notify_on_complete_user_id: null, notify_creator_on_complete: false, created_by_user_id: 'u-imani', ...item },
    ...over,
  }
}

beforeEach(() => {
  H.today = []
  H.older = []
  localStorage.clear()
})

describe('Checklist → Today, the day in parts', () => {
  it('reads the head, a Next card with the one Mark done press, Then, and Done today as a line', async () => {
    H.today = [
      row('a', 'Check the truck fluids'),
      row('b', 'Sweep the shop bays'),
      row('c', 'Match the payments to their bills', { completed_at: new Date().toISOString() }, { notify_on_complete_user_id: 'u-imani' }),
    ]
    renderWithProviders(<Checklist />)
    await screen.findByText('Check the truck fluids')
    expect(document.querySelector('[data-today-sentence]')?.textContent).toBe('1 of 3 done today.')
    expect(screen.getByText('Next')).toBeTruthy()
    expect(screen.getByText('Then · 1')).toBeTruthy()
    expect(screen.getByText('Done today · 1')).toBeTruthy()
    const lead = document.querySelector('[data-fresh-lead]')
    expect(lead?.textContent).toContain('Check the truck fluids')
    expect(document.querySelectorAll('[data-fresh-done-press]')).toHaveLength(1)
    expect(screen.queryByText('Waiting on review')).toBeNull()
    await waitFor(() => expect(document.querySelector('[data-fresh-done]')?.textContent).toMatch(/Imani hears it is done\.$/))
    // the full app keeps its tab strip and its title
    expect(screen.getByRole('heading', { name: 'Checklist' })).toBeTruthy()
    expect(document.querySelector('[data-task-day-bar]')).toBeNull()
  })

  it('with today finished, Next is the oldest task still open, and it leaves the list under it', async () => {
    H.today = [row('c', 'Match the payments to their bills', { completed_at: new Date().toISOString() })]
    H.older = [
      row('new', 'Label the pipe racks', { scheduled_date: '2026-11-10' }, { repeat_type: 'once', show_until_completed: true }),
      row('old', 'Give every carpentry tool a home', { scheduled_date: '2026-08-20' }, { repeat_type: 'once', show_until_completed: true }),
    ]
    renderWithProviders(<Checklist />)
    await screen.findByText('Give every carpentry tool a home')
    expect(document.querySelector('[data-today-sentence]')?.textContent).toBe('Your 1 task for today is done. 2 older tasks are still open.')
    expect(document.querySelector('[data-fresh-lead]')?.textContent).toContain('Give every carpentry tool a home')
    expect(screen.getAllByText('Give every carpentry tool a home')).toHaveLength(1)
    expect(screen.getByText('Label the pipe racks')).toBeTruthy()
  })

  it('Task Mode: one joined Today and History bar, and no tab strip or page title', async () => {
    localStorage.setItem(taskModeStorageKey(SMOKE_AUTH_USER_ID), '1')
    H.today = [row('a', 'Check the truck fluids')]
    renderWithProviders(<Checklist />)
    await screen.findByText('Check the truck fluids')
    const bar = document.querySelector('[data-task-day-bar]')
    expect(bar).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Checklist' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Today' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'History' }).getAttribute('aria-pressed')).toBe('true'))
    expect(document.querySelector('[data-task-day-bar]')).toBeTruthy()
    expect(document.querySelector('[data-today-head]')).toBeNull()
  })

  it('＋ Add a task for me opens New task for the person themself', async () => {
    H.today = [row('a', 'Check the truck fluids')]
    renderWithProviders(
      <ChecklistAddModalProvider>
        <Checklist />
        <AddModalProbe />
      </ChecklistAddModalProvider>,
    )
    await screen.findByText('Check the truck fluids')
    fireEvent.click(screen.getByRole('button', { name: '＋ Add a task for me' }))
    const probe = document.querySelector('[data-probe-open]') as HTMLElement
    expect(probe.getAttribute('data-probe-open')).toBe('1')
    expect(probe.getAttribute('data-probe-assignee')).toBe(SMOKE_AUTH_USER_ID)
    expect(probe.getAttribute('data-probe-title')).toBe('')
  })

  it('Follow-up sits on a done task alone, and opens New task on its words with the giver told', async () => {
    H.today = [row('a', 'Check the truck fluids'), row('c', 'Sweep the shop bays', { completed_at: new Date().toISOString() })]
    renderWithProviders(
      <ChecklistAddModalProvider>
        <Checklist />
        <AddModalProbe />
      </ChecklistAddModalProvider>,
    )
    await screen.findByText('Sweep the shop bays')
    const presses = screen.getAllByRole('button', { name: 'Follow-up' })
    expect(presses).toHaveLength(1)
    fireEvent.click(presses[0]!)
    const probe = document.querySelector('[data-probe-open]') as HTMLElement
    expect(probe.getAttribute('data-probe-open')).toBe('1')
    expect(probe.getAttribute('data-probe-title')).toBe('After Sweep the shop bays: ')
    expect(probe.getAttribute('data-probe-tell')).toBe('u-imani')
  })

  it('a one-time task wears ⋯ More on its card and in its open Still open row; a repeating task does not', async () => {
    const once = { repeat_type: 'once', show_until_completed: true }
    H.today = [row('a', 'Check the truck fluids'), row('b', 'Order the shelf brackets', {}, once)]
    H.older = [row('o1', 'Give every carpentry tool a home', { scheduled_date: '2026-08-20' }, once)]
    renderWithProviders(<Checklist />)
    await screen.findByText('Order the shelf brackets')
    // the repeating task is Next and has no More; the one-time task under Then has one
    expect(document.querySelector('[data-fresh-lead] [data-task-more]')).toBeNull()
    expect(document.querySelectorAll('[data-task-more]')).toHaveLength(1)
    fireEvent.click(document.querySelector('[data-still-open] [data-task-instance="o1"] button[aria-expanded]') as HTMLElement)
    await waitFor(() => expect(document.querySelector('[data-still-open-extras] [data-task-more]')).toBeTruthy())
    fireEvent.click(document.querySelector('[data-still-open-extras] [data-task-more]') as HTMLElement)
    expect(screen.getByRole('dialog', { name: 'More for this task' }).textContent).toContain('Give every carpentry tool a home')
    expect(screen.getByRole('button', { name: /Not today/ })).toBeTruthy()
  })
})
