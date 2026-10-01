// @vitest-environment jsdom
/**
 * The guard listens on the document in the capture phase; React listens on its root (and on each
 * portal's container). This proves the guard's stop lands before React's onClick — for a window in
 * the tree and for one drawn through a portal into document.body, the way many of the app's are.
 */
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { installModalBackdropGuard } from './modalBackdropGuard'

function Window({ portal }: { portal: boolean }) {
  const [open, setOpen] = useState(true)
  if (!open) return <p>closed</p>
  const ui = (
    <div data-testid="backdrop" onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0 }}>
      <div onClick={(e) => e.stopPropagation()}>
        <input aria-label="Name" defaultValue="Malachi Whites" />
        <canvas data-testid="pad" />
      </div>
    </div>
  )
  return portal ? createPortal(ui, document.body) : ui
}

let uninstall: () => void = () => undefined
afterEach(() => {
  uninstall()
  cleanup()
})

describe.each([
  ['in the tree', false],
  ['through a portal', true],
])('a window %s', (_label, portal) => {
  it('stays open when a drag from inside ends on the backdrop, and closes on a real click outside', () => {
    uninstall = installModalBackdropGuard(document, { isBackdropLayer: (el) => el.getAttribute('data-testid') === 'backdrop' })
    render(<Window portal={portal} />)
    const backdrop = screen.getByTestId('backdrop')
    fireEvent.pointerDown(screen.getByTestId('pad'))
    fireEvent.pointerUp(backdrop)
    fireEvent.click(backdrop, { detail: 1 })
    expect(screen.queryByText('closed')).toBeNull()
    fireEvent.pointerDown(screen.getByLabelText('Name'))
    fireEvent.pointerUp(backdrop)
    fireEvent.click(backdrop, { detail: 1 })
    expect(screen.queryByText('closed')).toBeNull()
    fireEvent.pointerDown(backdrop)
    fireEvent.pointerUp(backdrop)
    fireEvent.click(backdrop, { detail: 1 })
    expect(screen.getByText('closed')).toBeTruthy()
  })

  it('without the guard the same drag closes it (the bug)', () => {
    render(<Window portal={portal} />)
    const backdrop = screen.getByTestId('backdrop')
    fireEvent.pointerDown(screen.getByTestId('pad'))
    fireEvent.pointerUp(backdrop)
    fireEvent.click(backdrop, { detail: 1 })
    expect(screen.getByText('closed')).toBeTruthy()
  })
})
