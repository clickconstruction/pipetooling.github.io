// @vitest-environment jsdom
/**
 * Render tests for the Stages "#" micro-search chip (v2.1135): expand on
 * click, digits-only input, Enter delegates to onJump — collapse+clear on
 * success, stay open on no-match — and Esc collapses.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { StagesJobNumberJumpChip } from './StagesJobNumberJumpChip'

function open() {
  fireEvent.click(screen.getByLabelText('Jump to a job by number'))
  return screen.getByLabelText('Job number (C# or HCP) — Enter jumps to the job') as HTMLInputElement
}

describe('StagesJobNumberJumpChip', () => {
  it('expands on click, strips non-digits, and jumps on Enter (collapse + clear)', () => {
    const onJump = vi.fn(() => true)
    render(<StagesJobNumberJumpChip onJump={onJump} />)
    const input = open()
    fireEvent.change(input, { target: { value: 'x8a1 3' } })
    expect(input.value).toBe('813')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onJump).toHaveBeenCalledWith('813')
    expect(screen.queryByLabelText('Job number (C# or HCP) — Enter jumps to the job')).toBeNull()
    expect(screen.getByLabelText('Jump to a job by number')).toBeTruthy()
  })

  it('stays open (no-match state) when onJump returns false; Esc collapses', () => {
    const onJump = vi.fn(() => false)
    render(<StagesJobNumberJumpChip onJump={onJump} />)
    const input = open()
    fireEvent.change(input, { target: { value: '999' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onJump).toHaveBeenCalledWith('999')
    expect(input.value).toBe('999')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByLabelText('Job number (C# or HCP) — Enter jumps to the job')).toBeNull()
  })

  it('opens focused on "n" pressed anywhere, but not while typing, with a modifier, or under a dialog', () => {
    const onJump = vi.fn(() => true)
    const { unmount } = render(
      <div>
        <input aria-label="Other field" />
        <StagesJobNumberJumpChip onJump={onJump} />
      </div>,
    )
    const jumpInputQuery = () => screen.queryByLabelText('Job number (C# or HCP) — Enter jumps to the job')

    fireEvent.keyDown(screen.getByLabelText('Other field'), { key: 'n' })
    expect(jumpInputQuery()).toBeNull()
    fireEvent.keyDown(window, { key: 'n', ctrlKey: true })
    expect(jumpInputQuery()).toBeNull()

    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.appendChild(dialog)
    fireEvent.keyDown(window, { key: 'n' })
    expect(jumpInputQuery()).toBeNull()
    dialog.remove()

    fireEvent.keyDown(window, { key: 'n' })
    const input = jumpInputQuery() as HTMLInputElement
    expect(input).toBeTruthy()
    expect(document.activeElement).toBe(input)
    unmount()
  })

  it('collapses on blur only while empty and ignores Enter on empty input', () => {
    const onJump = vi.fn(() => true)
    render(<StagesJobNumberJumpChip onJump={onJump} />)
    const input = open()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onJump).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '4' } })
    fireEvent.blur(input)
    expect(screen.getByLabelText('Job number (C# or HCP) — Enter jumps to the job')).toBeTruthy()
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(screen.queryByLabelText('Job number (C# or HCP) — Enter jumps to the job')).toBeNull()
  })
})
