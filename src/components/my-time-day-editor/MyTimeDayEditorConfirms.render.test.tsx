// @vitest-environment jsdom
/**
 * v2.3919: the My Time day editor's Not-coming-in button and confirm, and its discard confirm, as
 * components. Pins each seam — closed renders nothing; open reads its words; the buttons and the
 * backdrop call the editor's callbacks; a busy Not-coming-in holds every way out.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { MyTimeDiscardChangesConfirm } from './MyTimeDiscardChangesConfirm'
import { MyTimeNotComingInButton, MyTimeNotComingInConfirm } from './MyTimeNotComingInConfirm'

afterEach(() => {
  cleanup()
})

describe('MyTimeNotComingInButton', () => {
  it('reads "Not coming in" and calls the editor on a click', () => {
    const onClick = vi.fn()
    renderWithProviders(<MyTimeNotComingInButton busy={false} onClick={onClick} />)
    const button = screen.getByRole('button', { name: 'Not coming in' }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
    expect(button.title).toBe('Add unpaid day off; they can still clock in')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is held while the editor saves, keeping its label', () => {
    renderWithProviders(<MyTimeNotComingInButton busy={false} disabled onClick={() => {}} />)
    expect((screen.getByRole('button', { name: 'Not coming in' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('is held and reads "…" while the mark is in flight', () => {
    renderWithProviders(<MyTimeNotComingInButton busy onClick={() => {}} />)
    expect((screen.getByRole('button', { name: '…' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('MyTimeNotComingInConfirm', () => {
  it('closed renders nothing', () => {
    const { container } = renderWithProviders(
      <MyTimeNotComingInConfirm open={false} busy={false} onCancel={() => {}} onConfirm={() => {}} zIndex={1320} />
    )
    expect(container.textContent).toBe('')
  })

  it('open says what it does, and wires both buttons and the backdrop', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    renderWithProviders(
      <MyTimeNotComingInConfirm open busy={false} onCancel={onCancel} onConfirm={onConfirm} zIndex={1320} />
    )
    const dialog = screen.getByRole('dialog', { name: 'Not coming in' })
    expect(dialog.textContent).toContain('This adds unpaid time off on the calendar.')
    expect(dialog.textContent).toContain('They can still clock in if plans change.')

    fireEvent.click(screen.getByRole('button', { name: 'Mark not coming in' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)

    fireEvent.mouseDown(dialog)
    expect(onCancel).toHaveBeenCalledTimes(1)
    fireEvent.mouseDown(screen.getByRole('presentation'))
    expect(onCancel).toHaveBeenCalledTimes(2)
  })

  it('sits at the z-index the editor hands it', () => {
    renderWithProviders(
      <MyTimeNotComingInConfirm open busy={false} onCancel={() => {}} onConfirm={() => {}} zIndex={1320} />
    )
    expect(screen.getByRole('presentation').style.zIndex).toBe('1320')
  })

  it('busy holds both buttons and the backdrop', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    renderWithProviders(<MyTimeNotComingInConfirm open busy onCancel={onCancel} onConfirm={onConfirm} zIndex={1320} />)
    const confirm = screen.getByRole('button', { name: '…' }) as HTMLButtonElement
    const cancel = screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    expect(cancel.disabled).toBe(true)
    fireEvent.click(confirm)
    fireEvent.click(cancel)
    fireEvent.mouseDown(screen.getByRole('presentation'))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })
})

describe('MyTimeDiscardChangesConfirm', () => {
  const base = { personLabel: 'Dana Ruiz', dateLabel: 'Monday, January 5, 2026', zIndex: 1320 }

  it('closed renders nothing', () => {
    const { container } = renderWithProviders(
      <MyTimeDiscardChangesConfirm {...base} open={false} onKeepEditing={() => {}} onDiscard={() => {}} />
    )
    expect(container.textContent).toBe('')
  })

  it('open names the person and the day, and wires both buttons and the backdrop', () => {
    const onKeepEditing = vi.fn()
    const onDiscard = vi.fn()
    renderWithProviders(
      <MyTimeDiscardChangesConfirm {...base} open onKeepEditing={onKeepEditing} onDiscard={onDiscard} />
    )
    const dialog = screen.getByRole('alertdialog', { name: 'Discard unsaved changes?' })
    expect(dialog.textContent).toContain(
      'You have unsaved changes to Dana Ruiz’s time for Monday, January 5, 2026. Closing now will discard them.'
    )
    expect(screen.getByRole('presentation').style.zIndex).toBe('1320')

    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(onDiscard).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(onKeepEditing).toHaveBeenCalledTimes(1)

    fireEvent.mouseDown(dialog)
    expect(onKeepEditing).toHaveBeenCalledTimes(1)
    fireEvent.mouseDown(screen.getByRole('presentation'))
    expect(onKeepEditing).toHaveBeenCalledTimes(2)
    expect(onDiscard).toHaveBeenCalledTimes(1)
  })
})
