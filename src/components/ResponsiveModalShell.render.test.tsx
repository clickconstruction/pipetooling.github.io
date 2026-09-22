// @vitest-environment jsdom
/**
 * The modal shell's dismissal (v2.3723): a press that begins on a control inside the panel and
 * ends over the backdrop — the panel reflowed under the pointer, as the filing sheet does when
 * its link field commits on blur — is not a request to close. Only a press that began on the
 * backdrop is.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ResponsiveModalShell from './ResponsiveModalShell'

describe('ResponsiveModalShell', () => {
  it('closes on a click that began on the backdrop, and ignores one that began inside the panel', () => {
    const onClose = vi.fn()
    render(
      <ResponsiveModalShell title="File a signed contract" onRequestClose={onClose}>
        <button type="button">Record as signed</button>
      </ResponsiveModalShell>,
    )
    const overlay = screen.getByRole('dialog')
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Record as signed' }))
    fireEvent.click(overlay)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.mouseDown(overlay)
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalledTimes(1)
    // Escape still closes.
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
