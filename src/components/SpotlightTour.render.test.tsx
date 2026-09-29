// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../test/renderSmokeMocks'
import { SpotlightTour } from './SpotlightTour'
import { findBlockingOverlays } from '../lib/blockingOverlay'

const steps = [
  { anchor: 'tour-a', title: 'First stop', body: 'A.' },
  { anchor: 'tour-b', title: 'Second stop', body: 'B.', missingBody: 'Appears later.' },
]

/** jsdom draws nothing: give every element a full-viewport rect so the overlay reads as covering the page. */
function fullViewportRects(width: number, height: number) {
  return vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    top: 0, left: 0, width, height, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}),
  } as DOMRect)
}

describe('SpotlightTour', () => {
  afterEach(() => vi.restoreAllMocks())

  it('v2.4121 · the overlay covers the viewport but is exempt from the body scroll lock, so the page scrolls under the tour', () => {
    if (typeof window.matchMedia !== 'function') window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
    Element.prototype.scrollIntoView = () => {}
    fullViewportRects(1000, 700)
    renderWithProviders(
      <>
        <div data-tour="tour-a">anchor</div>
        <SpotlightTour steps={steps} onClose={() => {}} />
      </>,
    )
    const overlay = screen.getByTestId('spotlight-tour-overlay')
    expect(overlay.getAttribute('data-page-scroll')).toBe('allow')
    expect(overlay.contains(screen.getByRole('dialog', { name: 'First stop' }))).toBe(true)

    const win = { innerWidth: 1000, innerHeight: 700, getComputedStyle: (el: Element) => window.getComputedStyle(el) }
    expect(findBlockingOverlays(document, win)).toEqual([])
    // The same overlay without the valve is exactly what the lock catches — the attribute is what keeps the page free.
    overlay.removeAttribute('data-page-scroll')
    // (The hole and the card are fixed layers of their own under the stub's full-viewport rects; the overlay is the one that matters.)
    expect(findBlockingOverlays(document, win)).toContain(overlay)
  })

  it('walks Next and Back and says when a stop’s anchor is not on the page', () => {
    if (typeof window.matchMedia !== 'function') window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
    Element.prototype.scrollIntoView = () => {}
    renderWithProviders(
      <>
        <div data-tour="tour-a">anchor</div>
        <SpotlightTour steps={steps} onClose={() => {}} />
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }))
    expect(screen.getByRole('dialog', { name: 'Second stop' })).toBeTruthy()
    expect(screen.getByTestId('tour-missing').textContent).toBe('Appears later.')
    fireEvent.click(screen.getByRole('button', { name: '← Back' }))
    expect(screen.getByRole('dialog', { name: 'First stop' })).toBeTruthy()
  })
})
