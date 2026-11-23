// @vitest-environment jsdom
/**
 * The scrolling tab row (`ScrollableTabStrip`). Two things are held here.
 *
 * - The row as Bids and the job's notes use it is the row it was: the open tab comes into view through the
 *   browser's `scrollIntoView`, the fades are plain, and no arrow is drawn.
 * - The two things the Jobs and People rows ask for under the new phone layout (v2.8288): `activePeek` keeps
 *   the open tab whole with its neighbour showing, by moving the row alone, and `edgeMarks` draws an arrow in
 *   a fade.
 *
 * jsdom lays nothing out, so the row and its tabs are given the boxes the Jobs row measured on a 393 px phone
 * as a dev on 2026-11-22: 1,024 px of tabs in a 377 px window.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { ScrollableTabStrip } from './ScrollableTabStrip'
import { PHONE_TAB_FADE_SLACK_PX, PHONE_TAB_PEEK_PX } from '../lib/phoneLayout/phoneTabRows'

const TABS: Record<string, { left: number; width: number }> = {
  'teams-summary': { left: 0, width: 111 },
  reports: { left: 111, width: 99 },
  stages: { left: 210, width: 103 },
  billing: { left: 319, width: 87 },
  'combined-labor': { left: 406, width: 83 },
  subs: { left: 489, width: 80 },
  parts: { left: 569, width: 82 },
  materials: { left: 651, width: 107 },
  'job-summary': { left: 758, width: 137 },
  inspections: { left: 901, width: 123 },
}
const CONTENT = 1024
const ROW_LEFT = 8

/** Gives the scroller and its tabs their boxes, the tabs moving left as the row scrolls. */
function layOut(viewWidth: number, contentWidth = CONTENT) {
  const isScroller = (el: HTMLElement) => el.classList.contains('tab-strip-scroll')
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return isScroller(this) ? viewWidth : 0
  })
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return isScroller(this) ? contentWidth : 0
  })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (isScroller(this)) return new DOMRect(ROW_LEFT, 0, viewWidth, 42)
    const tab = TABS[this.dataset.tabkey ?? '']
    const scroller = this.closest('.tab-strip-scroll')
    return tab && scroller ? new DOMRect(ROW_LEFT + tab.left - scroller.scrollLeft, 0, tab.width, 42) : new DOMRect()
  })
}

function Row({ active, peek, marks, slack, keys = Object.keys(TABS) }: { active: string; peek?: number; marks?: boolean; slack?: number; keys?: string[] }) {
  return (
    <ScrollableTabStrip activeKey={active} activePeek={peek} edgeMarks={marks} fadeSlack={slack} ariaLabel="Jobs tabs" align="start" gap="0">
      {keys.map((k) => (
        <button key={k} type="button" data-tabkey={k}>
          {k}
        </button>
      ))}
    </ScrollableTabStrip>
  )
}

const scrollerOf = (container: HTMLElement) => container.querySelector('.tab-strip-scroll') as HTMLElement
const fadesOf = (container: HTMLElement) => Array.from(container.querySelectorAll<HTMLElement>('[aria-hidden]'))

