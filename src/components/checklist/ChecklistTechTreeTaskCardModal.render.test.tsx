// @vitest-environment jsdom
/**
 * Render-smoke tests for the roadmap task card modal (v2.1901): activity
 * thread + composer for bridged tasks, the assign hint for unbridged ones,
 * and the collapsed edit section gated on canEditStructure.
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
  it('bridged task: stage, title, chips, and the loaded activity thread', async () => {
    renderModal()
    expect(screen.getByText('make efficient water and feeding')).toBeTruthy()
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
    fireEvent.click(screen.getByText('Post'))
    await waitFor(() => expect(postComment).toHaveBeenCalledWith('inst-1', 'auger is back'))
    await waitFor(() => expect(loadEvents.mock.calls.length).toBeGreaterThanOrEqual(2))
  })

  it('unbridged unassigned task: assign hint, no composer', () => {
    const { loadEvents } = renderModal({
      task: { id: 't2', title: 'turn 4 x 4 chart into a separator', assigneeIds: [] },
      bridge: undefined,
      chip: null,
    })
    expect(screen.getByText(/assign someone and this task lands/)).toBeTruthy()
    expect(screen.queryByPlaceholderText('Add a note…')).toBeNull()
    expect(loadEvents).not.toHaveBeenCalled()
  })

  it('non-editor: no edit section', () => {
    renderModal()
    expect(screen.queryByText(/Edit task/)).toBeNull()
  })

  it('editor: edit section expands, save passes title + assignees', async () => {
    const { onSave } = renderModal({ canEditStructure: true })
    fireEvent.click(screen.getByText(/Edit task/))
    const input = screen.getByLabelText('Task title') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'add posts and a gate' } })
    fireEvent.click(screen.getByText('Save'))
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
