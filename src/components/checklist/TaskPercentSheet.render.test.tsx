// @vitest-environment jsdom
/**
 * Task cards (#273, PR 3): the % sheet. The three chips, the what-is-left line and Set; Done under them; a card with
 * lines gets no chips and the words that say why; Escape and × close it.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TaskPercentSheet } from './TaskPercentSheet'
import { ringState } from '../../lib/taskProgress'

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))

function renderSheet(over: Partial<Parameters<typeof TaskPercentSheet>[0]> = {}) {
  const onSet = vi.fn().mockResolvedValue(true)
  const onDone = vi.fn().mockResolvedValue(undefined)
  const onClose = vi.fn()
  render(
    <TaskPercentSheet
      open
      title="Clear the back half of the floor"
      state={ringState({ completedAt: null, percentComplete: 50, lines: 0, ticked: 0 })}
      lastMoved="was 50% on Tue 3:12 PM"
      onSet={onSet}
      onDone={onDone}
      onClose={onClose}
      {...over}
    />,
  )
  return { onSet, onDone, onClose }
}

describe('TaskPercentSheet', () => {
  it('sets a percent with the what-is-left words and closes', async () => {
    const { onSet, onClose } = renderSheet()
    expect(screen.getByRole('dialog', { name: 'Where does it stand?' })).toBeTruthy()
    expect(screen.getByText(/was 50% on Tue/)).toBeTruthy()
    const set = screen.getByRole('button', { name: 'Pick a percent' }) as HTMLButtonElement
    expect(set.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '75' }))
    fireEvent.change(screen.getByLabelText('What is left'), { target: { value: 'puddy and the glue' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set 75%' }))
    await waitFor(() => expect(onSet).toHaveBeenCalledWith(75, 'puddy and the glue'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('Done takes the done path and closes', async () => {
    const { onDone, onClose } = renderSheet()
    fireEvent.click(screen.getByRole('button', { name: '✓ Done' }))
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('a card with lines gets no chips, only the words and Done', () => {
    renderSheet({ state: ringState({ completedAt: null, percentComplete: 0, lines: 3, ticked: 2 }) })
    expect(screen.getByTestId('task-percent-sheet-derived').textContent).toContain('2 of 3 ticked reads 67%')
    expect(screen.queryByRole('button', { name: '75' })).toBeNull()
    expect(screen.getByRole('button', { name: '✓ Done' })).toBeTruthy()
  })

  it('closes on × and on Escape', () => {
    const { onClose } = renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
