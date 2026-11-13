// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeTodoCheck, BridgeTodoWindow } from './BridgeTodoCheck'
import { pctTodo } from '../../lib/bridge/callTodo'
import { NO_TODO, type TodoCard, type TodoState } from '../../lib/bridge/callTodoState'

// A made-up job and made-up people.
const dayLabel = (ymd: string): string => `Mar ${Number(ymd.slice(8))}`
const todo = pctTodo({ id: 'j301', label: '301 · Pine Row', revenueUsd: 30_000 })
const card: TodoCard = { itemId: 'i1', title: todo.title, links: [], madeYmd: '2026-03-10', dueYmd: null, who: ['Dana Reyes'], instances: [{ id: 'n1', doneYmd: null, doneBy: null }] }
const open: TodoState = { kind: 'open', card, who: 'Dana', days: 2, late: false }

describe('BridgeTodoCheck', () => {
  it('is a grey check that makes the to-do while nobody has the line', () => {
    const onMake = vi.fn()
    const onSee = vi.fn()
    renderWithProviders(<BridgeTodoCheck todo={todo} state={NO_TODO} dayLabel={dayLabel} narrow={false} onMake={onMake} onSee={onSee} />)
    expect(screen.getByTestId('bridge-week-dive-todo-state').getAttribute('data-todo-state')).toBe('none')
    fireEvent.click(screen.getByRole('button', { name: `Make a to-do: ${todo.title}` }))
    expect(onMake).toHaveBeenCalledWith(todo)
    expect(onSee).not.toHaveBeenCalled()
  })

  it('names who has it and for how long, and shows the card on a press', () => {
    const onMake = vi.fn()
    const onSee = vi.fn()
    const { unmount } = renderWithProviders(<BridgeTodoCheck todo={todo} state={open} dayLabel={dayLabel} narrow={false} onMake={onMake} onSee={onSee} />)
    expect(screen.getByTestId('bridge-week-dive-todo-state').textContent).toBe('Dana, 2 days')
    fireEvent.click(screen.getByTestId('bridge-week-dive-todo'))
    expect(onSee).toHaveBeenCalledWith(open)
    expect(onMake).not.toHaveBeenCalled()
    unmount()
    // Waited too long: the same press, marked late.
    renderWithProviders(<BridgeTodoCheck todo={todo} state={{ ...open, days: 6, late: true }} dayLabel={dayLabel} narrow onMake={onMake} onSee={onSee} />)
    expect(screen.getByTestId('bridge-week-dive-todo-state').getAttribute('data-todo-state')).toBe('late')
    expect(screen.getByTestId('bridge-week-dive-todo').style.width).toBe('44px')
  })

  it('goes back to making a to-do once the last one is finished, and says who finished it', () => {
    const onMake = vi.fn()
    renderWithProviders(<BridgeTodoCheck todo={todo} state={{ kind: 'done', card, who: 'Dana', doneYmd: '2026-03-11' }} dayLabel={dayLabel} narrow={false} onMake={onMake} onSee={() => {}} />)
    expect(screen.getByTestId('bridge-week-dive-todo-state').textContent).toBe('Dana finished Mar 11')
    fireEvent.click(screen.getByTestId('bridge-week-dive-todo'))
    expect(onMake).toHaveBeenCalledWith(todo)
  })
})

describe('BridgeTodoWindow', () => {
  it('shows the card, who has it, since when, and its lines as ticked so far', async () => {
    const onOpen = vi.fn()
    const onClose = vi.fn()
    const readLines = vi.fn(async () => ({
      criteria: [
        { id: 'k1', checklist_item_id: 'i1', roadmap_task_id: null, body: 'The job has a percent done', sort_index: 0 },
        { id: 'k2', checklist_item_id: 'i1', roadmap_task_id: null, body: 'The super has seen it', sort_index: 1 },
      ],
      checks: [{ criterion_id: 'k1', instance_id: 'n1', checked_at: '2026-03-11T15:00:00Z', checked_by: 'u1' }],
      error: null,
    }))
    renderWithProviders(<BridgeTodoWindow state={open as Extract<TodoState, { kind: 'open' }>} todayYmd="2026-03-12" dayLabel={dayLabel} readLines={readLines} onOpen={onOpen} onClose={onClose} />)
    const win = screen.getByRole('dialog', { name: 'The to-do' })
    expect(win.textContent).toContain(todo.title)
    expect(screen.getByTestId('bridge-todo-window-facts').textContent).toBe('Dana has it.Handed over Mar 10, 2 days ago.')
    await waitFor(() => expect(screen.getByTestId('bridge-todo-window-lines').textContent).toContain('The job has a percent done, ticked'))
    expect(screen.getByTestId('bridge-todo-window-lines').textContent).toContain('The super has seen it, not ticked yet')
    expect(win.textContent).toContain('Done when, 1 of 2 ticked')
    expect(readLines).toHaveBeenCalledWith('i1', ['n1'])
    fireEvent.click(screen.getByRole('button', { name: 'Open the to-do' }))
    expect(onOpen).toHaveBeenCalledWith('i1')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
