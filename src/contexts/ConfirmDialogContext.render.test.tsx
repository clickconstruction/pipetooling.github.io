// @vitest-environment jsdom
/**
 * The app-wide confirm (v2.4347): a click outside it cancels only when the press and the release
 * were both outside it. A press outside alone, a drag out of it and a drag into it leave it open —
 * the press used to cancel it on its own.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { installModalBackdropGuard } from '../lib/modalBackdropGuard'
import { ConfirmDialogProvider, useConfirmDialog } from './ConfirmDialogContext'

let answer: boolean | null = null
function Asker() {
  const confirmDialog = useConfirmDialog()
  return (
    <button type="button" onClick={() => void confirmDialog({ title: 'Remove this row?', message: 'It leaves the list.' }).then((v) => (answer = v))}>
      Ask
    </button>
  )
}

let uninstall: () => void = () => undefined
afterEach(() => {
  uninstall()
  cleanup()
  answer = null
})

describe('ConfirmDialogProvider', () => {
  it('a press outside alone, a drag out and a drag in leave it open; a click outside cancels it', async () => {
    uninstall = installModalBackdropGuard(document, { isBackdropLayer: (el) => el.getAttribute('role') === 'presentation' })
    render(
      <ConfirmDialogProvider>
        <Asker />
      </ConfirmDialogProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Remove this row?' })
    const backdrop = dialog.parentElement!
    const words = screen.getByText('It leaves the list.')

    fireEvent.mouseDown(backdrop)
    fireEvent.pointerDown(words)
    fireEvent.pointerUp(backdrop)
    fireEvent.click(backdrop, { detail: 1 })
    fireEvent.pointerDown(backdrop)
    fireEvent.pointerUp(words)
    fireEvent.click(backdrop, { detail: 1 })
    await act(async () => {})
    expect(screen.getByRole('alertdialog', { name: 'Remove this row?' })).toBeTruthy()
    expect(answer).toBeNull()

    fireEvent.pointerDown(backdrop)
    fireEvent.pointerUp(backdrop)
    fireEvent.click(backdrop, { detail: 1 })
    await act(async () => {})
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(answer).toBe(false)
  })
})
