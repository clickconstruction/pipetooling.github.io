// @vitest-environment jsdom
/**
 * Checklist → Manage, drawn through the page (v2.7724). The tab moved to its own file,
 * `components/checklist/ChecklistManageTab.tsx`, and this holds what the page still owes it: the tab mounts on
 * `?tab=manage` for a role that manages, its library reads the items, their days and their pushed due dates, its
 * sections split one-offs from repeating and finished ones, and its row menu's Edit reaches the page's one edit
 * window. The test passed on the page before the move, so it also says the move changed nothing it draws.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { writeFileSync } from 'node:fs'
import { renderWithProviders, settle } from '../test/renderSmokeMocks'

const ROADMAP_EMBED = { group_id: 'g1', checklist_tech_tree_groups: { title: 'Stage Two', roadmap_id: 'r1', checklist_tech_tree_roadmaps: { title: 'Farm 1' } } }

/** One row of every kind the library sorts: an old open one-off off a roadmap, one scheduled ahead with a pushed due date, a repeating one, a finished one. */
const ITEMS = [
  { id: 'old', title: 'ZZ Fix the gate', links: null, created_by_user_id: 'u2', repeat_type: 'once', repeat_days_of_week: null, repeat_days_after: null, repeat_end_date: null, start_date: '2026-10-01', due_date: null, show_until_completed: true, notify_on_complete_user_id: null, notify_creator_on_complete: true, reminder_time: '08:30:00', reminder_scope: null, created_at: '2026-10-01T15:00:00Z', updated_at: null, roadmap_group_task_id: 'rt1', checklist_tech_tree_group_tasks: ROADMAP_EMBED, checklist_item_assignees: [{ user_id: 'u1', users: { name: 'Ada Long', email: 'ada@example.com' } }] },
  { id: 'ahead', title: 'ZZ Order the valves', links: null, created_by_user_id: 'u1', repeat_type: 'once', repeat_days_of_week: null, repeat_days_after: null, repeat_end_date: null, start_date: '2026-11-20', due_date: '2026-11-28', show_until_completed: false, notify_on_complete_user_id: null, notify_creator_on_complete: false, reminder_time: null, reminder_scope: null, created_at: '2026-11-08T15:00:00Z', updated_at: null, roadmap_group_task_id: null, checklist_tech_tree_group_tasks: null, checklist_item_assignees: [] },
  { id: 'weekly', title: 'ZZ Sweep the shop', links: null, created_by_user_id: 'u1', repeat_type: 'day_of_week', repeat_days_of_week: [1], repeat_days_after: null, repeat_end_date: null, start_date: '2026-09-01', due_date: null, show_until_completed: false, notify_on_complete_user_id: null, notify_creator_on_complete: false, reminder_time: null, reminder_scope: null, created_at: '2026-09-01T15:00:00Z', updated_at: null, roadmap_group_task_id: null, checklist_tech_tree_group_tasks: null, checklist_item_assignees: [{ user_id: 'u1', users: { name: 'Ada Long', email: 'ada@example.com' } }, { user_id: 'u2', users: { name: 'Ben Okoro', email: 'ben@example.com' } }] },
  { id: 'done', title: 'ZZ Hang the sign', links: null, created_by_user_id: 'u1', repeat_type: 'once', repeat_days_of_week: null, repeat_days_after: null, repeat_end_date: null, start_date: '2026-10-20', due_date: null, show_until_completed: false, notify_on_complete_user_id: null, notify_creator_on_complete: false, reminder_time: null, reminder_scope: null, created_at: '2026-10-20T15:00:00Z', updated_at: null, roadmap_group_task_id: null, checklist_tech_tree_group_tasks: null, checklist_item_assignees: [] },
]
const INSTANCES = [
  { checklist_item_id: 'old', completed_at: null, scheduled_date: '2026-10-01' },
  { checklist_item_id: 'ahead', completed_at: null, scheduled_date: '2026-11-20' },
  { checklist_item_id: 'weekly', completed_at: '2026-11-02T15:00:00Z', scheduled_date: '2026-11-02' },
  { checklist_item_id: 'weekly', completed_at: null, scheduled_date: '2026-11-16' },
  { checklist_item_id: 'done', completed_at: '2026-10-21T15:00:00Z', scheduled_date: '2026-10-20' },
]
const PUSHES = [{ checklist_item_id: 'ahead', changed_at: '2026-11-09T15:00:00Z', changed_by: 'u1', from_due: '2026-11-21', to_due: '2026-11-28' }]
const USERS = [
  { id: 'u1', name: 'Ada Long', email: 'ada@example.com' },
  { id: 'u2', name: 'Ben Okoro', email: 'ben@example.com' },
]

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev' })
})
vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  /** A read that answers the same rows whatever the filter. */
  const rows = (data: unknown[]): Record<string, unknown> => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'order']) b[m] = () => b
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve({ data, error: null }).then(ok, bad)
    return b
  }
  const byTable: Record<string, () => unknown> = {
    users: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { role: 'dev' }, error: null }) }) }) }),
    checklist_items: () => rows(ITEMS),
    checklist_instances: () => rows(INSTANCES),
    checklist_item_due_changes: () => rows(PUSHES),
  }
  return { supabase: { ...stub, from: (table: string) => (byTable[table] ?? stub.from)() } }
})
vi.mock('../lib/people/fetchActiveUsers', () => ({ activeUsersQuery: () => Promise.resolve({ data: USERS, error: null }) }))
vi.mock('../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))
vi.mock('../components/ChecklistItemEditModal', () => ({ ChecklistItemEditModal: ({ itemId }: { itemId: string }) => <div data-testid="edit-window">{itemId}</div> }))

const { default: Checklist } = await import('./Checklist')

/** The library's section under a label, as its list. */
function sectionRows(label: string): string[] {
  const head = screen.getByText(label)
  const list = head.parentElement?.querySelector('ul')
  return list ? Array.from(list.children).map((li) => li.textContent ?? '') : []
}

describe('Checklist → Manage', () => {
  beforeAll(() => {
    // The day the library reads its ages and chips against. Only the clock is held, so the reads still settle.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T18:00:00Z'))
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  it('opens on the one-offs, oldest first, with each row’s chips, and the pills count every part', async () => {
    const { container } = renderWithProviders(<Checklist />, { route: '/checklist?tab=manage' })
    await screen.findByText('ONE-OFFS · 1 open · oldest first')
    await settle()

    const open = sectionRows('ONE-OFFS · 1 open · oldest first')
    expect(open).toHaveLength(1)
    // The old one-off: its repeat chip, its roadmap stage alone, its age, its reminder and who hears.
    expect(open[0]).toContain('ZZ Fix the gate')
    expect(open[0]).toContain('Stage Two')
    expect(open[0]).not.toContain('Farm 1')
    expect(open[0]).toContain('open 40 days')
    expect(open[0]).toContain('🔔 08:30')
    expect(open[0]).toContain('notifies on done')
    expect(screen.getByTitle('Farm 1 · Stage Two').tagName).toBe('SPAN')

    // A one-off whose first day is ahead waits in its own part, with its pushed due date.
    const ahead = sectionRows('SCHEDULED · 1')
    expect(ahead).toHaveLength(1)
    expect(ahead[0]).toContain('ZZ Order the valves')
    expect(ahead[0]).toContain('starts ')
    expect(ahead[0]).toContain('pushed')
    expect(ahead[0]).toContain('unassigned')

    const pill = (name: RegExp) => screen.getByRole('button', { name }).textContent
    expect(pill(/^One-offs/)).toBe('One-offs2')
    expect(pill(/Repeating/)).toBe('↻ Repeating1')
    expect(pill(/Completed/)).toBe('✓ Completed1')
    expect(pill(/Timeline/)).toBe('📅 Timeline1')
    expect((screen.getByLabelText('Filter by assignee') as HTMLSelectElement).options).toHaveLength(3)

    // The whole of what the tab draws, kept beside the run when asked for, to compare two builds of the page.
    if (process.env.CHECKLIST_MANAGE_HTML) writeFileSync(process.env.CHECKLIST_MANAGE_HTML, container.innerHTML)
  })

  it('the pills change the part, and the search narrows by a task or a person', async () => {
    renderWithProviders(<Checklist />, { route: '/checklist?tab=manage' })
    await screen.findByText('ONE-OFFS · 1 open · oldest first')

    fireEvent.click(screen.getByRole('button', { name: /Repeating/ }))
    const repeating = sectionRows('REPEATING · 1')
    expect(repeating[0]).toContain('ZZ Sweep the shop')
    expect(repeating[0]).toContain('next ')
    expect(screen.getByTitle('Ada Long, Ben Okoro')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Completed/ }))
    expect(sectionRows('✓ COMPLETED ONE-OFFS · 1')[0]).toContain('ZZ Hang the sign')

    fireEvent.click(screen.getByRole('button', { name: /^All/ }))
    expect(screen.getByText('REPEATING · 1')).toBeTruthy()
    expect(screen.queryByText('ZZ Hang the sign')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Completed one-offs/ }))
    expect(screen.getByText('ZZ Hang the sign')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Search tasks or people'), { target: { value: 'ben' } })
    expect(screen.queryByText('ZZ Fix the gate')).toBeNull()
    expect(sectionRows('REPEATING · 1')[0]).toContain('ZZ Sweep the shop')
    fireEvent.change(screen.getByLabelText('Search tasks or people'), { target: { value: 'no such task' } })
    expect(document.querySelector('[data-empty-state]')).not.toBeNull()
  })

  it('a row’s menu: a roadmap task offers no Edit or Delete, a plain one opens the page’s edit window and asks before it deletes', async () => {
    renderWithProviders(<Checklist />, { route: '/checklist?tab=manage' })
    await screen.findByText('ONE-OFFS · 1 open · oldest first')

    fireEvent.click(screen.getByRole('button', { name: 'Actions for ZZ Fix the gate' }))
    // A dev outside Task Mode has the door to the roadmap, so the page hands the tab its `onOpenRoadmap`.
    const roadmapMenu = within(screen.getByRole('menu'))
    expect(roadmapMenu.getByRole('menuitem', { name: '⛰ Open in Roadmap' })).toBeTruthy()
    expect(roadmapMenu.queryByRole('menuitem', { name: 'Edit' })).toBeNull()
    expect(roadmapMenu.queryByRole('menuitem', { name: 'Delete' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Actions for ZZ Order the valves' }))
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Edit' }))
    expect(screen.getByTestId('edit-window').textContent).toBe('ahead')

    fireEvent.click(screen.getByRole('button', { name: 'Actions for ZZ Order the valves' }))
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Delete' }))
    const ask = within(screen.getByRole('dialog'))
    expect(ask.getByText('Delete checklist item?')).toBeTruthy()
    expect(ask.getByText('ZZ Order the valves')).toBeTruthy()
    fireEvent.click(ask.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
