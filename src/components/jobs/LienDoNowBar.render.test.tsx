// @vitest-environment jsdom
/**
 * Render smokes for the bar the find box pins in on the Lien desk's To do (v2.7367): the find alone until it pins,
 * the Board's numbers with their presses once it has, what a pressed bin narrowed the list to in their place, and
 * the way back. The rule is `lienDoNowFrame.test.ts` and `lienDoNowBar.test.ts`; this is the wiring.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createRef } from 'react'
import LienDoNowBar from './LienDoNowBar'
import type { LienDoNowBarPart } from '../../lib/jobs/lienDoNowBar'

afterEach(cleanup)

const PARTS: LienDoNowBarPart[] = [
  { key: 'by_day', words: '21 by tomorrow', tone: 'red', destination: null },
  { key: 'waiting', words: '3 waiting on Sam', tone: 'violet', destination: { kind: 'leader' } },
  { key: 'in_mail', words: '7 to print and mail', tone: 'amber', destination: { kind: 'run' } },
]

/** A scroller whose page has moved `scrollTop` px, with the bar at its top (`barTop` 0) or still under the Board. */
function mount(over: { pins?: boolean; pick?: { head: string; clear: string } | null; prints?: Parameters<typeof LienDoNowBar>[0]['prints'] } = {}) {
  const scrollerRef = createRef<HTMLDivElement>()
  const onPart = vi.fn()
  const onClearPick = vi.fn()
  const view = render(
    <div ref={scrollerRef} data-scroller>
      <LienDoNowBar pins={over.pins ?? true} scrollerRef={scrollerRef} parts={PARTS} onPart={onPart} pick={over.pick ?? null} onClearPick={onClearPick} prints={over.prints}>
        <input aria-label="Find on the list" />
      </LienDoNowBar>
    </div>,
  )
  const scroller = scrollerRef.current!
  const bar = () => document.querySelector('[data-lien-do-now-bar]') as HTMLElement
  /** Move the page: jsdom lays nothing out, so the two tops are given. */
  const scrollTo = (scrollTop: number, barTop: number) => {
    scroller.getBoundingClientRect = () => ({ top: 100, bottom: 800, left: 0, right: 1000, width: 1000, height: 700, x: 0, y: 100, toJSON: () => ({}) })
    bar().getBoundingClientRect = () => ({ top: barTop, bottom: barTop + 47, left: 0, right: 1000, width: 1000, height: 47, x: 0, y: barTop, toJSON: () => ({}) })
    Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: scrollTop })
    act(() => {
      fireEvent.scroll(scroller)
    })
  }
  return { view, scroller, bar, scrollTo, onPart, onClearPick }
}

describe('LienDoNowBar', () => {
  it('is the find box alone until the page brings it to the top', () => {
    const { bar, scrollTo } = mount()
    expect(bar().getAttribute('data-pins')).toBe('yes')
    expect(bar().style.position).toBe('sticky')
    expect(bar().getAttribute('data-stuck')).toBe('no')
    expect(document.querySelector('[data-lien-do-now-bar-extras]')).toBeNull()
    expect(document.querySelector('input[aria-label="Find on the list"]')).not.toBeNull()
    // The Board is still above it: nothing more to say.
    scrollTo(300, 414)
    expect(bar().getAttribute('data-stuck')).toBe('no')
    expect(document.querySelector('[data-lien-do-now-bar-extras]')).toBeNull()
  })

  it('pinned, it says the Board’s numbers; a number with a door is its tile’s press, and ↑ The Board goes back', () => {
    const { bar, scrollTo, scroller, onPart } = mount()
    scrollTo(700, 100)
    expect(bar().getAttribute('data-stuck')).toBe('yes')
    const parts = document.querySelector('[data-lien-do-now-bar-parts]') as HTMLElement
    expect(parts.textContent).toBe('21 by tomorrow·3 waiting on Sam·7 to print and mail')
    // The day's count only reads; the other two are presses to where their tiles go.
    expect(document.querySelector('[data-lien-do-now-bar-part="by_day"]')!.tagName).toBe('SPAN')
    fireEvent.click(document.querySelector('button[data-lien-do-now-bar-part="waiting"]') as HTMLButtonElement)
    expect(onPart).toHaveBeenCalledWith({ kind: 'leader' })
    fireEvent.click(document.querySelector('button[data-lien-do-now-bar-part="in_mail"]') as HTMLButtonElement)
    expect(onPart).toHaveBeenLastCalledWith({ kind: 'run' })
    const up = document.querySelector('[data-lien-do-now-bar-up]') as HTMLButtonElement
    expect(up.textContent).toBe('↑ The Board')
    const scrolled: unknown[] = []
    scroller.scrollTo = ((o: unknown) => { scrolled.push(o) }) as typeof scroller.scrollTo
    fireEvent.click(up)
    expect(scrolled).toEqual([{ top: 0, behavior: 'smooth' }])
    // Back at the top it is the find alone again.
    scrollTo(0, 714)
    expect(bar().getAttribute('data-stuck')).toBe('no')
  })

  it('pinned over a narrowed list, it says what the list shows and puts every row back', () => {
    const { scrollTo, onClearPick } = mount({ pick: { head: 'Showing 4 rows in To send for Master approval.', clear: 'Show every row' } })
    scrollTo(700, 100)
    expect((document.querySelector('[data-lien-do-now-bar-pick]') as HTMLElement).textContent).toBe('Showing 4 rows in To send for Master approval.')
    expect(document.querySelector('[data-lien-do-now-bar-parts]')).toBeNull()
    const clear = document.querySelector('[data-lien-do-now-bar-clear]') as HTMLButtonElement
    expect(clear.textContent).toBe('Show every row')
    fireEvent.click(clear)
    expect(onClearPick).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-lien-do-now-bar-up]')).not.toBeNull()
  })

  it('where the Board stays put it never pins and never changes', () => {
    const { bar, scrollTo } = mount({ pins: false })
    expect(bar().getAttribute('data-pins')).toBe('no')
    expect(bar().style.position).toBe('')
    scrollTo(700, 100)
    expect(bar().getAttribute('data-stuck')).toBe('no')
    expect(document.querySelector('[data-lien-do-now-bar-extras]')).toBeNull()
  })

  it('pinned, it carries the Board’s two prints in short form, the notices’ first; a dead one cannot be pressed (v2.7470)', () => {
    const printNotices = vi.fn()
    const printAffidavits = vi.fn()
    const { scrollTo } = mount({ prints: [{ key: 'notice', label: 'Print and mail 8 notices', left: '7 wait', dead: false, onPress: printNotices }, { key: 'affidavit', label: 'Print for notarization', left: '2 held', dead: true, onPress: printAffidavits }] })
    // Not while the Board's own are in view.
    expect(document.querySelector('[data-lien-do-now-bar-print]')).toBeNull()
    scrollTo(700, 100)
    const prints = Array.from(document.querySelectorAll('[data-lien-do-now-bar-print]')) as HTMLButtonElement[]
    expect(prints.map((b) => [b.getAttribute('data-lien-do-now-bar-print'), b.textContent, b.disabled])).toEqual([['notice', 'Print and mail 8 notices · 7 wait', false], ['affidavit', 'Print for notarization · 2 held', true]])
    fireEvent.click(prints[0]!)
    fireEvent.click(prints[1]!)
    expect(printNotices).toHaveBeenCalledTimes(1)
    expect(printAffidavits).not.toHaveBeenCalled()
  })
})
