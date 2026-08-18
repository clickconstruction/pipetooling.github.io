// @vitest-environment jsdom
/**
 * Render tests for the Stages "#" micro-search chip (v2.1135): expand on
 * click, digits-only input, Enter delegates to onJump — collapse+clear on
 * success, stay open on no-match — and Esc collapses.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

describe('StagesJobNumberJumpChip paid fallback (v2.1808)', () => {
  it('fires onOpen when the field opens (click and \'n\')', () => {
    const onOpen = vi.fn()
    const { unmount } = render(<StagesJobNumberJumpChip onJump={() => true} onOpen={onOpen} />)
    open()
    expect(onOpen).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(screen.getByLabelText('Job number (C# or HCP) — Enter jumps to the job'), { key: 'Escape' })
    fireEvent.keyDown(window, { key: 'n' })
    expect(onOpen).toHaveBeenCalledTimes(2)
    unmount()
  })

  it('a promise-returning onJump shows the checking state, then collapses on resolve(true)', async () => {
    let resolveJump: (v: boolean) => void = () => {}
    const onJump = vi.fn(() => new Promise<boolean>((r) => { resolveJump = r }))
    render(<StagesJobNumberJumpChip onJump={onJump} />)
    const input = open()
    fireEvent.change(input, { target: { value: '959' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input.disabled).toBe(true)
    expect(input.title).toBe('Checking Paid in Full…')
    // Esc and blur are inert while checking — the pending jump must settle first.
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.getByLabelText('Job number (C# or HCP) — Enter jumps to the job')).toBeTruthy()
    resolveJump(true)
    await waitFor(() =>
      expect(screen.queryByLabelText('Job number (C# or HCP) — Enter jumps to the job')).toBeNull(),
    )
  })

  it('resolve(false) re-enables the field in the no-match state, digits kept', async () => {
    let resolveJump: (v: boolean) => void = () => {}
    const onJump = vi.fn(() => new Promise<boolean>((r) => { resolveJump = r }))
    render(<StagesJobNumberJumpChip onJump={onJump} />)
    const input = open()
    fireEvent.change(input, { target: { value: '555' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    resolveJump(false)
    await waitFor(() => expect(input.disabled).toBe(false))
    expect(input.value).toBe('555')
    expect(input.title).toBe('No job matches that number')
  })
})
