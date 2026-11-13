// @vitest-environment jsdom
/**
 * The roadmap's Add task window (punch list #331, PR 4): the same rows as the New task window, less the day. These
 * tests hold what is the roadmap's own: no When row, two presses on the Add row, nobody picked to start, the
 * sentence that says the stage, and the six things it hands the roadmap on Add task. Every name here is made up.
 */
import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))
vi.mock('../../lib/tasks/taskPlaceIo', () => ({
  loadRecentTaskPlaces: () => Promise.resolve([{ name: 'North gate', lat: 29.7511, lng: -98.7491, accuracyM: 8, setBy: 'u1', setAt: '2031-03-10T15:00:00Z' }]),
  loadTaskPlace: () => Promise.resolve(null),
}))
vi.mock('./TaskSpotPhotoField', () => ({
  TaskSpotPhotoField: (props: { value: unknown; onChange: (v: unknown) => void }) => (
    <button type="button" onClick={() => props.onChange({ kind: 'new', id: 'p1', blob: new Blob(['x']), previewUrl: 'blob:p1' })}>
      {props.value ? 'photo held' : 'stub: take the photo'}
    </button>
  ),
}))

vi.mock('../../lib/supabase', () => {
  // The giver's last task went to Theo, so Theo has a face. No crews.
  const rows: Record<string, unknown[]> = { checklist_items: [{ id: 't1' }], checklist_item_assignees: [{ checklist_item_id: 't1', user_id: 'theo' }] }
  function makeBuilder(table: string) {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'in', 'order', 'limit']) builder[m] = () => builder
    builder.single = () => Promise.resolve({ data: null, error: null })
    builder.maybeSingle = builder.single
    builder.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) => Promise.resolve({ data: rows[table] ?? [], error: null }).then(f, r)
    return builder
  }
  return { supabase: { from: (table: string) => makeBuilder(table) } }
})

import { ChecklistTechTreeAddTaskModal } from './ChecklistTechTreeAddTaskModal'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const USERS = [
  { id: 'rosa', name: 'Rosa', email: 'rosa@example.com' },
  { id: 'theo', name: 'Theo', email: 'theo@example.com' },
  { id: 'imani', name: 'Imani', email: 'imani@example.com' },
]

async function openWindow(extra: Partial<Parameters<typeof ChecklistTechTreeAddTaskModal>[0]> = {}) {
  const onSave = vi.fn().mockResolvedValue(true)
  const onClose = vi.fn()
  renderWithProviders(<ChecklistTechTreeAddTaskModal open groupId="g1" groupTitle="North fence" users={USERS} currentUserId="rosa" onClose={onClose} onSave={onSave} {...extra} />)
  await screen.findByRole('button', { name: 'Theo' })
  return { onSave, onClose, words: screen.getByLabelText('Task') as HTMLTextAreaElement }
}
const addKeys = () => Array.from(document.querySelectorAll('[data-add-press]')).map((b) => b.getAttribute('data-add-press'))

describe("the roadmap's Add task window (punch list #331)", () => {
  it('opens with the stage named, nobody picked, no day to set, and Add task held until the task is typed', async () => {
    const { words } = await openWindow()
    expect(document.getElementById('tech-tree-add-task-modal-title')!.textContent).toBe('Add task')
    expect(screen.getByText('Stage: North fence')).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'When' })).toBeNull()
    expect(addKeys()).toEqual(['lines', 'photo'])
    expect(screen.getByRole('button', { name: 'Me' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('status').textContent).toBe('Type the task first.')
    expect((screen.getByRole('button', { name: 'Add task' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(words, { target: { value: 'Set the corner posts' } })
    expect(screen.getByRole('status').textContent).toBe('It joins the stage North fence. Nobody has it yet.')
    expect((screen.getByRole('button', { name: 'Add task' }) as HTMLButtonElement).disabled).toBe(false)
    cleanup()
  })

  it('hands the roadmap the words, the people, the lines, the photo switch, the place and the photo of the spot', async () => {
    const { words, onSave, onClose } = await openWindow()
    fireEvent.change(words, { target: { value: '  Set the corner posts ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Theo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Me' }))
    // A pick adds a person beside the others: the giver stays on when someone else is picked first.
    expect(screen.getByRole('button', { name: 'Theo' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(await screen.findByRole('button', { name: 'North gate' }))
    fireEvent.click(screen.getByRole('button', { name: 'stub: take the photo' }))
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-add-press="lines"]')!)
    fireEvent.change(screen.getByLabelText('Done when'), { target: { value: 'Posts are plumb\nConcrete is poured' } })
    expect(screen.getByRole('status').textContent).toBe(
      'It joins the stage North fence. Theo and Rosa each get it when the stage unlocks. It has 2 Done when… lines and asks for a photo at the finish.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }))
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onSave).toHaveBeenCalledTimes(1)
    const [title, people, lines, asksForPhoto, place, photo] = onSave.mock.calls[0]!
    expect(title).toBe('Set the corner posts')
    expect(people).toEqual(['theo', 'rosa'])
    expect(lines).toEqual(['Posts are plumb', 'Concrete is poured'])
    expect(asksForPhoto).toBe(true)
    expect(place).toMatchObject({ name: 'North gate', lat: 29.7511, lng: -98.7491 })
    expect(photo).toMatchObject({ kind: 'new', id: 'p1' })
    cleanup()
  })

  it('stays open when the roadmap says the save did not take', async () => {
    const onSave = vi.fn().mockResolvedValue(false)
    const { words, onClose } = await openWindow({ onSave })
    fireEvent.change(words, { target: { value: 'Set the corner posts' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }))
    await vi.waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onClose).not.toHaveBeenCalled()
    expect(words.value).toBe('Set the corner posts')
    cleanup()
  })

  it('as an edit, opens on the task and its people, with only the words and the faces to change', async () => {
    const { words } = await openWindow({ editingTaskId: 'task-9', initialEditTitle: 'Hang the gate', initialEditAssigneeUserIds: ['imani'] })
    expect(document.getElementById('tech-tree-add-task-modal-title')!.textContent).toBe('Edit task')
    expect(words.value).toBe('Hang the gate')
    expect(screen.getByRole('button', { name: 'Imani' }).getAttribute('aria-pressed')).toBe('true')
    expect(addKeys()).toEqual([])
    expect(screen.queryByRole('group', { name: 'Place' })).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Imani gets it when the stage unlocks.')
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
    cleanup()
  })
})
