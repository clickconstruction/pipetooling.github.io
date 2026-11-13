// @vitest-environment jsdom
/**
 * Render smokes for a window's shared close press: it is found by the name the window gives it (*Close* when the
 * window gives none), it closes on a press, it wears the class that carries its hover and focus looks, and its
 * icon stays out of the name.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import WindowCloseButton from './WindowCloseButton'

describe('WindowCloseButton', () => {
  it('is named Close, and a press closes the window', () => {
    const onClose = vi.fn()
    render(<WindowCloseButton onClose={onClose} />)
    const press = screen.getByRole('button', { name: 'Close' })
    expect(press.getAttribute('type')).toBe('button')
    fireEvent.click(press)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps the name a window already gave its close press', () => {
    render(<WindowCloseButton onClose={() => {}} label="Close pay speeds breakdown" />)
    expect(screen.getByRole('button', { name: 'Close pay speeds breakdown' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })

  it('wears the class with its looks, takes placement from the window, and hides its icon from the name', () => {
    render(<WindowCloseButton onClose={() => {}} style={{ marginLeft: 'auto' }} />)
    const press = screen.getByRole('button', { name: 'Close' })
    expect(press.className).toBe('windowClose')
    expect(press.style.marginLeft).toBe('auto')
    expect(press.textContent).toBe('')
    expect(press.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })
})
