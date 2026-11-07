// @vitest-environment jsdom
/**
 * Task cards (#273, PR 3): the ring. Empty with no digits while untouched, the percent while it fills, ✓ once done;
 * the words a reader hears; a reading without a press.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TaskRing } from './TaskRing'
import { ringState } from '../../lib/taskProgress'

describe('TaskRing', () => {
  it('draws no digits untouched, the percent while open, and ✓ once done', () => {
    const { rerender } = render(<TaskRing state={ringState({ completedAt: null, percentComplete: 0, lines: 0, ticked: 0 })} onPress={vi.fn()} title="Clear the floor" />)
    expect(screen.getByRole('button', { name: 'Not started: Clear the floor. Set where it stands' }).textContent).toBe('')
    rerender(<TaskRing state={ringState({ completedAt: null, percentComplete: 75, lines: 0, ticked: 0 })} onPress={vi.fn()} title="Clear the floor" />)
    expect(screen.getByRole('button', { name: '75% done: Clear the floor. Set where it stands' }).textContent).toBe('75')
    rerender(<TaskRing state={ringState({ completedAt: 'x', percentComplete: 75, lines: 0, ticked: 0 })} onPress={vi.fn()} title="Clear the floor" />)
    expect(screen.getByRole('button', { name: 'Done, tap to reopen: Clear the floor' }).textContent).toBe('✓')
  })

  it('reads the ticks on a card with lines and calls the press', () => {
    const onPress = vi.fn()
    render(<TaskRing state={ringState({ completedAt: null, percentComplete: 0, lines: 3, ticked: 2 })} onPress={onPress} />)
    const b = screen.getByRole('button', { name: '67% done, 2 of 3 lines. Set where it stands' })
    expect(b.textContent).toBe('67')
    fireEvent.click(b)
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('is a reading, not a press, without onPress', () => {
    render(<TaskRing state={ringState({ completedAt: null, percentComplete: 50, lines: 0, ticked: 0 })} size={36} />)
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
  })
})
