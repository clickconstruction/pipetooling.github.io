// @vitest-environment jsdom
/**
 * See a person's Task Mode (punch list #381): on Checklist → Review, the owner opens a person's card and a press opens
 * a window that draws that person's Today. The day is read for that person, never for whoever is signed in, and no
 * press inside the window writes anything.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { installDomShims, renderWithProviders, SMOKE_AUTH_USER_ID } from '../test/renderSmokeMocks'
import { localCalendarDayKey } from '../utils/dateUtils'

installDomShims()

type Row = Record<string, unknown>
const H = vi.hoisted(() => ({
  role: 'master_technician',
  board: [] as Record<string, unknown>[],
  today: [] as Record<string, unknown>[],
  older: [] as Record<string, unknown>[],
  /** The person's tasks dated ahead, which Coming up reads. */
  ahead: [] as Record<string, unknown>[],
  /** The person each of the day's reads named. */
  dayReadsFor: [] as string[],
  /** Every write of any kind, as `table.method`. */
  writes: [] as string[],
  /** The person the look draws, as the look's read of `users` answers. */
  person: { role: 'helpers', email: null, login_attached_at: null } as { role: string; email: string | null; login_attached_at: string | null },
  /** Every sign-in as someone that was asked for, by email. */
  signIns: [] as string[],
}))

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'master_technician' })
})
vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  const WRITES = ['insert', 'update', 'upsert', 'delete']
  /** `task_note_taggable` lists who may be tagged at a card's note box. It is a read: STABLE, and it changes nothing. */
  const READ_FUNCTIONS = ['task_note_taggable']
  /** Any table: reads answer empty, and a write is counted. */
  const plain = (table: string): Record<string, unknown> => {
    const b = stub.from() as Record<string, unknown>
    for (const m of WRITES) b[m] = () => (H.writes.push(`${table}.${m}`), b)
    return b
  }
  /** The day rows: Review's board reads them with no person, and a day's read names its person. */
  const instances = (): Record<string, unknown> => {
    let person: string | null = null
    let older = false
    let ahead = false
    let count = false
    const b: Record<string, unknown> = {}
    for (const m of ['is', 'gte', 'lte', 'order', 'limit', 'in', 'not']) b[m] = () => b
    b.gt = () => ((ahead = true), b)
    for (const m of WRITES) b[m] = () => (H.writes.push(`checklist_instances.${m}`), b)
    b.select = (cols: string) => ((count = cols === 'scheduled_date'), b)
    b.eq = (col: string, val: string) => {
      if (col === 'checklist_instance_assignees.user_id') {
        person = val
        H.dayReadsFor.push(val)
      }
      return b
    }
    b.lt = () => ((older = true), b)
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) =>
      Promise.resolve(count ? { data: [], count: 0, error: null } : person ? { data: ahead ? H.ahead : older ? H.older : H.today, error: null } : { data: H.board, error: null }).then(ok, bad)
    return b
  }
  const users = (): Record<string, unknown> => {
    const b = stub.from() as Record<string, unknown>
    // The page reads the signed-in person's role, and the look reads the role of the person it draws.
    b.single = () => Promise.resolve({ data: { role: H.role }, error: null })
    b.maybeSingle = () => Promise.resolve({ data: H.person, error: null })
    return b
  }
  return {
    supabase: {
      ...stub,
      from: (table: string) => (table === 'checklist_instances' ? instances() : table === 'users' ? users() : plain(table)),
      // A database function is counted as a write unless it is one of the reads an opened card makes.
      rpc: (name: string) => (READ_FUNCTIONS.includes(name) ? null : H.writes.push(`rpc.${name}`), stub.rpc()),
      functions: { invoke: (name: string) => (H.writes.push(`function.${name}`), Promise.resolve({ data: null, error: null })) },
    },
  }
})
vi.mock('../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))
vi.mock('../lib/loginAsUser', () => ({ loginAsUser: (u: { email: string | null }) => (H.signIns.push(u.email ?? ''), Promise.resolve()) }))

const { default: Checklist } = await import('./Checklist')
const { ChecklistAddModalProvider, useChecklistAddModal } = await import('../contexts/ChecklistAddModalContext')
const { ymdAddDays } = await import('../utils/dateUtils')

/** Who the New task window was opened for, read off the page. The window itself is mounted by the app shell. */
function AddModalProbe() {
  const m = useChecklistAddModal()
  return <output data-probe-open={m?.isOpen ? '1' : '0'} data-probe-assignee={m?.initialAssigneeUserId ?? ''} />
}

const TODAY = localCalendarDayKey(new Date())

function dayRow(id: string, title: string, over: Row = {}, item: Row = {}): Row {
  return {
    id,
    checklist_item_id: `item-${id}`,
    scheduled_date: TODAY,
    completed_at: null,
    percent_complete: 0,
    notes: null,
    completed_by_user_id: null,
    created_at: `${TODAY}T12:00:00Z`,
    reviewed_at: null,
    reviewed_by: null,
    checklist_items: { title, links: null, repeat_type: 'day_of_week', show_until_completed: false, notify_on_complete_user_id: null, notify_creator_on_complete: false, created_by_user_id: 'u-office', ...item },
    ...over,
  }
}

/** One open one-off on Review's board, for a made-up person. */
function boardRow(id: string, title: string, userId: string, name: string): Row {
  return {
    id,
    checklist_item_id: `item-${id}`,
    scheduled_date: '2026-10-28',
    checklist_items: { title, links: null, repeat_type: 'once', reminder_scope: null, created_at: null, created_by_user_id: 'u-office', roadmap_group_task_id: null },
    checklist_instance_assignees: [{ user_id: userId, users: { name, email: null } }],
  }
}

async function openDanasCard() {
  renderWithProviders(<Checklist />, { route: '/checklist?tab=review' })
  fireEvent.click(await screen.findByText('Dana Whitlow'))
}

beforeEach(() => {
  H.role = 'master_technician'
  H.board = [boardRow('b1', 'Return the borrowed pipe threader', 'u-dana', 'Dana Whitlow')]
  H.today = [dayRow('a', 'Restock van 4 with fittings'), dayRow('b', 'Check the shop compressor oil')]
  H.older = [dayRow('old', 'Return the borrowed pipe threader', { scheduled_date: '2026-10-28' }, { repeat_type: 'once' })]
  H.ahead = []
  H.dayReadsFor = []
  H.writes = []
  H.person = { role: 'helpers', email: null, login_attached_at: null }
  H.signIns = []
  localStorage.clear()
})

describe('Checklist → Review, see a person’s Task Mode', () => {
  it('opens a window on that person’s day, read for them and not for the viewer', async () => {
    await openDanasCard()
    fireEvent.click(await screen.findByRole('button', { name: 'See Dana’s Task Mode' }))
    const win = await screen.findByRole('dialog', { name: 'Dana Whitlow’s Task Mode' })
    await within(win).findByText('Restock van 4 with fittings')
    expect(win.querySelector('[data-look-line]')?.textContent).toBe('A look. This is what Dana’s phone shows. No press here works, and nothing changes for Dana.')
    expect(win.querySelector('[data-today-sentence]')?.textContent).toBe('0 of 2 done today. 1 older task is still open.')
    expect(win.querySelector('[data-fresh-lead]')?.textContent).toContain('Restock van 4 with fittings')
    expect(within(win).getByText('Then · 1')).toBeTruthy()
    // their phone's own chrome, drawn and dead
    expect(within(win).getByText('Task Mode')).toBeTruthy()
    expect(win.querySelector('[data-task-day-bar]')).toBeTruthy()
    expect(within(win).getByText('What this look does not show')).toBeTruthy()
    expect(H.dayReadsFor.length).toBeGreaterThan(0)
    expect(new Set(H.dayReadsFor)).toEqual(new Set(['u-dana']))
    expect(H.dayReadsFor).not.toContain(SMOKE_AUTH_USER_ID)
  })

  it('writes nothing, whichever press inside the window is pressed', async () => {
    await openDanasCard()
    fireEvent.click(await screen.findByRole('button', { name: 'See Dana’s Task Mode' }))
    const win = await screen.findByRole('dialog', { name: 'Dana Whitlow’s Task Mode' })
    await within(win).findByText('Restock van 4 with fittings')
    H.writes = []
    const look = win.querySelector('[data-task-look]') as HTMLElement
    expect(look.querySelector('[data-fresh-done-press]')).toBeTruthy()
    // every press on their screen, twice over, since the first round may open more of them
    for (let round = 0; round < 2; round++) {
      for (const press of Array.from(look.querySelectorAll<HTMLElement>('button, [role="button"], input, textarea'))) {
        if (document.contains(press)) fireEvent.click(press)
      }
    }
    await waitFor(() => expect(win.querySelector('[data-fresh-lead]')?.textContent).toContain('Restock van 4 with fittings'))
    expect(H.writes).toEqual([])
    // the task is still Next and still open, and no window of the person's own acts came up
    expect(win.querySelectorAll('[data-fresh-done-press]')).toHaveLength(1)
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })

  it('still opens a card to read it', async () => {
    await openDanasCard()
    fireEvent.click(await screen.findByRole('button', { name: 'See Dana’s Task Mode' }))
    const win = await screen.findByRole('dialog', { name: 'Dana Whitlow’s Task Mode' })
    await within(win).findByText('Restock van 4 with fittings')
    const opener = Array.from(win.querySelectorAll<HTMLElement>('[data-fresh-lead] [aria-expanded]'))[0]
    expect(opener?.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(opener!)
    await waitFor(() => expect(win.querySelector('[data-fresh-lead] [aria-expanded="true"]')).toBeTruthy())
    expect(H.writes).toEqual([])
  })

  it('reads the day again and closes from the window’s own head', async () => {
    await openDanasCard()
    fireEvent.click(await screen.findByRole('button', { name: 'See Dana’s Task Mode' }))
    const win = await screen.findByRole('dialog', { name: 'Dana Whitlow’s Task Mode' })
    await within(win).findByText('Restock van 4 with fittings')
    const before = H.dayReadsFor.length
    H.today = [dayRow('a', 'Restock van 4 with fittings', { completed_at: new Date().toISOString() }), dayRow('b', 'Check the shop compressor oil')]
    fireEvent.click(within(win).getByRole('button', { name: 'Read again' }))
    await waitFor(() => expect(win.querySelector('[data-today-sentence]')?.textContent).toBe('1 of 2 done today. 1 older task is still open.'))
    expect(H.dayReadsFor.length).toBeGreaterThan(before)
    fireEvent.click(within(win).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { name: 'Dana Whitlow’s Task Mode' })).toBeNull()
  })

  it('lists what is coming up for that person, a repeating task named once', async () => {
    const day1 = ymdAddDays(TODAY, 1)
    const day2 = ymdAddDays(TODAY, 2)
    H.ahead = [
      dayRow('n1', 'Check the shop compressor oil', { scheduled_date: day1, checklist_item_id: 'item-oil' }),
      dayRow('n2', 'Check the shop compressor oil', { scheduled_date: day2, checklist_item_id: 'item-oil' }),
      dayRow('n3', 'Meet the inspector at the duplex', { scheduled_date: day2 }, { repeat_type: 'once' }),
    ]
    await openDanasCard()
    fireEvent.click(await screen.findByRole('button', { name: 'See Dana\u2019s Task Mode' }))
    const win = await screen.findByRole('dialog', { name: 'Dana Whitlow\u2019s Task Mode' })
    const panel = await waitFor(() => {
      const p = win.querySelector('[data-look-coming-up] [data-coming-up-day]')?.closest('[data-look-coming-up]') as HTMLElement | null
      if (!p) throw new Error('Coming up has not read yet')
      return p
    })
    expect(within(panel).getByText('The next 7 days. A task shows on Dana\u2019s phone on its day.')).toBeTruthy()
    const days = Array.from(panel.querySelectorAll('[data-coming-up-day]'))
    expect(days.map((d) => d.getAttribute('data-coming-up-day'))).toEqual([day1, day2])
    expect(days[0]?.textContent).toMatch(/^Tomorrow, /)
    expect(days[0]?.textContent).toContain('Check the shop compressor oil')
    expect(days[1]?.textContent).toContain('Meet the inspector at the duplex')
    expect(days[1]?.textContent).toContain('1 repeating task again')
    expect(new Set(H.dayReadsFor)).toEqual(new Set(['u-dana']))
  })

  it('offers a task for the person when their week is empty, as the viewer’s own act', async () => {
    renderWithProviders(
      <ChecklistAddModalProvider>
        <Checklist />
        <AddModalProbe />
      </ChecklistAddModalProvider>,
      { route: '/checklist?tab=review' },
    )
    fireEvent.click(await screen.findByText('Dana Whitlow'))
    fireEvent.click(await screen.findByRole('button', { name: 'See Dana\u2019s Task Mode' }))
    const win = await screen.findByRole('dialog', { name: 'Dana Whitlow\u2019s Task Mode' })
    await within(win).findByText('Nothing is dated in the next 7 days.')
    fireEvent.click(within(win).getByRole('button', { name: '\uFF0B Add task for Dana' }))
    expect(document.querySelector('[data-probe-open]')?.getAttribute('data-probe-open')).toBe('1')
    expect(document.querySelector('[data-probe-assignee]')?.getAttribute('data-probe-assignee')).toBe('u-dana')
  })

  it('is not offered to an office role that may not act for others', async () => {
    H.role = 'assistant'
    await openDanasCard()
    await screen.findByText('Return the borrowed pipe threader')
    expect(screen.queryByRole('button', { name: 'See Dana’s Task Mode' })).toBeNull()
    expect(document.querySelector('[data-see-task-mode]')).toBeNull()
  })

  it('offers a dev the line to View as the person, and signs in only after the question', async () => {
    H.role = 'dev'
    H.person = { role: 'helpers', email: 'dana@example.com', login_attached_at: '2026-01-05T12:00:00Z' }
    await openDanasCard()
    fireEvent.click(await screen.findByRole('button', { name: 'See Dana’s Task Mode' }))
    const win = await screen.findByRole('dialog', { name: 'Dana Whitlow’s Task Mode' })
    const line = await waitFor(() => {
      const p = win.querySelector('[data-look-view-as]')
      if (!p) throw new Error('the line has not been drawn yet')
      return p as HTMLElement
    })
    expect(line.textContent).toBe('To press something as Dana, View as Dana. That signs you in as Dana, and the app records it.')
    // it is the viewer's own press, so it sits outside their screen's gate
    expect(line.closest('[data-task-look]')).toBeNull()
    fireEvent.click(within(line).getByRole('button', { name: 'View as Dana' }))
    const ask = await screen.findByRole('alertdialog')
    expect(ask.textContent).toContain('Sign in as Dana Whitlow? The app records it. Exit brings you back to this page.')
    expect(H.signIns).toEqual([])
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(H.signIns).toEqual([])
    fireEvent.click(within(line).getByRole('button', { name: 'View as Dana' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'View as Dana' }))
    await waitFor(() => expect(H.signIns).toEqual(['dana@example.com']))
    expect(H.writes).toEqual([])
  })

  it('does not offer the owner that line', async () => {
    H.person = { role: 'helpers', email: 'dana@example.com', login_attached_at: '2026-01-05T12:00:00Z' }
    await openDanasCard()
    fireEvent.click(await screen.findByRole('button', { name: 'See Dana’s Task Mode' }))
    const win = await screen.findByRole('dialog', { name: 'Dana Whitlow’s Task Mode' })
    await within(win).findByText('Restock van 4 with fittings')
    expect(within(win).getByText('What this look does not show')).toBeTruthy()
    expect(win.querySelector('[data-look-view-as]')).toBeNull()
    expect(within(win).queryByRole('button', { name: 'View as Dana' })).toBeNull()
  })

  it('does not offer a dev that line for a person with no login', async () => {
    H.role = 'dev'
    await openDanasCard()
    fireEvent.click(await screen.findByRole('button', { name: 'See Dana’s Task Mode' }))
    const win = await screen.findByRole('dialog', { name: 'Dana Whitlow’s Task Mode' })
    await within(win).findByText('Restock van 4 with fittings')
    expect(win.querySelector('[data-look-view-as]')).toBeNull()
  })
})
