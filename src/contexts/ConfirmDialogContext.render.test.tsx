// @vitest-environment jsdom
/**
 * The app-wide confirm (v2.4347): a click outside it cancels only when the press and the release
 * were both outside it. A press outside alone, a drag out of it and a drag into it leave it open —
 * the press used to cancel it on its own.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { installModalBackdropGuard } from '../lib/modalBackdropGuard'
import { ConfirmDialogProvider, useConfirmDialog, usePromptDialog } from './ConfirmDialogContext'

let answer: boolean | null = null
function Asker() {
  const confirmDialog = useConfirmDialog()
  return (
    <button type="button" onClick={() => void confirmDialog({ title: 'Remove this row?', message: 'It leaves the list.', confirmLabel: 'Remove the row' }).then((v) => (answer = v))}>
      Ask
    </button>
  )
}

let typed: string | null | undefined = undefined
function Prompter({ required }: { required?: boolean }) {
  const promptDialog = usePromptDialog()
  return (
    <button type="button" onClick={() => void promptDialog({ title: 'Why?', message: 'Say why.', confirmLabel: 'Send the reason', required }).then((v) => (typed = v))}>
      Ask why
    </button>
  )
}

let uninstall: () => void = () => undefined
afterEach(() => {
  uninstall()
  cleanup()
  answer = null
  typed = undefined
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

/** A matchMedia that answers the phone query `(max-width: 640px)` as `narrow` says. */
function stubWidth(narrow: boolean) {
  const mq = (query: string) => ({ matches: narrow && query.includes('max-width: 640px'), media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false })
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: mq })
}

describe('ConfirmDialogProvider · the presses', () => {
  it('stand 44 px tall at a phone width, so a thumb lands on them (the #389 walk measured 35.5)', () => {
    stubWidth(true)
    render(
      <ConfirmDialogProvider>
        <Asker />
      </ConfirmDialogProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
    for (const name of ['Cancel', 'Remove the row']) {
      const press = screen.getByRole('button', { name })
      expect(press.style.minHeight).toBe('44px')
      expect(press.style.padding).toBe('0.5rem 1rem')
    }
  })

  it('keep the desk look at a desk width: the same padding and no floor', () => {
    stubWidth(false)
    render(
      <ConfirmDialogProvider>
        <Asker />
      </ConfirmDialogProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
    for (const name of ['Cancel', 'Remove the row']) {
      const press = screen.getByRole('button', { name })
      expect(press.style.minHeight).toBe('')
      expect(press.style.padding).toBe('0.5rem 1rem')
    }
  })

  it('a required answer keeps its press dead and Enter still until the box holds words', async () => {
    render(
      <ConfirmDialogProvider>
        <Prompter required />
      </ConfirmDialogProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ask why' }))
    const box = screen.getByRole('textbox')
    const press = screen.getByRole<HTMLButtonElement>('button', { name: 'Send the reason' })
    expect(box.getAttribute('aria-required')).toBe('true')
    expect(press.disabled).toBe(true)
    fireEvent.keyDown(box, { key: 'Enter' })
    fireEvent.change(box, { target: { value: '   ' } })
    expect(press.disabled).toBe(true)
    fireEvent.keyDown(box, { key: 'Enter' })
    await act(async () => {})
    expect(screen.getByRole('dialog', { name: 'Why?' })).toBeTruthy()
    expect(typed).toBeUndefined()

    fireEvent.change(box, { target: { value: 'A placeholder reason' } })
    expect(press.disabled).toBe(false)
    fireEvent.keyDown(box, { key: 'Enter' })
    await act(async () => {})
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(typed).toBe('A placeholder reason')
  })

  it('an answer that is not required still goes through empty, and Cancel answers null either way', async () => {
    render(
      <ConfirmDialogProvider>
        <Prompter />
        <Prompter required />
      </ConfirmDialogProvider>,
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'Ask why' })[0]!)
    const press = screen.getByRole<HTMLButtonElement>('button', { name: 'Send the reason' })
    expect(press.disabled).toBe(false)
    expect(screen.getByRole('textbox').getAttribute('aria-required')).toBeNull()
    fireEvent.click(press)
    await act(async () => {})
    expect(typed).toBe('')

    fireEvent.click(screen.getAllByRole('button', { name: 'Ask why' })[1]!)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await act(async () => {})
    expect(typed).toBeNull()
  })
})
