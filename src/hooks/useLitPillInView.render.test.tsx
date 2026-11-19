// @vitest-environment jsdom
import { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { LIT_PRESSED, useLitPillInView } from './useLitPillInView'

/**
 * The lit pill comes into view (v2.7878). jsdom lays nothing out, so the row and its pills are
 * given the boxes a 375 px phone measured on 2026-11-18: 538 px of pills in a 222 px row.
 */
const PILLS: Record<string, { left: number; width: number }> = {
  Customers: { left: 0, width: 124 },
  'Jobs to GC': { left: 132, width: 126 },
  Subs: { left: 266, width: 76 },
  Hiring: { left: 350, width: 79 },
  Permits: { left: 437, width: 101 },
}
const ROW_LEFT = 12

function Row({ lit, pills = Object.keys(PILLS) }: { lit: string; pills?: string[] }) {
  const ref = useRef<HTMLDivElement>(null)
  useLitPillInView(ref, `${lit}:${pills.join(',')}`)
  return (
    <div ref={ref} data-testid="row">
      {pills.map((p) => (
        <button key={p} type="button" aria-current={p === lit ? 'true' : undefined}>
          {p}
        </button>
      ))}
    </div>
  )
}

/** Gives the row and its pills their boxes, the pills moving left as the row scrolls. */
function layOut(viewWidth: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.dataset.testid === 'row' ? viewWidth : 0
  })
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.dataset.testid === 'row' ? 538 : 0
  })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.dataset.testid === 'row') return new DOMRect(ROW_LEFT, 0, viewWidth, 48)
    const pill = PILLS[this.textContent ?? '']
    const row = this.parentElement
    return pill && row ? new DOMRect(ROW_LEFT + pill.left - row.scrollLeft, 0, pill.width, 48) : new DOMRect()
  })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useLitPillInView', () => {
  it('opens a phone on the lit pill, which sat past the right edge', () => {
    layOut(222)
    const scrolled = vi.spyOn(window, 'scrollTo')
    const view = render(<Row lit="Permits" />)
    const row = view.getByTestId('row')
    expect(row.scrollLeft).toBe(317)
    // One past the rounded end: a browser stops at its true end, a fraction of a pixel further on.
    // Permits now sits inside the row's 222 px, where it sat from 437 to 538.
    const box = view.getByText('Permits').getBoundingClientRect()
    expect(box.left - ROW_LEFT).toBe(120)
    expect(box.right - ROW_LEFT).toBeLessThanOrEqual(222)
    expect(scrolled).not.toHaveBeenCalled()
  })

  it('follows the lit pill when the tab changes, a peek of its neighbour showing', () => {
    layOut(222)
    const view = render(<Row lit="Permits" />)
    const row = view.getByTestId('row')
    view.rerender(<Row lit="Subs" />)
    expect(row.scrollLeft).toBe(242)
    view.rerender(<Row lit="Customers" />)
    expect(row.scrollLeft).toBe(0)
    view.rerender(<Row lit="Hiring" />)
    expect(row.scrollLeft).toBe(231)
  })

  it('looks again when the window changes width', () => {
    layOut(900)
    const view = render(<Row lit="Permits" />)
    const row = view.getByTestId('row')
    expect(row.scrollLeft).toBe(0)
    vi.restoreAllMocks()
    layOut(222)
    window.dispatchEvent(new Event('resize'))
    expect(row.scrollLeft).toBe(317)
  })

  it('reads the lit pill by the mark the row names, as a strip of toggle presses does (v2.7902)', () => {
    layOut(222)
    function Presses({ lit }: { lit: string }) {
      const ref = useRef<HTMLDivElement>(null)
      useLitPillInView(ref, lit, LIT_PRESSED)
      return (
        <div ref={ref} data-testid="row">
          {Object.keys(PILLS).map((p) => (
            <button key={p} type="button" aria-pressed={p === lit}>
              {p}
            </button>
          ))}
        </div>
      )
    }
    const view = render(<Presses lit="Permits" />)
    expect(view.getByTestId('row').scrollLeft).toBe(317)
    view.rerender(<Presses lit="Subs" />)
    expect(view.getByTestId('row').scrollLeft).toBe(242)
  })

  it('leaves the row alone when no pill is lit', () => {
    layOut(222)
    const view = render(<Row lit="Nothing" />)
    expect(view.getByTestId('row').scrollLeft).toBe(0)
  })
})
