// @vitest-environment jsdom
/**
 * Render-smoke tests for the roadmap task card (redesigned v2.1949): activity
 * thread + pinned composer for bridged tasks, tap-to-assign people chips that
 * save per tap, inline title editing, and read-only rendering for
 * non-editors.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ChecklistTechTreeTaskCardModal } from './ChecklistTechTreeTaskCardModal'
import type { ChecklistCardEvent } from '../../lib/checklistCardEvents'

const USERS = [
  { id: 'u-robert', name: 'Robert', email: 'r@x.com' },
  { id: 'u-grace', name: 'Grace', email: 'g@x.com' },
]

const EVENTS: ChecklistCardEvent[] = [
  { id: 'e1', instance_id: 'inst-1', event_type: 'comment', actor_user_id: 'u-robert', body: 'posts are in the trailer', created_at: '2026-08-20T14:00:00Z' },
  { id: 'e2', instance_id: 'inst-1', event_type: 'completed', actor_user_id: 'u-robert', body: '', created_at: '2026-08-20T15:00:00Z' },
]

function renderModal(overrides: Partial<Parameters<typeof ChecklistTechTreeTaskCardModal>[0]> = {}) {
  const loadEvents = vi.fn().mockResolvedValue(EVENTS)
  const postComment = vi.fn().mockResolvedValue(true)
  const onSave = vi.fn().mockResolvedValue(true)
  const onClose = vi.fn()
  const utils = render(
    <ChecklistTechTreeTaskCardModal
      open
      task={{ id: 't1', title: 'add posts to pig pin', assigneeIds: ['u-robert'] }}
      groupTitle="make efficient water and feeding"
      stageNumber={23}
      bridge={{ instanceCompletedAt: null, reviewedAt: null, instanceId: 'inst-1' }}
      chip="on_list"
      users={USERS}
      currentUserId="u-grace"
      canEditStructure={false}
      loadEvents={loadEvents}
      postComment={postComment}
      onSave={onSave}
      onClose={onClose}
      {...overrides}
    />,
  )
  return { ...utils, loadEvents, postComment, onSave, onClose }
}

describe('ChecklistTechTreeTaskCardModal', () => {
  it('bridged task: stage crumb + number, title, chips, and the loaded activity thread', async () => {
    renderModal()
    expect(screen.getByText('make efficient water and feeding')).toBeTruthy()
    expect(screen.getByText('23')).toBeTruthy()
    expect(screen.getByText('add posts to pig pin')).toBeTruthy()
    expect(screen.getByText('on list')).toBeTruthy()
    expect(screen.getByText('Robert')).toBeTruthy()
    await waitFor(() => expect(screen.getByText(/posts are in the trailer/)).toBeTruthy())
    expect(screen.getByText(/completed ·/)).toBeTruthy()
  })

  it('composer posts a note and reloads the thread', async () => {
    const { postComment, loadEvents } = renderModal()
    await waitFor(() => expect(screen.getByPlaceholderText('Add a note…')).toBeTruthy())
    fireEvent.change(screen.getByPlaceholderText('Add a note…'), { target: { value: 'auger is back' } })
    fireEvent.click(screen.getByLabelText('Post'))
    await waitFor(() => expect(postComment).toHaveBeenCalledWith('inst-1', 'auger is back'))
    await waitFor(() => expect(loadEvents.mock.calls.length).toBeGreaterThanOrEqual(2))
  })

  it('unbridged unassigned task (editor): assign hint + "＋ Assign someone", no composer', () => {
    const { loadEvents } = renderModal({
      task: { id: 't2', title: 'turn 4 x 4 chart into a separator', assigneeIds: [] },
      bridge: undefined,
      chip: null,
      canEditStructure: true,
    })
    expect(screen.getByText(/assign someone and this task lands/)).toBeTruthy()
    expect(screen.getByText('＋ Assign someone')).toBeTruthy()
    expect(screen.queryByPlaceholderText('Add a note…')).toBeNull()
    expect(loadEvents).not.toHaveBeenCalled()
  })

  it('non-editor: no rename button, no assign affordances', () => {
    renderModal()
    expect(screen.queryByLabelText('Rename task')).toBeNull()
    expect(screen.queryByText('＋')).toBeNull()
    expect(screen.queryByText('＋ Assign someone')).toBeNull()
    expect(screen.queryByLabelText(/Unassign/)).toBeNull()
  })

  it('editor: tapping a name in the picker saves that assignee change immediately', async () => {
    const { onSave } = renderModal({ canEditStructure: true, suggestedUserIds: ['u-robert'] })
    fireEvent.click(screen.getByText('＋'))
    // Robert is already assigned (active); Grace is in the Everyone tier
    fireEvent.click(screen.getByText('Grace'))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('add posts to pig pin', ['u-robert', 'u-grace']))
  })

  it('editor: ✕ on an assignee chip unassigns immediately', async () => {
    const { onSave } = renderModal({ canEditStructure: true })
    fireEvent.click(screen.getByLabelText('Unassign Robert'))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('add posts to pig pin', []))
  })

  it('editor: inline title edit saves on submit (Enter) with assignees preserved', async () => {
    const { onSave } = renderModal({ canEditStructure: true })
    // v2.2303: the title itself is the rename control
    fireEvent.click(screen.getByText('add posts to pig pin'))
    const input = screen.getByLabelText('Task title') as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: 'add posts and a gate' } })
    // Enter in the input triggers the browser's implicit form submission
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('add posts and a gate', ['u-robert']))
  })

  it('"Open on the checklist" closes and jumps when wired', async () => {
    const onOpenTodayTab = vi.fn()
    const { onClose } = renderModal({ onOpenTodayTab })
    await waitFor(() => expect(screen.getByText(/Open on the checklist/)).toBeTruthy())
    fireEvent.click(screen.getByText(/Open on the checklist/))
    expect(onOpenTodayTab).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})

describe('ChecklistTechTreeTaskCardModal — ★ pin (v2.2140, dock since v2.2303)', () => {
  it('editors get the dock pin square; pressed state flips to Unpin', async () => {
    const onTogglePin = vi.fn().mockResolvedValue(true)
    renderModal({ canEditStructure: true, onTogglePin })
    fireEvent.click(screen.getByRole('button', { name: 'Pin task — do this next' }))
    await waitFor(() => expect(onTogglePin).toHaveBeenCalledTimes(1))
    renderModal({ canEditStructure: true, onTogglePin, pinned: true })
    expect(screen.getByRole('button', { name: 'Unpin task' })).toBeTruthy()
  })
  it('non-editors never see the pin control', () => {
    renderModal({ canEditStructure: false, onTogglePin: vi.fn(), pinned: true })
    expect(screen.queryByRole('button', { name: /pin task/i })).toBeNull()
  })
})

describe('ChecklistTechTreeTaskCardModal — crew view + dock (v2.2303)', () => {
  it('crew: plain names line, giant DONE, one-tap replies post to the thread', async () => {
    const onToggleDone = vi.fn().mockResolvedValue(undefined)
    const { postComment, loadEvents } = renderModal({ onToggleDone })
    expect(screen.getByText('Robert')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('👍 On it')).toBeTruthy())
    fireEvent.click(screen.getByText('👍 On it'))
    await waitFor(() => expect(postComment).toHaveBeenCalledWith('inst-1', '👍 On it'))
    await waitFor(() => expect(loadEvents.mock.calls.length).toBeGreaterThanOrEqual(2))
    fireEvent.click(screen.getByRole('button', { name: 'Mark task done' }))
    // optimistic: label flips before the save resolves
    expect(screen.getByText('✓ Done · tap to undo')).toBeTruthy()
    await waitFor(() => expect(onToggleDone).toHaveBeenCalledTimes(1))
  })
  it('crew waiting task: amber explainer instead of a dead button; no quick replies without an instance', () => {
    renderModal({ bridge: undefined, chip: null, waitingAfterLabel: 'after 11.2', onToggleDone: undefined })
    expect(screen.getByText(/Waits its turn — after 11.2/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Mark task done/ })).toBeNull()
    expect(screen.queryByText('👍 On it')).toBeNull()
  })
  it('editors: quick replies are not shown; 🗑 opens the two-step confirm and Keep it backs out', async () => {
    const onDeleteTask = vi.fn().mockResolvedValue(true)
    renderModal({ canEditStructure: true, onDeleteTask })
    expect(screen.queryByText('👍 On it')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Delete task' }))
    expect(screen.getByText('Delete permanently')).toBeTruthy()
    fireEvent.click(screen.getByText('Keep it'))
    expect(screen.queryByText('Delete permanently')).toBeNull()
    expect(onDeleteTask).not.toHaveBeenCalled()
  })
})

describe('ChecklistTechTreeTaskCardModal — Mark done / Reopen (v2.2182)', () => {
  it('renders the toggle only when onToggleDone is passed, and flips its label with `done`', async () => {
    const onToggleDone = vi.fn().mockResolvedValue(true)
    renderModal({ onToggleDone })
    fireEvent.click(screen.getByRole('button', { name: 'Mark task done' }))
    await waitFor(() => expect(onToggleDone).toHaveBeenCalledTimes(1))
    renderModal({ onToggleDone, done: true })
    expect(screen.getByRole('button', { name: 'Reopen task' })).toBeTruthy()
  })
  it('without onToggleDone a done task reads done but cannot be toggled', () => {
    renderModal({ done: true })
    expect(screen.getByText('✓ done')).toBeTruthy()
    // crew still sees the big green slab, but it is inert
    const slab = screen.queryByRole('button', { name: /Reopen task/ }) as HTMLButtonElement | null
    if (slab) expect(slab.disabled).toBe(true)
  })
})
