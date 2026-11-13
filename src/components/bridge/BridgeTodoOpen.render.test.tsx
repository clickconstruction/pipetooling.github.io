// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { useState } from 'react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { TodoCard, TodoState } from '../../lib/bridge/callTodoState'

// The app's own task window is stood in for: this test is about what the Bridge hands it, not what it draws.
vi.mock('../ChecklistItemEditModal', () => ({
  ChecklistItemEditModal: ({ itemId, role, onSaved, onClose }: { itemId: string | null; role: string | null; onSaved: () => void; onClose: () => void }) => (
    <div role="dialog" aria-label="Edit task" data-testid="task-window" data-item={itemId ?? ''} data-role={role ?? 'none'}>
      <button type="button" onClick={onSaved}>
        Save task
      </button>
      <button type="button" onClick={onClose}>
        Close task
      </button>
    </div>
  ),
}))

import { BridgeTodoOpen } from './BridgeTodoOpen'

// A made-up card and a made-up person.
const card: TodoCard = { itemId: 'i1', title: 'Bill 201 · Maple Lofts. $18.0k is finished and not billed.', links: [], madeYmd: '2026-03-10', dueYmd: null, who: ['Dana Reyes'], instances: [{ id: 'n1', doneYmd: null, doneBy: null }] }
const open = { kind: 'open', card, who: 'Dana', days: 2, late: false } satisfies TodoState
const readLines = async () => ({ criteria: [], checks: [], error: null })

function Page({ role, onChanged }: { role: string | null; onChanged: () => void }) {
  const [seen, setSeen] = useState<typeof open | null>(open)
  return <BridgeTodoOpen seen={seen} onSeenClose={() => setSeen(null)} todayYmd="2026-03-12" dayLabel={(ymd) => ymd} readLines={readLines} role={role} setError={() => {}} onChanged={onChanged} />
}

describe('BridgeTodoOpen', () => {
  it('goes from a blue check’s window to the app’s own task window on that card, and reads the checks again after', () => {
    const onChanged = vi.fn()
    renderWithProviders(<Page role="master_technician" onChanged={onChanged} />)
    expect(screen.getByRole('dialog', { name: 'The to-do' })).toBeTruthy()
    expect(screen.queryByTestId('task-window')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open the to-do' }))
    // The small window gives way to the task window, on the same card.
    expect(screen.queryByRole('dialog', { name: 'The to-do' })).toBeNull()
    const task = screen.getByTestId('task-window')
    expect(task.getAttribute('data-item')).toBe('i1')
    expect(task.getAttribute('data-role')).toBe('master_technician')
    // A save reads the checks again, and so does closing the window.
    fireEvent.click(screen.getByRole('button', { name: 'Save task' }))
    expect(onChanged).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Close task' }))
    expect(onChanged).toHaveBeenCalledTimes(2)
    expect(screen.queryByTestId('task-window')).toBeNull()
  })

  it('hands the task window no role for a controller, whose role it does not know', () => {
    renderWithProviders(<Page role="controller" onChanged={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open the to-do' }))
    expect(screen.getByTestId('task-window').getAttribute('data-role')).toBe('none')
  })

  it('draws nothing while no check is pressed', () => {
    renderWithProviders(<BridgeTodoOpen seen={null} onSeenClose={() => {}} todayYmd="2026-03-12" dayLabel={(ymd) => ymd} readLines={readLines} role="dev" setError={() => {}} onChanged={() => {}} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
