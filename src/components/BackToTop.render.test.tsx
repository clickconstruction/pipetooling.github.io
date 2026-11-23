// @vitest-environment jsdom
/**
 * Render smokes for the Back to top press (v2.8334): it shows at the foot of a long page and not of a short
 * one, a press sends the window to the top (a glide, or at once for reduced motion) and moves focus there,
 * and it follows the page as the page grows.
 */
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BackToTop } from './BackToTop'

const scrollTo = vi.fn()
let pageHeight = 0
let reduced = false
let observed: (() => void) | null = null

beforeEach(() => {
  cleanup()
  scrollTo.mockReset()
  reduced = false
  observed = null
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 })
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, get: () => pageHeight })
  vi.stubGlobal('scrollTo', scrollTo)
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('prefers-reduced-motion') ? reduced : false, media: q, addEventListener: () => {}, removeEventListener: () => {} }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: () => void) {
        observed = cb
      }
      observe() {}
      disconnect() {}
    },
  )
})
afterEach(() => vi.unstubAllGlobals())

function draw() {
  const topRef = createRef<HTMLDivElement>()
  const onPress = vi.fn()
  const utils = render(
    <div>
      <div ref={topRef} tabIndex={-1} data-testid="top" />
      <BackToTop topRef={topRef} onPress={onPress} />
    </div>,
  )
  return { ...utils, onPress }
}

describe('BackToTop', () => {
  it('a long page ends on the press: muted words, an arrow for the eye, a thumb tall, in the page’s flow', () => {
    pageHeight = 6000
    draw()
    const press = screen.getByRole('button', { name: 'Back to top' })
    expect(press.style.minHeight).toBe('44px')
    expect(press.style.color).toBe('var(--text-muted)')
    // Quiet: no fill, and nothing pinned over the page.
    expect(press.style.background).toBe('none')
    expect(press.style.backgroundColor).toBe('')
    const box = press.closest('[data-back-to-top]') as HTMLElement
    expect(box.style.position).toBe('')
    expect(box.style.justifyContent).toBe('center')
    expect(press.querySelector('[aria-hidden="true"]')!.textContent).toBe('↑')
  })

  it('a page under two screens draws no press', () => {
    pageHeight = 1500
    const { container } = draw()
    expect(screen.queryByRole('button', { name: 'Back to top' })).toBeNull()
    expect(container.querySelector('[data-back-to-top]')).toBeNull()
  })

  it('a press glides the window to the top, moves focus there and tells the host', () => {
    pageHeight = 6000
    const { onPress } = draw()
    fireEvent.click(screen.getByRole('button', { name: 'Back to top' }))
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'smooth' })
    expect(document.activeElement).toBe(screen.getByTestId('top'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('with less motion asked for, the page jumps at once', () => {
    pageHeight = 6000
    reduced = true
    draw()
    fireEvent.click(screen.getByRole('button', { name: 'Back to top' }))
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
  })

  it('follows the page: it appears once the cards have loaded and the page is long, and goes when the page folds short', () => {
    pageHeight = 900
    draw()
    expect(screen.queryByRole('button', { name: 'Back to top' })).toBeNull()
    pageHeight = 5000
    act(() => observed?.())
    expect(screen.getByRole('button', { name: 'Back to top' })).toBeTruthy()
    pageHeight = 1000
    act(() => observed?.())
    expect(screen.queryByRole('button', { name: 'Back to top' })).toBeNull()
  })
})
