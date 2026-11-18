// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { useNavRowFit } from './useNavRowFit'

/**
 * The phone header's one line (the owner's ask of 2026-11-18): the wiring from the measured row to what the
 * header draws. jsdom lays nothing out, so every element's width comes from the stub below, keyed by a mark on
 * the element, and the row's width is the window the case sets.
 */
let windowPx = 375
const PARTS: Record<string, number> = { left: 114, colour: 35, gear: 36, wrench: 36, people: 36 }

function stubRects() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    let width = 0
    if (this.tagName === 'NAV') width = windowPx
    else if (this.id === 'cluster') width = 36 + (this.querySelector('[data-nav-row-press="people"]') ? 38 : 0)
    else width = PARTS[this.getAttribute('data-w') ?? ''] ?? 0
    return { width, height: 36, top: 0, left: 0, right: width, bottom: 36, x: 0, y: 0, toJSON: () => ({}) }
  })
}

function Header({ active = true, contentKey = '' }: { active?: boolean; contentKey?: string }) {
  const navRef = useRef<HTMLElement | null>(null)
  const fit = useNavRowFit(navRef, active, { wrench: true, people: true, customers: false }, contentKey)
  return (
    <nav ref={navRef} style={{ padding: '12px 8px' }} data-tight={fit.tight ? 'yes' : 'no'}>
      <div data-nav-row-left data-w="left" />
      <span data-nav-row-right>
        {!fit.inMenu.includes('wrench') && <span data-nav-row-press="wrench" data-w="wrench" data-testid="row-wrench" />}
        <button data-w="colour" />
        <button data-w="colour" />
        <button data-w="colour" />
        <span id="cluster">
          {!fit.inMenu.includes('people') && <a data-nav-row-press="people" data-w="people" data-testid="row-people" />}
          <div data-w="gear" />
        </span>
      </span>
      <ul data-testid="gear-menu">
        {fit.inMenu.map((press) => (
          <li key={press}>{press}</li>
        ))}
      </ul>
    </nav>
  )
}

const menu = () => Array.from(screen.getByTestId('gear-menu').children).map((li) => li.textContent)

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
  windowPx = 375
})

describe('useNavRowFit', () => {
  it('keeps both presses on a row with room', () => {
    stubRects()
    windowPx = 430
    render(<Header />)
    expect(screen.queryByTestId('row-wrench')).not.toBeNull()
    expect(screen.queryByTestId('row-people')).not.toBeNull()
    expect(menu()).toEqual([])
  })

  it('draws the wrench in the menu on a 375 px phone, before the first paint', () => {
    stubRects()
    windowPx = 375
    render(<Header />)
    expect(screen.queryByTestId('row-wrench')).toBeNull()
    expect(screen.queryByTestId('row-people')).not.toBeNull()
    expect(menu()).toEqual(['wrench'])
  })

  it('draws the people press in the menu too on a 320 px phone', () => {
    stubRects()
    windowPx = 320
    render(<Header />)
    expect(screen.queryByTestId('row-wrench')).toBeNull()
    expect(screen.queryByTestId('row-people')).toBeNull()
    expect(menu()).toEqual(['wrench', 'people'])
  })

  it('brings a press back when the window widens, by the width it had on the row', () => {
    stubRects()
    windowPx = 320
    render(<Header />)
    expect(menu()).toEqual(['wrench', 'people'])
    windowPx = 360
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(menu()).toEqual(['wrench'])
    windowPx = 430
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(menu()).toEqual([])
    expect(screen.queryByTestId('row-wrench')).not.toBeNull()
  })

  it('measures again when the row grows after mount, with no resize and no ResizeObserver', () => {
    vi.useFakeTimers()
    stubRects()
    windowPx = 375
    // Cold load: the coloured presses are not in yet, so the row fits.
    const colour = PARTS.colour
    PARTS.colour = 0
    try {
      render(<Header />)
      expect(menu()).toEqual([])
      PARTS.colour = colour as number
      act(() => {
        vi.advanceTimersByTime(1500)
      })
      expect(menu()).toEqual(['wrench'])
    } finally {
      PARTS.colour = colour as number
    }
  })

  it('measures again as soon as the content key changes', () => {
    stubRects()
    windowPx = 375
    const colour = PARTS.colour
    PARTS.colour = 0
    try {
      const { rerender } = render(<Header contentKey="|0" />)
      expect(menu()).toEqual([])
      PARTS.colour = colour as number
      rerender(<Header contentKey="dev|0" />)
      expect(menu()).toEqual(['wrench'])
    } finally {
      PARTS.colour = colour as number
    }
  })

  it('moves nothing while the desktop row is drawn, and nothing where a row cannot be measured', () => {
    stubRects()
    windowPx = 320
    const { unmount } = render(<Header active={false} />)
    expect(menu()).toEqual([])
    unmount()
    // No layout at all: the row has no width, so every press stays where it was.
    vi.restoreAllMocks()
    render(<Header />)
    expect(menu()).toEqual([])
    expect(screen.queryByTestId('row-wrench')).not.toBeNull()
  })
})
