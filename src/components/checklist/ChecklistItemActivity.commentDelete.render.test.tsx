// @vitest-environment jsdom
/**
 * Deleting a test task's comment (punch list #443, row 13): a dev reads Delete… beside a comment on a task whose title
 * starts with ZZ and deletes it after a confirm that names the act; on any other task the press is dead with its
 * reason; nobody else sees it. Made-up people and tasks.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

const db = vi.hoisted(() => ({ role: 'dev' as string, deleted: [] as string[], refuse: null as null | Error }))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as unknown as { from: (t: string) => unknown; rpc: (n: string, a?: unknown) => unknown; functions: unknown }
  const rpc = stub.rpc.bind(stub)
  const DATA: Record<string, () => unknown[]> = {
    checklist_instances: () => [{ id: 'inst-1', scheduled_date: '2026-11-17', completed_at: null }],
    checklist_instance_events: () => [
      { id: 'ev-1', instance_id: 'inst-1', event_type: 'comment', actor_user_id: 'u-dana', body: 'ZZ walk comment', created_at: '2026-11-17T15:00:00Z', percent: null },
      { id: 'ev-2', instance_id: 'inst-1', event_type: 'completed', actor_user_id: 'u-luis', body: '', created_at: '2026-11-17T16:00:00Z', percent: null },
    ],
    checklist_item_due_changes: () => [],
    users: () => [{ id: 'u-dana', name: 'Dana Whitlock' }, { id: 'u-luis', name: 'Luis Ortega' }],
    task_note_tags: () => [],
  }
  const rows = (table: string) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'lte', 'gt', 'order', 'limit']) b[m] = () => b
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: (DATA[table] ?? (() => []))(), error: null }).then(ok)
    return b
  }
  stub.from = (table: string) => rows(table)
  stub.rpc = (name: string, args?: unknown) => {
    if (name === 'task_note_taggable') return Promise.resolve({ data: [], error: null })
    return rpc(name, args)
  }
  return { supabase: stub }
})
vi.mock('../../hooks/useAuth', async (orig) => ({
  ...(await orig<typeof import('../../hooks/useAuth')>()),
  useOptionalAuth: () => ({ role: db.role, user: { id: 'u-luis' } }),
}))
vi.mock('../../lib/notes/testNoteDeleteIo', () => ({
  deleteTestTaskComment: async (eventId: string) => {
    if (db.refuse) throw db.refuse
    db.deleted.push(eventId)
  },
}))

import { ChecklistItemActivity } from './ChecklistItemActivity'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const ZZ_ITEM = { id: 'item-1', title: 'ZZ Test comment task', created_at: '2026-11-14T15:00:00Z', created_by_user_id: 'u-dana' }
const REAL_ITEM = { ...ZZ_ITEM, title: 'Sweep the shop bays' }

async function mount(item = ZZ_ITEM) {
  renderWithProviders(<ChecklistItemActivity item={item} authUserId="u-luis" showInstanceDays={false} setError={vi.fn()} commentInstanceId="inst-1" onPosted={vi.fn()} />)
  await screen.findByText(/ZZ walk comment/)
}

beforeEach(() => {
  db.role = 'dev'
  db.deleted = []
  db.refuse = null
})
afterEach(cleanup)

describe('ChecklistItemActivity: deleting a test task’s comment (punch list #443, row 13)', () => {
  it('a dev deletes a comment on a ZZ task after a confirm that names the author and the act, and the line leaves', async () => {
    await mount()
    // One press, on the comment alone: the app's own completed line offers none.
    const presses = screen.getAllByTestId('task-comment-delete')
    expect(presses).toHaveLength(1)
    expect(presses[0]!.getAttribute('aria-disabled')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'Delete… Dana Whitlock’s comment' }))
    const yes = await screen.findByRole('button', { name: 'Delete the comment' })
    expect(screen.getByText('Delete Dana Whitlock’s comment?')).toBeTruthy()
    expect(db.deleted).toEqual([])
    fireEvent.click(yes)
    await waitFor(() => expect(db.deleted).toEqual(['ev-1']))
    expect(await screen.findByText('The comment was deleted.')).toBeTruthy()
    await waitFor(() => expect(screen.queryByText(/ZZ walk comment/)).toBeNull())
  })

  it('on a task that is not a test task the press is dead with its reason', async () => {
    await mount(REAL_ITEM)
    const press = screen.getByTestId('task-comment-delete')
    expect(press.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByTestId('task-comment-delete-why').textContent).toBe('Only a comment on a test task can be deleted. The task’s title must start with ZZ.')
    fireEvent.click(press)
    expect(screen.queryByRole('button', { name: 'Delete the comment' })).toBeNull()
    expect(db.deleted).toEqual([])
  })

  it('a refused delete says its reason and the line stays; nobody but a dev reads the press', async () => {
    await mount()
    db.refuse = new Error('1 tag names this as its answer. It stays.')
    fireEvent.click(screen.getByRole('button', { name: 'Delete… Dana Whitlock’s comment' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete the comment' }))
    expect(await screen.findByText('1 tag names this as its answer. It stays.')).toBeTruthy()
    expect(screen.getByText(/ZZ walk comment/)).toBeTruthy()
    cleanup()
    db.role = 'assistant'
    await mount()
    expect(screen.queryByTestId('task-comment-delete')).toBeNull()
  })
})