/** jsdom has no `scrollIntoView`. Each test gets a fresh one, so a call from the row is seen. */
let into: Mock
beforeEach(() => {
  into = vi.fn()
  Element.prototype.scrollIntoView = into
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ScrollableTabStrip as it was', () => {
  it('brings the open tab into view through the browser, and moves nothing itself', () => {
    layOut(377)
    const view = render(<Row active="materials" />)
    expect(into).toHaveBeenCalledTimes(1)
    expect(into).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
    expect((into.mock.instances[0] as HTMLElement).dataset.tabkey).toBe('materials')
    expect(scrollerOf(view.container).scrollLeft).toBe(0)
    view.rerender(<Row active="inspections" />)
    expect(into).toHaveBeenCalledTimes(2)
    expect((into.mock.instances[1] as HTMLElement).dataset.tabkey).toBe('inspections')
  })

  it('draws a plain fade at the edge that has more past it, with no arrow', () => {
    layOut(377)
    const view = render(<Row active="stages" />)
    const fades = fadesOf(view.container)
    expect(fades).toHaveLength(1)
    expect(fades[0]!.style.right).toBe('0px')
    expect(fades[0]!.style.width).toBe('28px')
    expect(fades[0]!.style.background).toBe('linear-gradient(to right, transparent, var(--bg-page))')
    expect(fades[0]!.style.display).toBe('')
    expect(fades[0]!.childElementCount).toBe(0)
    expect(view.container.querySelector('[data-edge-mark]')).toBeNull()
  })

  it('draws no fade on a row that fits', () => {
    layOut(1200)
    const view = render(<Row active="stages" />)
    expect(fadesOf(view.container)).toHaveLength(0)
  })
})

describe('ScrollableTabStrip with a peek', () => {
  it('opens on a tab far to the right, whole, with the next tab showing past it', () => {
    layOut(377)
    const scrolled = vi.spyOn(window, 'scrollTo')
    const view = render(<Row active="materials" peek={PHONE_TAB_PEEK_PX} />)
    const scroller = scrollerOf(view.container)
    // Materials ends at 758. The peek past it is 56, in a window of 377.
    expect(scroller.scrollLeft).toBe(758 + PHONE_TAB_PEEK_PX - 377)
    const box = (view.container.querySelector('[data-tabkey="materials"]') as HTMLElement).getBoundingClientRect()
    expect(box.left - ROW_LEFT).toBeGreaterThanOrEqual(0)
    expect(box.right - ROW_LEFT).toBe(377 - PHONE_TAB_PEEK_PX)
    // The row alone moves: never the page, and never through the browser's own scrollIntoView.
    expect(into).not.toHaveBeenCalled()
    expect(scrolled).not.toHaveBeenCalled()
  })

  it('leaves the row where it is when the open tab and its peek already fit', () => {
    layOut(377)
    const view = render(<Row active="stages" peek={PHONE_TAB_PEEK_PX} />)
    expect(scrollerOf(view.container).scrollLeft).toBe(0)
  })

  it('follows the open tab as it changes, and stops at either end', () => {
    layOut(377)
    const view = render(<Row active="stages" peek={PHONE_TAB_PEEK_PX} />)
    const scroller = scrollerOf(view.container)
    view.rerender(<Row active="inspections" peek={PHONE_TAB_PEEK_PX} />)
    // The last tab: the row is at its end, one past the rounded width, where a browser stops it anyway.
    expect(scroller.scrollLeft).toBe(CONTENT + 1 - 377)
    view.rerender(<Row active="subs" peek={PHONE_TAB_PEEK_PX} />)
    expect(scroller.scrollLeft).toBe(489 - PHONE_TAB_PEEK_PX)
    view.rerender(<Row active="teams-summary" peek={PHONE_TAB_PEEK_PX} />)
    expect(scroller.scrollLeft).toBe(0)
  })

  it('lights no tab and moves nothing for a value with no tab in the row', () => {
    layOut(377)
    const view = render(<Row active="billed" peek={PHONE_TAB_PEEK_PX} />)
    expect(scrollerOf(view.container).scrollLeft).toBe(0)
  })

  it('shows the open tab again when tabs land after the first draw', () => {
    layOut(377)
    const watchers: Array<() => void> = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        private readonly run: () => void
        constructor(run: () => void) {
          this.run = run
        }
        observe() {
          watchers.push(this.run)
        }
        unobserve() {}
        disconnect() {}
      },
    )
    // A role not read yet: the row is Reports alone, and the address already names Inspections.
    const view = render(<Row active="inspections" peek={PHONE_TAB_PEEK_PX} keys={['reports']} />)
    const scroller = scrollerOf(view.container)
    expect(scroller.scrollLeft).toBe(0)
    view.rerender(<Row active="inspections" peek={PHONE_TAB_PEEK_PX} />)
    // The browser tells the watcher the row grew.
    act(() => watchers.forEach((run) => run()))
    expect(scroller.scrollLeft).toBe(CONTENT + 1 - 377)
  })

  it('looks again when the row’s window changes width, and not when only the height did', () => {
    layOut(1200)
    const view = render(<Row active="materials" peek={PHONE_TAB_PEEK_PX} />)
    const scroller = scrollerOf(view.container)
    expect(scroller.scrollLeft).toBe(0)
    vi.restoreAllMocks()
    layOut(377)
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(scroller.scrollLeft).toBe(758 + PHONE_TAB_PEEK_PX - 377)
    // A phone's address bar folds away: a resize with the same width. A row slid by hand stays where it was left.
    scroller.scrollLeft = 12
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(scroller.scrollLeft).toBe(12)
  })
})

