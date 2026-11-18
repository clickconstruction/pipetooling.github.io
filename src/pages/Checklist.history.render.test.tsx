// @vitest-environment jsdom
/**
 * Checklist → History, drawn through the page (v2.7732): the tab's first test. A wide screen draws the grid of
 * repeating tasks, a column a day and a rate a row, over the ledger of one-offs; edit mode asks, then takes a
 * missed day's row away. The grid's rules are `lib/checklistHistorySplit.ts`; this holds what the tab draws
 * from them, and it passed on the page before the rules left it.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { writeFileSync } from 'node:fs'
import { renderWithProviders, settle, SMOKE_AUTH_USER_ID } from '../test/renderSmokeMocks'

const H = vi.hoisted(() => ({ deleted: [] as string[] }))

const item = (title: string, repeat_type: string, created_at: string | null) => ({ title, links: null, due_date: null, repeat_type, created_at })
const row = (id: string, itemId: string, day: string, done: null | 'me' | 'other', it: ReturnType<typeof item>) => ({
  id,
  checklist_item_id: itemId,
  scheduled_date: day,
  completed_at: done ? `${day}T20:00:00Z` : null,
  completed_by_user_id: done === 'me' ? SMOKE_AUTH_USER_ID : done === 'other' ? 'someone-else' : null,
  notes: null,
  created_at: `${day}T10:00:00Z`,
  reviewed_at: null,
  reviewed_by: null,
  checklist_items: it,
})
const SWEEP = item('ZZ Sweep the shop', 'day_of_week', '2026-11-02T15:00:00Z')
const LOCK = item('ZZ Lock the gate', 'day_of_week', '2026-11-04T15:00:00Z')
/** Two repeating tasks over four days (done, done by someone else, missed, a day before the second was made) and three one-offs. */
const INSTANCES = [
  row('s1', 'sweep', '2026-11-03', 'me', SWEEP),
  row('s2', 'sweep', '2026-11-04', 'other', SWEEP),
  row('s3', 'sweep', '2026-11-05', null, SWEEP),
  row('s4', 'sweep', '2026-11-06', 'me', SWEEP),
  row('l1', 'lock', '2026-11-05', 'me', LOCK),
  row('l2', 'lock', '2026-11-06', null, LOCK),
  row('o1', 'sign', '2026-11-04', 'me', item('ZZ Hang the sign', 'once', '2026-11-01T15:00:00Z')),
  row('o2', 'valves', '2026-11-05', null, item('ZZ Order the valves', 'once', '2026-11-03T15:00:00Z')),
  row('o3', 'paint', '2026-11-12', null, item('ZZ Paint the door', 'once', '2026-11-09T15:00:00Z')),
]

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev' })
})
vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  /** The days' read answers the rows above, less any a test has deleted; a delete remembers the row it took. */
  const instances = (): Record<string, unknown> => {
    let deleting = false
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'gte', 'lte', 'order']) b[m] = () => b
    b.delete = () => {
      deleting = true
      return b
    }
    b.eq = (col: string, value: string) => {
      if (deleting && col === 'id') H.deleted.push(value)
      return b
    }
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) =>
      Promise.resolve(deleting ? { error: null } : { data: INSTANCES.filter((i) => !H.deleted.includes(i.id)), error: null }).then(ok, bad)
    return b
  }
  const byTable: Record<string, () => unknown> = {
    users: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { role: 'dev' }, error: null }) }) }) }),
    checklist_instances: instances,
  }
  return { supabase: { ...stub, from: (table: string) => (byTable[table] ?? stub.from)() } }
})
vi.mock('../lib/people/fetchActiveUsers', () => ({
  activeUsersQuery: () => Promise.resolve({ data: [{ id: 'smoke-auth-user-1', name: 'Smoke Dev', email: 'smoke@example.com' }, { id: 'u2', name: 'Ben Okoro', email: 'ben@example.com' }], error: null }),
}))
vi.mock('../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))

const { default: Checklist } = await import('./Checklist')

/** The grid's row for a task: its cells' titles and its rate. */
function gridRow(title: string): { cells: string[]; rate: string } {
  const tr = screen.getByText(title).closest('tr')!
  const tds = Array.from(tr.querySelectorAll('td'))
  return {
    cells: tds.slice(1, -1).map((td) => td.querySelector('div')?.getAttribute('title') ?? '(before it was made)'),
    rate: tds[tds.length - 1]!.textContent ?? '',
  }
}

describe('Checklist → History', () => {
  beforeAll(() => {
    // The day the ledger calls a past one-off missed. Only the clock is held, so the reads still settle.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T18:00:00Z'))
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  it('draws the repeating grid, a column for each day a repeating task had, and each row’s rate', async () => {
    H.deleted = []
    const { container } = renderWithProviders(<Checklist />, { route: '/checklist?tab=history' })
    await screen.findByText('ZZ Sweep the shop')
    await settle()

    // Four columns: the days the two repeating tasks had. The one-offs' days mint none (Nov 12 is not there).
    const heads = Array.from(container.querySelectorAll('thead th')).map((th) => th.getAttribute('title')).filter(Boolean)
    expect(heads).toEqual(['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'])

    // Done by this person and by someone else both count; a missed day is due and not done.
    expect(gridRow('ZZ Sweep the shop')).toEqual({
      cells: ['2026-11-03: completed', '2026-11-04: completed_by_other', '2026-11-05: incomplete', '2026-11-06: completed'],
      rate: '75%',
    })
    // A task made on Nov 4 has no box before that day, and a day it was not due reads as such.
    expect(gridRow('ZZ Lock the gate')).toEqual({
      cells: ['(before it was made)', '2026-11-04: not due', '2026-11-05: completed', '2026-11-06: incomplete'],
      rate: '50%',
    })

    // The one-offs leave the grid for their ledger: done, missed and still open, newest first.
    expect(screen.getByText(/3 in this window · 1 done · newest first/)).toBeTruthy()
    const ledger = screen.getByText('ONE-OFF TASKS', { exact: false }).parentElement!
    expect(Array.from(ledger.querySelectorAll(':scope > div')).map((d) => d.textContent)).toEqual([
      'openZZ Paint the doorcreated 11/9 · still open',
      '✗ missedZZ Order the valvescreated 11/3 · due 11/5, never done',
      '✓ doneZZ Hang the signcreated 11/1 → done 11/4',
    ])
    expect((screen.getByText('View history for:').parentElement!.querySelector('select') as HTMLSelectElement).options).toHaveLength(2)

    // The whole of what the tab draws, kept beside the run when asked for, to compare two builds of the page.
    if (process.env.CHECKLIST_HISTORY_HTML) writeFileSync(process.env.CHECKLIST_HISTORY_HTML, container.innerHTML)
  })

  it('edit mode asks first, then takes a missed day’s row away and reads the cell as not due', async () => {
    H.deleted = []
    renderWithProviders(<Checklist />, { route: '/checklist?tab=history' })
    await screen.findByText('ZZ Sweep the shop')

    // No cell is a press until edit mode is on.
    expect(screen.queryByTitle('2026-11-05: incomplete (click to cycle)')).toBeNull()
    fireEvent.click(screen.getByLabelText('Edit mode'))
    const sweepRow = within(screen.getByText('ZZ Sweep the shop').closest('tr')!)
    fireEvent.click(sweepRow.getByTitle('2026-11-05: incomplete (click to cycle)'))
    fireEvent.click(await screen.findByRole('button', { name: 'Change' }))

    // The row the page took is that task's row for that day, and the rate no longer counts the day.
    await waitFor(() => expect(H.deleted).toEqual(['s3']))
    await waitFor(() => expect(gridRow('ZZ Sweep the shop').cells[2]).toBe('2026-11-05: not due (click to cycle)'))
    expect(gridRow('ZZ Sweep the shop').rate).toBe('100%')
  })
})
