// @vitest-environment jsdom
/**
 * Checklist → Today, the day in parts (punch list #369, step A1): one head with the date and where the person stands,
 * a Next card with the page's Mark done, the rest of today under *Then*, what is done as a line each, and in Task Mode
 * one joined Today and History bar in place of the tab strip and the page's title.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { installDomShims, renderWithProviders, SMOKE_AUTH_USER_ID } from '../test/renderSmokeMocks'
import { taskModeStorageKey } from '../lib/taskModeToggle'

installDomShims()

type Row = Record<string, unknown>
const H = vi.hoisted(() => ({
  today: [] as Record<string, unknown>[],
  older: [] as Record<string, unknown>[],
  updates: [] as Array<{ id: string; patch: Record<string, unknown> }>,
  refuseIds: [] as string[],
  /** What the names function answers. It answers any signed-in person, for a person who has left too. */
  names: [
    { id: 'u-imani', name: 'Imani', role: 'dev', archived: false },
    { id: 'u-gone', name: 'Dana', role: 'master_technician', archived: true },
  ],
  nameAsks: [] as string[][],
}))

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
    // a tick's save: counted, and refused for the ids a test names
    b.update = (patch: Record<string, unknown>) => ({
      eq: (_col: string, id: string) => {
        H.updates.push({ id, patch })
        return Promise.resolve({ error: H.refuseIds.includes(id) ? { message: 'refused', details: '', hint: '', code: '42501' } : null })
      },
    })
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
        // The people table gives a helper no row for a dev, nor for a master who has not adopted them: its read of names
        // answers nothing here, so a name on the page came through the names function.
        table === 'users' ? { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { role: 'helpers' }, error: null }) }), in: () => Promise.resolve({ data: [], error: null }) }) } : table === 'checklist_instances' ? instances() : stub.from(),
      rpc: (fn: string, args: { p_user_ids?: string[] }) => {
        if (fn !== 'get_user_display_names') return stub.rpc()
        const ids = args.p_user_ids ?? []
        H.nameAsks.push(ids)
        return Promise.resolve({ data: H.names.filter((n) => ids.includes(n.id)), error: null })
      },
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
  H.updates = []
  H.refuseIds = []
  H.nameAsks = []
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

  it('a helper given a task by a dev with Tell me lit reads who hears, before the start and on the done line', async () => {
    H.today = [
      row('a', 'Check the truck fluids', {}, { notify_creator_on_complete: true }),
      row('c', 'Match the payments to their bills', { completed_at: new Date().toISOString() }, { notify_creator_on_complete: true }),
    ]
    renderWithProviders(<Checklist />)
    await screen.findByText('Check the truck fluids')
    await waitFor(() => expect(document.querySelector('[data-fresh-before]')?.textContent).toBe('Imani hears when it is done.'))
    expect(document.querySelector('[data-fresh-done]')?.textContent).toMatch(/^Done .+\. Imani hears it is done\.$/)
    // the names were asked of the names function
    expect(H.nameAsks.flat()).toContain('u-imani')
  })

  it('a task with Tell me off reads no line about who hears', async () => {
    H.today = [row('a', 'Check the truck fluids'), row('c', 'Match the payments to their bills', { completed_at: new Date().toISOString() })]
    renderWithProviders(<Checklist />)
    await screen.findByText('Check the truck fluids')
    // the giver's name is read for the tools' sheets, and still no line says they hear
    await waitFor(() => expect(H.nameAsks.flat()).toContain('u-imani'))
    await waitFor(() => expect(document.querySelector('[data-fresh-done]')?.textContent).toMatch(/^Done [^.]+\.$/))
    expect(document.querySelector('[data-fresh-before]')).toBeNull()
    expect(document.body.textContent).not.toContain('hears')
  })

  it('a giver who has left is not named as hearing', async () => {
    H.today = [
      row('a', 'Check the truck fluids', {}, { notify_creator_on_complete: true, created_by_user_id: 'u-gone' }),
      row('c', 'Match the payments to their bills', { completed_at: new Date().toISOString() }, { notify_on_complete_user_id: 'u-gone' }),
    ]
    renderWithProviders(<Checklist />)
    await screen.findByText('Check the truck fluids')
    await waitFor(() => expect(H.nameAsks.flat()).toContain('u-gone'))
    await waitFor(() => expect(document.querySelector('[data-fresh-done]')?.textContent).toMatch(/^Done [^.]+\.$/))
    expect(document.querySelector('[data-fresh-before]')).toBeNull()
    expect(document.body.textContent).not.toContain('Dana')
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

  it('an open task wears ⋯ More on its card, and a one-time task in its open Still open row offers Not today', async () => {
    const once = { repeat_type: 'once', show_until_completed: true }
    H.today = [row('a', 'Check the truck fluids'), row('b', 'Order the shelf brackets', {}, once)]
    H.older = [row('o1', 'Give every carpentry tool a home', { scheduled_date: '2026-08-20' }, once)]
    renderWithProviders(<Checklist />)
    await screen.findByText('Order the shelf brackets')
    // every open task has More: the repeating one for Can't do it, the one-time one for the rest too
    expect(document.querySelector('[data-fresh-lead] [data-task-more]')).toBeTruthy()
    expect(document.querySelectorAll('[data-task-more]')).toHaveLength(2)
    fireEvent.click(document.querySelector('[data-still-open] [data-task-instance="o1"] button[aria-expanded]') as HTMLElement)
    await waitFor(() => expect(document.querySelector('[data-still-open-extras] [data-task-more]')).toBeTruthy())
    fireEvent.click(document.querySelector('[data-still-open-extras] [data-task-more]') as HTMLElement)
    expect(screen.getByRole('dialog', { name: 'More for this task' }).textContent).toContain('Give every carpentry tool a home')
    expect(screen.getByRole('button', { name: /Not today/ })).toBeTruthy()
  })

  it('Do first lifts a task into Next on this device, says so, and Stop doing it first gives Next back', async () => {
    H.today = [row('a', 'Check the truck fluids'), row('b', 'Sweep the shop bays')]
    renderWithProviders(<Checklist />)
    await screen.findByText('Sweep the shop bays')
    expect(document.querySelector('[data-fresh-lead]')?.textContent).toContain('Check the truck fluids')
    // the task that is Next already is not offered Do first; the other is
    fireEvent.click(document.querySelector('[data-task-instance="b"] [data-task-more]') as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /Do first/ }))
    await waitFor(() => expect(document.querySelector('[data-fresh-lead]')?.textContent).toContain('Sweep the shop bays'))
    expect(document.querySelector('[data-do-first-mark]')?.textContent).toBe('You picked this to do first.')
    expect(localStorage.getItem(`task_do_first_${SMOKE_AUTH_USER_ID}`)).toBe('b')
    fireEvent.click(document.querySelector('[data-fresh-lead] [data-task-more]') as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /Stop doing it first/ }))
    await waitFor(() => expect(document.querySelector('[data-fresh-lead]')?.textContent).toContain('Check the truck fluids'))
    expect(document.querySelector('[data-do-first-mark]')).toBeNull()
  })

  it('Mark N done: a round of repeating tasks is one press behind a window that names the act, and it keeps going past one that fails', async () => {
    H.today = [row('a', 'Feed the chickens'), row('b', 'Check the truck fluids'), row('c', 'Sweep the shop bays'), row('d', 'Order the shelf brackets', {}, { repeat_type: 'once', show_until_completed: true })]
    H.refuseIds = ['b']
    renderWithProviders(<Checklist />)
    await screen.findByText('Feed the chickens')
    // three repeating tasks make the round; the one-time task has its own steps and is said to be left out
    const press = screen.getByRole('button', { name: 'Mark 3 done' })
    expect(document.querySelector('[data-mark-round]')?.textContent).toContain('1 more task has its own steps. Finish it from its card.')
    fireEvent.click(press)
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toContain('Mark these 3 tasks done? Each finishes as if you had ticked it.')
    expect(H.updates).toHaveLength(0)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mark 3 done' }))
    await waitFor(() => expect(H.updates.map((u) => u.id)).toEqual(['a', 'b', 'c']))
    await screen.findByText('Marked 2 tasks done. 1 did not mark.')
  })

  it('Mark N done is not offered for one repeating task, or for one-time tasks alone', async () => {
    const once = { repeat_type: 'once', show_until_completed: true }
    H.today = [row('a', 'Feed the chickens'), row('d', 'Order the shelf brackets', {}, once), row('e', 'Label the pipe racks', {}, once)]
    renderWithProviders(<Checklist />)
    await screen.findByText('Feed the chickens')
    expect(document.querySelector('[data-mark-round]')).toBeNull()
  })

  describe('Yesterday', () => {
    const ymd = (daysBack: number) => {
      const d = new Date()
      d.setDate(d.getDate() - daysBack)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    it('a repeating task that went unticked yesterday asks once: Did it finishes that day, Skipped takes it off the question', async () => {
      H.today = [row('a', 'Check the truck fluids')]
      H.older = [row('y1', 'Feed the chickens', { scheduled_date: ymd(1) }), row('y2', 'Sweep the shop bays', { scheduled_date: ymd(1) }), row('old', 'Water the garden', { scheduled_date: ymd(9) })]
      renderWithProviders(<Checklist />)
      await screen.findByText('Feed the chickens')
      const strip = document.querySelector('[data-yesterday]') as HTMLElement
      expect(within(strip).getByRole('heading', { name: 'Yesterday · 2 not ticked' })).toBeTruthy()
      expect(strip.textContent).toContain('Did you do it?')
      // a day nine days back is past the question's reach, and a repeating miss never joins Still open
      expect(screen.queryByText('Water the garden')).toBeNull()
      expect(document.querySelector('[data-still-open]')).toBeNull()
      // Skipped writes its line and the row leaves
      fireEvent.click(within(document.querySelector('[data-yesterday-row="y2"]') as HTMLElement).getByRole('button', { name: 'Skipped' }))
      await waitFor(() => expect(document.querySelector('[data-yesterday-row="y2"]')).toBeNull())
      expect(within(document.querySelector('[data-yesterday]') as HTMLElement).getByRole('heading', { name: 'Yesterday · 1 not ticked' })).toBeTruthy()
      // Did it finishes that day's row by the tick's own save
      H.older = []
      fireEvent.click(within(document.querySelector('[data-yesterday-row="y1"]') as HTMLElement).getByRole('button', { name: 'Did it' }))
      await waitFor(() => expect(H.updates.map((u) => u.id)).toEqual(['y1']))
      await waitFor(() => expect(document.querySelector('[data-yesterday]')).toBeNull())
    })

    it('with nothing unticked in reach, nothing is asked', async () => {
      H.today = [row('a', 'Check the truck fluids')]
      H.older = [row('old', 'Water the garden', { scheduled_date: ymd(9) })]
      renderWithProviders(<Checklist />)
      await screen.findByText('Check the truck fluids')
      expect(document.querySelector('[data-yesterday]')).toBeNull()
    })
  })
})
