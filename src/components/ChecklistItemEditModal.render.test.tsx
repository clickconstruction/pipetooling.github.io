// @vitest-environment jsdom
/**
 * The Edit task window (punch list #331, PR 3): the same rows as the New task window, opened on a task that
 * exists. These tests hold what is the edit's own: it opens on the task as saved, whoever has the task keeps a
 * face, adding a person never takes the editor off, the bell is the giver's, and Save writes the row.
 * Every person and task here is made up.
 */
import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'

vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: () => false }))
vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../lib/tasks/taskPlaceIo', () => ({ loadRecentTaskPlaces: () => Promise.resolve([]), loadTaskPlace: () => Promise.resolve(null) }))
vi.mock('../lib/tasks/taskSpotPhotoIo', () => ({
  loadTaskSpotPhotoPath: () => Promise.resolve(null),
  putTaskSpotPhoto: () => Promise.resolve({ path: 'x' }),
  removeTaskSpotPhotoFile: () => Promise.resolve(),
  saveTaskSpotPhotoPath: () => Promise.resolve(null),
  taskSpotPhotoUrls: () => Promise.resolve(new Map()),
}))
vi.mock('./checklist/TaskSpotPhotoField', () => ({ TaskSpotPhotoField: () => <span>stub: photo press</span> }))
vi.mock('../lib/taskLinesIo', () => ({ loadItemLines: () => Promise.resolve([]), syncItemLines: () => Promise.resolve(null) }))
vi.mock('../lib/checklistEditRegenerate', () => ({ applyEditRegeneration: () => Promise.resolve({ ok: true }) }))
vi.mock('../utils/checklistOrder', () => ({ getNextDisplayOrders: () => Promise.resolve(new Map()) }))

const ME = 'smoke-auth-user-1'
const ROSTER = [
  { id: ME, name: 'Rosa', email: 'rosa@example.com', role: 'dev' },
  { id: 'theo', name: 'Theo', email: 'theo@example.com', role: 'helpers' },
  { id: 'imani', name: 'Imani', email: 'imani@example.com', role: 'helpers' },
  { id: 'wes', name: 'Wes', email: 'wes@example.com', role: 'helpers' },
]
const TASK = {
  id: 'task-1',
  title: 'Grease the pump bearings',
  links: [] as string[],
  created_by_user_id: ME,
  repeat_type: 'once',
  repeat_days_of_week: null,
  repeat_days_after: null,
  repeat_end_date: null,
  start_date: '2031-03-17',
  due_date: null as string | null,
  show_until_completed: true,
  notify_on_complete_user_id: null,
  notify_creator_on_complete: true,
  reminder_time: null as string | null,
  reminder_scope: null,
  remind_day_before: false,
  escalate_after_days: null,
  created_at: '2031-03-10T15:00:00Z',
  updated_at: '2031-03-10T15:00:00Z',
  asks_for_photo: false,
}

const db = vi.hoisted(() => ({
  task: null as Record<string, unknown> | null,
  /** Who has the task as saved, and the giver's own last tasks for the faces. */
  assignees: [] as Array<Record<string, unknown>>,
  users: [] as Array<Record<string, unknown>>,
  writes: [] as Array<{ table: string; op: string; row?: unknown }>,
}))

vi.mock('../lib/supabase', () => {
  function makeBuilder(table: string) {
    // The fake keeps the filters a read names, so the task's own people and the giver's older tasks stay apart.
    const filters: Array<(row: Record<string, unknown>) => boolean> = []
    const rows = (): Array<Record<string, unknown>> => (table === 'users' ? db.users : table === 'checklist_item_assignees' ? db.assignees : table === 'checklist_items' ? [{ id: 'task-0' }] : [])
    const list = () => rows().filter((row) => filters.every((f) => f(row)))
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'is', 'order', 'limit']) builder[m] = () => builder
    builder.eq = (col: string, val: unknown) => {
      if (table === 'checklist_item_assignees') filters.push((row) => row[col] === val)
      return builder
    }
    builder.in = (col: string, vals: unknown[]) => {
      if (table === 'checklist_item_assignees') filters.push((row) => vals.includes(row[col]))
      return builder
    }
    for (const op of ['insert', 'update', 'delete', 'upsert']) {
      builder[op] = (row?: unknown) => {
        db.writes.push({ table, op, row })
        return builder
      }
    }
    builder.single = () => Promise.resolve({ data: table === 'checklist_items' ? db.task : table === 'users' ? { role: 'dev' } : null, error: null })
    builder.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) => Promise.resolve({ data: list(), error: null }).then(f, r)
    return builder
  }
  return { supabase: { from: (table: string) => makeBuilder(table) } }
})

import { ChecklistItemEditModal } from './ChecklistItemEditModal'
import { renderWithProviders } from '../test/renderSmokeMocks'

type Opts = { task?: Partial<typeof TASK>; assignees?: string[] }

