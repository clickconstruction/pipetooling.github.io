// @vitest-environment jsdom
/**
 * Checklist → Manage → a task's ⋮ → Delete (punch list #369). The walk of 2026-11-25 deleted a task and nothing
 * was said: the row leaving the list was the only sign. A failure drew the database's own words at the page's
 * foot. This holds the three ends the window now says in a toast: the task is gone, the delete failed with its
 * reason, and the row rules refused it, which the database answers with no error and no row.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders, settle } from '../test/renderSmokeMocks'
import { MANAGE_DELETE_WORDS } from '../lib/checklistManageDeleteWords'

/** What the next delete answers, and what it was asked. */
const wire = vi.hoisted(() => ({
  answer: { data: [{ id: 'ahead' }] as Array<{ id: string }> | null, error: null as null | { message: string; code: string } },
  asked: [] as string[],
}))

const ITEMS = [
  { id: 'ahead', title: 'ZZ Order the valves', links: null, created_by_user_id: 'u1', repeat_type: 'once', repeat_days_of_week: null, repeat_days_after: null, repeat_end_date: null, start_date: '2026-11-01', due_date: null, show_until_completed: false, notify_on_complete_user_id: null, notify_creator_on_complete: false, reminder_time: null, reminder_scope: null, created_at: '2026-11-01T15:00:00Z', updated_at: null, roadmap_group_task_id: null, checklist_tech_tree_group_tasks: null, checklist_item_assignees: [] },
]
const INSTANCES = [{ checklist_item_id: 'ahead', completed_at: null, scheduled_date: '2026-11-01' }]

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev' })
})
vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  const rows = (data: unknown[]): Record<string, unknown> => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'order']) b[m] = () => b
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve({ data, error: null }).then(ok, bad)
    return b
  }
  /** The delete, as the tab writes it: `.delete().eq('id', id).select('id')`. */
  const items = (): Record<string, unknown> => {
    const b = rows(ITEMS)
    b.delete = () => {
      const d: Record<string, unknown> = {}
      d.eq = (_col: string, id: string) => {
        wire.asked.push(`eq:${id}`)
        return d
      }
      d.select = (cols: string) => {
        wire.asked.push(`select:${cols}`)
        return d
      }
      d.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(wire.answer).then(ok, bad)
      return d
    }
    return b
  }
  const byTable: Record<string, () => unknown> = {
    users: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { role: 'dev' }, error: null }) }) }) }),
    checklist_items: items,
    checklist_instances: () => rows(INSTANCES),
    checklist_item_due_changes: () => rows([]),
  }
  return { supabase: { ...stub, from: (table: string) => (byTable[table] ?? stub.from)() } }
})
vi.mock('../lib/people/fetchActiveUsers', () => ({ activeUsersQuery: () => Promise.resolve({ data: [], error: null }) }))
vi.mock('../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))
vi.mock('../components/ChecklistItemEditModal', () => ({ ChecklistItemEditModal: () => null }))

const { default: Checklist } = await import('./Checklist')

/** Open Manage, the task's menu, Delete, and press the window's own Delete. */
async function deleteTheTask() {
  renderWithProviders(<Checklist />, { route: '/checklist?tab=manage' })
  await screen.findByRole('button', { name: 'Actions for ZZ Order the valves' })
  await settle()
  fireEvent.click(screen.getByRole('button', { name: 'Actions for ZZ Order the valves' }))
  fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Delete' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
}

afterEach(() => {
  cleanup()
  wire.asked.length = 0
})

describe('Checklist → Manage → Delete says what happened', () => {
  it('a delete that lands asks for the row back, says the task is deleted and closes the window', async () => {
    wire.answer = { data: [{ id: 'ahead' }], error: null }
    await deleteTheTask()
    expect(await screen.findByText(MANAGE_DELETE_WORDS.done)).toBeTruthy()
    expect(wire.asked).toEqual(['eq:ahead', 'select:id'])
    await settle()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a delete that fails says so with its reason and leaves the window open to try again', async () => {
    wire.answer = { data: null, error: { message: 'update or delete on table "checklist_items" violates foreign key constraint', code: '23503' } }
    await deleteTheTask()
    // `formatErrorMessage` leads with the tab's own sentence and puts the reason after it, so the line is never the
    // database's words alone, which is what the page's foot drew before.
    const lead = MANAGE_DELETE_WORDS.failed.replace(/\.$/, '')
    const said = await screen.findByText((t) => t.startsWith(lead) && t !== MANAGE_DELETE_WORDS.refused)
    expect((said.textContent ?? '').length).toBeGreaterThan(MANAGE_DELETE_WORDS.failed.length)
    expect(said.textContent).toContain('foreign key')
    expect(screen.queryByText(MANAGE_DELETE_WORDS.done)).toBeNull()
    await settle()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('a delete the row rules refuse, no error and no row, says the task was not deleted', async () => {
    wire.answer = { data: [], error: null }
    await deleteTheTask()
    expect(await screen.findByText(MANAGE_DELETE_WORDS.refused)).toBeTruthy()
    expect(screen.queryByText(MANAGE_DELETE_WORDS.done)).toBeNull()
    await settle()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
