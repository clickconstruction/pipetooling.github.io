// @vitest-environment jsdom
/**
 * The modal shell's dismissal (v2.3723): a press that begins on a control inside the panel and
 * ends over the backdrop — the panel reflowed under the pointer, as the filing sheet does when
 * its link field commits on blur — is not a request to close. Only a press that began on the
 * backdrop is.
 *
 * The full-screen toggle (v2.4045): given a `fullScreenKey`, the title bar carries a button that
 * flips the panel between its window and the whole screen, names the other state, and remembers
 * the choice per key; without the key there is no button.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ResponsiveModalShell from './ResponsiveModalShell'
import { modalFullScreenStorageKey } from '../lib/modalFullScreen'

beforeEach(() => {
  // jsdom has no matchMedia; the shell asks it whether this is a phone (≤640px). Desktop here.
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }))
  window.localStorage.clear()
})

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
    // No key, no toggle.
    expect(screen.queryByTestId('modal-full-screen-toggle')).toBeNull()
  })

  it('the full-screen toggle flips the panel, names the other state, hands children the state, and remembers the choice (v2.4045)', () => {
    const onClose = vi.fn()
    const { unmount } = render(
      <ResponsiveModalShell title="Contract sweep" onRequestClose={onClose} fullScreenKey="contract-sweep" maxWidthDesktop={1100}>
        {({ fullScreen }) => <div data-testid="body">{fullScreen ? 'three columns' : 'two columns'}</div>}
      </ResponsiveModalShell>,
    )
    const panel = screen.getByRole('dialog').firstElementChild as HTMLElement
    expect(panel.className).toBe('respModalPanel')
    expect(panel.style.width).toBe('min(1100px, 100%)')
    expect(screen.getByTestId('body').textContent).toBe('two columns')

    const toggle = screen.getByRole('button', { name: 'Full screen' })
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(toggle)
    expect(panel.className).toBe('respModalPanel respModalPanelFull')
    expect(panel.style.width).toBe('100%')
    expect(screen.getByTestId('body').textContent).toBe('three columns')
    expect(screen.getByRole('button', { name: 'Back to a window' }).getAttribute('aria-pressed')).toBe('true')
    expect(window.localStorage.getItem(modalFullScreenStorageKey('contract-sweep'))).toBe('1')
    // Escape closes — it does not leave full screen.
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(panel.className).toBe('respModalPanel respModalPanelFull')

    // Opened again, it comes back the way it was left.
    unmount()
    render(
      <ResponsiveModalShell title="Contract sweep" onRequestClose={onClose} fullScreenKey="contract-sweep">
        <div>again</div>
      </ResponsiveModalShell>,
    )
    expect(screen.getByRole('button', { name: 'Back to a window' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to a window' }))
    expect(window.localStorage.getItem(modalFullScreenStorageKey('contract-sweep'))).toBeNull()
    expect(screen.getByRole('button', { name: 'Full screen' })).toBeTruthy()
  })
})
