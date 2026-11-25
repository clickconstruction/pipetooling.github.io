// @vitest-environment jsdom
/**
 * A toast with an action may name what it is about (v2.8603, punch list #426): a newer toast with the
 * same key takes the older one's place, so a row put away and brought back inside the undo window
 * shows one line and one Undo. Toasts with no key, or with different keys, stack as they did.
 */
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ToastProvider, useToastContext } from './ToastContext'

function Presses() {
  const { showActionToast } = useToastContext()
  const undo = { label: 'Undo', onClick: () => {} }
  return (
    <>
      <button type="button" onClick={() => showActionToast('Hidden: 88 Quarry Rd Ste 100.', undo, { key: 'my-bid:b1' })}>
        hide b1
      </button>
      <button type="button" onClick={() => showActionToast('Shown again: 88 Quarry Rd Ste 100.', undo, { key: 'my-bid:b1' })}>
        show b1
      </button>
      <button type="button" onClick={() => showActionToast('Hidden: Restroom Stalls.', undo, { key: 'my-bid:b2' })}>
        hide b2
      </button>
      <button type="button" onClick={() => showActionToast('2 reports marked opened.', undo)}>
        no key
      </button>
    </>
  )
}

const open = () =>
  render(
    <ToastProvider>
      <Presses />
    </ToastProvider>,
  )

describe('ToastContext: one toast for one thing', () => {
  it('a newer toast with the same key takes the older one\'s place', () => {
    open()
    fireEvent.click(screen.getByText('hide b1'))
    expect(screen.getByText('Hidden: 88 Quarry Rd Ste 100.')).toBeTruthy()
    fireEvent.click(screen.getByText('show b1'))
    expect(screen.queryByText('Hidden: 88 Quarry Rd Ste 100.')).toBeNull()
    expect(screen.getByText('Shown again: 88 Quarry Rd Ste 100.')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Undo' }).length).toBe(1)
  })

  it('toasts about different things, or with no key, stack as they did', () => {
    open()
    fireEvent.click(screen.getByText('hide b1'))
    fireEvent.click(screen.getByText('hide b2'))
    fireEvent.click(screen.getByText('no key'))
    fireEvent.click(screen.getByText('no key'))
    expect(screen.getByText('Hidden: 88 Quarry Rd Ste 100.')).toBeTruthy()
    expect(screen.getByText('Hidden: Restroom Stalls.')).toBeTruthy()
    expect(screen.getAllByText('2 reports marked opened.').length).toBe(2)
    expect(screen.getAllByRole('button', { name: 'Undo' }).length).toBe(4)
  })
})
