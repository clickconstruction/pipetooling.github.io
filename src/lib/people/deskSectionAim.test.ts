// @vitest-environment jsdom
/**
 * The Person Desk's aim at a named section (punch list #365): it waits for the section, scrolls to it, scrolls again
 * while the sections above it settle, and lets go when the person touches the page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DESK_AIM, startDeskSectionAim } from './deskSectionAim'

/** A section whose place in the page the test moves, as a section above it growing would. */
function section(id: string, top: number) {
  const el = document.createElement('section')
  el.id = id
  let at = top
  Object.defineProperty(el, 'offsetTop', { get: () => at, configurable: true })
  const scrolls: Array<ScrollIntoViewOptions> = []
  el.scrollIntoView = ((o?: boolean | ScrollIntoViewOptions) => void scrolls.push(typeof o === 'object' ? o : {})) as typeof el.scrollIntoView
  return { el, scrolls, moveTo: (next: number) => void (at = next) }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('startDeskSectionAim', () => {
  it('scrolls to a section that is there, rings it, and takes the ring off', () => {
    const s = section('desk-dashboard_view', 900)
    document.body.append(s.el)
    const stop = startDeskSectionAim('desk-dashboard_view')
    expect(s.scrolls).toEqual([{ block: 'start', behavior: 'smooth' }])
    expect(s.el.style.boxShadow).not.toBe('')
    vi.advanceTimersByTime(DESK_AIM.ringMs)
    expect(s.el.style.boxShadow).toBe('')
    stop()
  })

  it('aims again each time the sections above it push it down, and not when nothing moved', () => {
    const s = section('desk-dashboard_view', 300)
    document.body.append(s.el)
    const stop = startDeskSectionAim('desk-dashboard_view')
    vi.advanceTimersByTime(DESK_AIM.everyMs * 2)
    expect(s.scrolls).toHaveLength(1)
    // Hours lands, then Pay: the target is pushed down twice.
    s.moveTo(520)
    vi.advanceTimersByTime(DESK_AIM.everyMs)
    s.moveTo(910)
    vi.advanceTimersByTime(DESK_AIM.everyMs)
    expect(s.scrolls).toEqual([
      { block: 'start', behavior: 'smooth' },
      { block: 'start', behavior: 'auto' },
      { block: 'start', behavior: 'auto' },
    ])
    stop()
  })

  it('waits for a section that is not drawn yet, then lands on it', () => {
    const stop = startDeskSectionAim('desk-dashboard_view')
    vi.advanceTimersByTime(600)
    // The person's role is known now, so the section draws.
    const s = section('desk-dashboard_view', 700)
    document.body.append(s.el)
    vi.advanceTimersByTime(DESK_AIM.everyMs)
    expect(s.scrolls).toEqual([{ block: 'start', behavior: 'smooth' }])
    stop()
  })

  it('gives up on a section that never draws', () => {
    const stop = startDeskSectionAim('desk-dashboard_view')
    vi.advanceTimersByTime(DESK_AIM.waitMs + DESK_AIM.everyMs)
    const s = section('desk-dashboard_view', 700)
    document.body.append(s.el)
    vi.advanceTimersByTime(DESK_AIM.everyMs * 4)
    expect(s.scrolls).toHaveLength(0)
    stop()
  })

  it('lets go once the desk has settled: a later move scrolls nothing', () => {
    const s = section('desk-dashboard_view', 300)
    document.body.append(s.el)
    const stop = startDeskSectionAim('desk-dashboard_view')
    vi.advanceTimersByTime(DESK_AIM.settleMs + DESK_AIM.everyMs)
    s.moveTo(999)
    vi.advanceTimersByTime(DESK_AIM.everyMs * 4)
    expect(s.scrolls).toHaveLength(1)
    stop()
  })

  it.each(['wheel', 'touchstart', 'pointerdown', 'keydown'])('lets go the moment the person touches the page (%s)', (hand) => {
    const s = section('desk-dashboard_view', 300)
    document.body.append(s.el)
    const stop = startDeskSectionAim('desk-dashboard_view')
    window.dispatchEvent(new Event(hand))
    s.moveTo(640)
    vi.advanceTimersByTime(DESK_AIM.everyMs * 3)
    expect(s.scrolls).toHaveLength(1)
    stop()
  })

  it('on a phone, lands the section under the pinned name row, not behind it', () => {
    const bar = document.createElement('div')
    bar.setAttribute('data-desk-head-pinned', '')
    Object.defineProperty(bar, 'offsetHeight', { get: () => 64, configurable: true })
    const s = section('desk-dashboard_view', 300)
    document.body.append(bar, s.el)
    const stop = startDeskSectionAim('desk-dashboard_view')
    expect(s.el.style.scrollMarginTop).toBe('64px')
    expect(s.scrolls).toHaveLength(1)
    stop()
    // With no pinned row, as at a desk, the section takes no margin.
    document.body.innerHTML = ''
    const t = section('desk-pay', 300)
    document.body.append(t.el)
    const stopDesk = startDeskSectionAim('desk-pay')
    expect(t.el.style.scrollMarginTop).toBe('')
    stopDesk()
  })

  it('stopped by the desk, it scrolls no more and leaves no ring', () => {
    const s = section('desk-dashboard_view', 300)
    document.body.append(s.el)
    const stop = startDeskSectionAim('desk-dashboard_view')
    stop()
    expect(s.el.style.boxShadow).toBe('')
    s.moveTo(640)
    vi.advanceTimersByTime(DESK_AIM.everyMs * 3)
    expect(s.scrolls).toHaveLength(1)
  })
})
