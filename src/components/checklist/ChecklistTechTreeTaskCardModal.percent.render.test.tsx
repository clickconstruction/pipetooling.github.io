// @vitest-environment jsdom
/**
 * Task cards (#273, PR 3b): Set the % on the task card's dock. Three chips beside Done for an open task whose viewer
 * may act, the current one filled; a chip calls onSetPercent; Done takes the done path; a done task keeps its reopen press.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ChecklistTechTreeTaskCardModal } from './ChecklistTechTreeTaskCardModal'

const USERS = [{ id: 'u-robert', name: 'Robert', email: 'r@x.com' }]

function renderModal(overrides: Partial<Parameters<typeof ChecklistTechTreeTaskCardModal>[0]> = {}) {
  const onSetPercent = vi.fn().mockResolvedValue(true)
  const onToggleDone = vi.fn().mockResolvedValue(true)
  render(
    <ChecklistTechTreeTaskCardModal
      open
      task={{ id: 't1', title: 'Weld up the second set of shelves', assigneeIds: ['u-robert'] }}
      groupTitle="Shelve the containers"
      stageNumber={31}
      taskNumberLabel="31.5"
      bridge={undefined}
      chip={null}
      users={USERS}
      currentUserId="u-robert"
      canEditStructure
      loadEvents={vi.fn().mockResolvedValue([])}
      postComment={vi.fn().mockResolvedValue(true)}
      onSave={vi.fn().mockResolvedValue(true)}
      onClose={vi.fn()}
      onToggleDone={onToggleDone}
      percent={50}
      onSetPercent={onSetPercent}
      {...overrides}
    />,
  )
  return { onSetPercent, onToggleDone }
}

describe('ChecklistTechTreeTaskCardModal Set the %', () => {
  it('draws the three chips with the current one pressed, and a chip calls onSetPercent', async () => {
    const { onSetPercent } = renderModal()
    const group = screen.getByRole('group', { name: 'Set the %' })
    expect(group).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Set 50%' }) as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Set 75%' }))
    await waitFor(() => expect(onSetPercent).toHaveBeenCalledWith(75))
    expect(screen.queryByRole('button', { name: /○ Mark done/ })).toBeNull()
  })

  it('Done beside the chips takes the done path', async () => {
    const { onToggleDone } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Mark task done' }))
    await waitFor(() => expect(onToggleDone).toHaveBeenCalledTimes(1))
  })

  it('a done task keeps its reopen press and no chips', () => {
    renderModal({ done: true, percent: 100 })
    expect(screen.queryByRole('group', { name: 'Set the %' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Reopen task' })).toBeTruthy()
  })

  it('without onSetPercent the old Mark done press stays', () => {
    renderModal({ onSetPercent: undefined })
    expect(screen.queryByRole('group', { name: 'Set the %' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Mark task done' }).textContent).toContain('Mark done')
  })
})