async function openEdit(opts: Opts = {}) {
  db.task = { ...TASK, ...opts.task }
  // The task's own people, and one older task of the giver's that went to Theo, so Theo is a recent face.
  db.assignees = [...(opts.assignees ?? ['theo']).map((user_id) => ({ checklist_item_id: 'task-1', user_id })), { checklist_item_id: 'task-0', user_id: 'theo' }]
  db.users = ROSTER
  db.writes = []
  const onClose = vi.fn()
  const onSaved = vi.fn()
  const setError = vi.fn()
  renderWithProviders(<ChecklistItemEditModal itemId="task-1" onClose={onClose} onSaved={onSaved} setError={setError} role="dev" />)
  const words = (await screen.findByLabelText('Task')) as HTMLTextAreaElement
  return { words, onClose, onSaved, setError }
}
const addPress = (key: string) => document.querySelector<HTMLButtonElement>(`[data-add-press="${key}"]`)!
const faceNames = () => Array.from(screen.getByTestId('new-task-faces').querySelectorAll('button')).map((b) => `${b.getAttribute('aria-label')}${b.getAttribute('aria-pressed') === 'true' ? ' ✓' : ''}`)

describe('ChecklistItemEditModal as Edit task (punch list #331)', () => {
  it('opens on the task as saved: its words, its day on the bar, its person lit, and Save', async () => {
    const { words } = await openEdit()
    expect(document.getElementById('checklist-edit-modal-title')!.textContent).toBe('Edit task')
    expect(words.value).toBe('Grease the pump bearings')
    expect(faceNames()).toEqual(['Me', 'Theo ✓'])
    expect(screen.getByRole('group', { name: 'When' }).textContent).toContain('Mon 17')
    expect(screen.getByRole('status').textContent).toBe('Theo gets it on Mon, Mar 17. It stays until it is done. You hear when it is done.')
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false)
    cleanup()
  })

  it('gives a face to whoever has the task, recent or not', async () => {
    await openEdit({ assignees: ['wes', 'imani'] })
    expect(faceNames()).toEqual(['Me', 'Wes ✓', 'Imani ✓', 'Theo'])
    cleanup()
  })

  it('shows what the task already carries on the Add row', async () => {
    await openEdit({ task: { links: ['https://example.com/pump-manual'], reminder_time: '07:00:00', due_date: '2031-03-21', asks_for_photo: true } })
    expect(addPress('remind').textContent).toBe('✓ Remind · Morning 7:00')
    expect(addPress('link').textContent).toBe('✓ 1 link')
    expect(addPress('due').textContent).toBe('✓ Due by Fri, Mar 21')
    expect(addPress('photo').getAttribute('aria-pressed')).toBe('true')
    // Nothing stands open until its press is pressed.
    expect(screen.queryByTestId('new-task-panel-remind')).toBeNull()
    cleanup()
  })

  it('adds a person beside the editor, never in place of them', async () => {
    await openEdit({ assignees: [ME] })
    expect(faceNames()).toEqual(['Me ✓', 'Theo'])
    fireEvent.click(screen.getByRole('button', { name: 'Theo' }))
    expect(faceNames()).toEqual(['Me ✓', 'Theo ✓'])
    cleanup()
  })

  it('hides the bell on a task that is only the giver\'s, and names the giver on someone else\'s task', async () => {
    await openEdit({ assignees: [ME] })
    expect(screen.queryByRole('button', { name: /when it's done$/ })).toBeNull()
    cleanup()
    await openEdit({ task: { created_by_user_id: 'imani' } })
    const bell = screen.getByRole('button', { name: "Tell Imani when it's done" })
    expect(bell.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('status').textContent).toMatch(/Imani hears when it is done\.$/)
    cleanup()
  })

  it('holds Save dead while the words are empty, and says why', async () => {
    const { words } = await openEdit()
    fireEvent.change(words, { target: { value: '  ' } })
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('status').textContent).toBe('Type the task first.')
    cleanup()
  })

  it('Save writes the task and its people, then closes', async () => {
    const { words, onClose, onSaved } = await openEdit()
    fireEvent.change(words, { target: { value: 'Grease both pump bearings' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tomorrow' }))
    fireEvent.click(screen.getByRole('button', { name: "Tell me when it's done" }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onSaved).toHaveBeenCalled()
    const update = db.writes.find((w) => w.table === 'checklist_items' && w.op === 'update')!.row as Record<string, unknown>
    const now = new Date()
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    expect(update).toMatchObject({ title: 'Grease both pump bearings', repeat_type: 'once', show_until_completed: true, notify_creator_on_complete: false })
    expect(String(update.start_date)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(Math.abs(new Date(`${update.start_date}T12:00:00`).getTime() - next.getTime())).toBeLessThan(36 * 3600 * 1000)
    // The place was not touched, so no place column rides the save.
    expect(Object.keys(update).filter((k) => k.startsWith('place_'))).toEqual([])
    const people = db.writes.find((w) => w.table === 'checklist_item_assignees' && w.op === 'insert')!.row as Array<{ user_id: string }>
    expect(people.map((p) => p.user_id)).toEqual(['theo'])
    cleanup()
  })
})
