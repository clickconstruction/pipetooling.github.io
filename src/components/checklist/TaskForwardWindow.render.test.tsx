// @vitest-environment jsdom
/**
 * The office's Forward window on My Inbox (v2.7563): the task's words as they are, a person to pick, a press that
 * names who takes it, and a refusal kept in the window.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TaskForwardWindow } from './TaskForwardWindow'

const PEOPLE = [{ id: 'u-2', name: 'Ava' }, { id: 'u-3', name: 'Hal' }]

function draw(over: Partial<Parameters<typeof TaskForwardWindow>[0]> = {}) {
  const onForward = vi.fn()
  const onClose = vi.fn()
  render(<TaskForwardWindow title="Sort the fittings wall" people={PEOPLE} saving={false} refusal={null} onForward={onForward} onClose={onClose} {...over} />)
  return { onForward, onClose }
}

describe('TaskForwardWindow', () => {
  it('shows the task as it is and takes no new title', () => {
    draw()
    expect(screen.getByText('Sort the fittings wall')).toBeTruthy()
    expect(screen.getByText('The task goes as it is, with its notes, place and photos.')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('holds the press until a person is picked, then names them and sends their id', () => {
    const { onForward } = draw()
    const press = screen.getByRole('button', { name: 'Forward' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    fireEvent.click(press)
    expect(onForward).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Assign to'), { target: { value: 'u-3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Forward to Hal' }))
    expect(onForward).toHaveBeenCalledWith('u-3')
  })

  it('keeps a refusal in the window in its own words', () => {
    draw({ refusal: 'This task belongs to a roadmap. It is handed on from the Roadmap.' })
    expect(screen.getByRole('alert').textContent).toBe('This task belongs to a roadmap. It is handed on from the Roadmap.')
  })

  it('is dead while it saves', () => {
    draw({ saving: true })
    expect((screen.getByRole('button', { name: 'Forwarding…' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('closes on Cancel', () => {
    const { onClose } = draw()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