describe('ScrollableTabStrip with arrows', () => {
  it('draws an arrow at the right while more is past the right edge', () => {
    layOut(377)
    const view = render(<Row active="stages" peek={PHONE_TAB_PEEK_PX} marks />)
    const marks = Array.from(view.container.querySelectorAll('[data-edge-mark]'))
    expect(marks.map((m) => m.getAttribute('data-edge-mark'))).toEqual(['right'])
    const fade = marks[0]!.parentElement as HTMLElement
    // The arrow is no press and no words: a touch goes through it to the tab under it.
    expect(fade.getAttribute('aria-hidden')).toBe('true')
    expect(fade.style.pointerEvents).toBe('none')
    expect(fade.style.width).toBe('32px')
  })

  it('draws both arrows in the middle of the row and only the left one at its end', () => {
    layOut(377)
    const view = render(<Row active="materials" peek={PHONE_TAB_PEEK_PX} marks />)
    const sides = () => Array.from(view.container.querySelectorAll('[data-edge-mark]')).map((m) => m.getAttribute('data-edge-mark'))
    expect(sides()).toEqual(['left', 'right'])
    view.rerender(<Row active="inspections" peek={PHONE_TAB_PEEK_PX} marks />)
    expect(sides()).toEqual(['left'])
  })

  it('draws no arrow on a row that fits', () => {
    layOut(1200)
    const view = render(<Row active="stages" peek={PHONE_TAB_PEEK_PX} marks />)
    expect(view.container.querySelector('[data-edge-mark]')).toBeNull()
  })

  it('draws no arrow over an edge that hides only a tab’s padding', () => {
    // A 375 px phone: the row moves 10 px to show the tab after Pipeline. No letter of the first tab is hidden.
    layOut(359)
    const sides = (view: ReturnType<typeof render>) => Array.from(view.container.querySelectorAll('[data-edge-mark]')).map((m) => m.getAttribute('data-edge-mark'))
    const plain = render(<Row active="stages" peek={PHONE_TAB_PEEK_PX} marks />)
    expect(scrollerOf(plain.container).scrollLeft).toBe(10)
    expect(sides(plain)).toEqual(['left', 'right'])
    cleanup()
    const held = render(<Row active="stages" peek={PHONE_TAB_PEEK_PX} marks slack={PHONE_TAB_FADE_SLACK_PX} />)
    expect(scrollerOf(held.container).scrollLeft).toBe(10)
    expect(sides(held)).toEqual(['right'])
    // Once a letter is hidden the arrow is back.
    held.rerender(<Row active="billing" peek={PHONE_TAB_PEEK_PX} marks slack={PHONE_TAB_FADE_SLACK_PX} />)
    expect(scrollerOf(held.container).scrollLeft).toBe(406 + PHONE_TAB_PEEK_PX - 359)
    expect(sides(held)).toEqual(['left', 'right'])
  })
})
