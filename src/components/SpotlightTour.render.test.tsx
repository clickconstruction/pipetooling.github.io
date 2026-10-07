// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
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

  it('GC mode, the tour round five: a tour without onStep renders exactly as before, stop by stop', () => {
    // Recorded on the tour before onStep and its second look existed: every other tour must still draw these.
    if (typeof window.matchMedia !== 'function') window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
    Element.prototype.scrollIntoView = () => {}
    fullViewportRects(1000, 700)
    const { unmount } = renderWithProviders(
      <>
        <div data-tour="tour-a">anchor</div>
        <SpotlightTour steps={steps} onClose={() => {}} />
      </>,
    )
    expect(document.body.innerHTML).toMatchSnapshot('the first stop, its anchor on the page')
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }))
    expect(document.body.innerHTML).toMatchSnapshot('Next, onto a stop whose anchor is not on the page')
    fireEvent.click(screen.getByRole('button', { name: '← Back' }))
    expect(document.body.innerHTML).toMatchSnapshot('Back to the first stop')
    unmount()
  })
})

/** A page that opens what a stop needs when the tour says so: stop 2's anchor draws `arriveAfter` ms after onStep(1). */
function OpeningPage({ arriveAfter, heard }: { arriveAfter: number | null; heard: { index: number; showing: string | null }[] }) {
  const [b, setB] = useState(false)
  return (
    <>
      <div data-tour="tour-a">anchor</div>
      {b && <div data-tour="tour-b">later</div>}
      <SpotlightTour
        steps={steps}
        onClose={() => {}}
        onStep={(i) => {
          // What the card shows at the moment the page hears the stop: the stop before it, not yet the new one.
          heard.push({ index: i, showing: document.querySelector('[role="dialog"]')?.getAttribute('aria-label') ?? null })
          if (i === 1 && arriveAfter != null) window.setTimeout(() => setB(true), arriveAfter)
        }}
      />
    </>
  )
}

describe('SpotlightTour with onStep (GC mode, the tour round five)', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })
  const setUp = () => {
    if (typeof window.matchMedia !== 'function') window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
    Element.prototype.scrollIntoView = () => {}
  }
  const hole = () => [...document.querySelectorAll<HTMLElement>('[data-testid="spotlight-tour-overlay"] > div')].some((d) => d.style.boxShadow.includes('200vmax'))
  /** One look at a time: act flushes each look's render before the next look's timer is set, as a browser does. */
  const looks = (n: number) => {
    for (let i = 0; i < n; i++) act(() => vi.advanceTimersByTime(120))
  }

  it('the page hears each stop before it shows: on open, Next, Back and the arrow keys', () => {
    setUp()
    const heard: { index: number; showing: string | null }[] = []
    renderWithProviders(<OpeningPage arriveAfter={0} heard={heard} />)
    // On open the page hears the first stop once, as it draws.
    expect(heard).toEqual([{ index: 0, showing: 'First stop' }])
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }))
    expect(heard[1]).toEqual({ index: 1, showing: 'First stop' })
    expect(screen.getByRole('dialog', { name: 'Second stop' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '← Back' }))
    expect(heard[2]).toEqual({ index: 0, showing: 'Second stop' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(heard.slice(3).map((h) => h.index)).toEqual([1, 0])
  })

  it('an anchor that draws a moment after the stop is found and lit, never shown as missing', () => {
    setUp()
    vi.useFakeTimers()
    renderWithProviders(<OpeningPage arriveAfter={200} heard={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }))
    // Looking again: no Missing line yet.
    expect(screen.queryByTestId('tour-missing')).toBeNull()
    looks(3)
    expect(document.querySelector('[data-tour="tour-b"]')).toBeTruthy()
    expect(screen.queryByTestId('tour-missing')).toBeNull()
    expect(hole()).toBe(true)
  })

  it('an anchor that never comes says Missing after about a second', () => {
    setUp()
    vi.useFakeTimers()
    renderWithProviders(<OpeningPage arriveAfter={null} heard={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }))
    // Seven looks, 840 ms: still looking.
    looks(7)
    expect(screen.queryByTestId('tour-missing')).toBeNull()
    // The eighth, near a second: Missing.
    looks(1)
    expect(screen.getByTestId('tour-missing').textContent).toBe('Appears later.')
    expect(hole()).toBe(false)
  })
})
