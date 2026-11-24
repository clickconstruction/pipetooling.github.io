// @vitest-environment jsdom
/**
 * Render smoke for the mode row (punch lists #425 and #433): who it is drawn for, the three thirds in
 * order, the five seconds it shows on a visit to the Dashboard with what holds it and what sends it
 * away, the handle and the pull that bring it back, Task Mode where it stays, and what a press sends
 * through the page mode's door.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))

import { ModeRow, ModeRowThirds } from './ModeRow'
import { recordNavClick } from '../../lib/navClickTelemetry'
import { MODE_ROW_PULL_PX, MODE_ROW_WORDS } from '../../lib/modeRow'
import { MODE_ROW_AWAY_MS, MODE_ROW_DEAD_MS, MODE_ROW_OUT_MS, MODE_ROW_SHOW_MS, MODE_ROW_SWIPE_PX } from '../../lib/modeRowCount'
import type { PageMode } from '../../lib/pageMode'

/** A phone: the 640 px query matches. Without it jsdom has no `matchMedia` and the hook reads a desk. */
function onAPhone() {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

function touch(type: 'touchstart' | 'touchmove' | 'touchend', x: number, y: number) {
  const e = new Event(type, { bubbles: true })
  Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : [{ clientX: x, clientY: y }] })
  act(() => {
    document.body.dispatchEvent(e)
  })
}

/** A finger on an element. jsdom has no `PointerEvent`, and React reads the event by its name. */
function finger(type: 'pointerdown' | 'pointermove' | 'pointerup', el: Element, y = 30) {
  act(() => {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientY: y }))
  })
}

type Props = { userId: string; role: string; pathname: string; mode: PageMode; search?: string; locationKey?: string }

function draw(over: Partial<Props> = {}) {
  const setMode = vi.fn()
  const onLand = vi.fn()
  const props: Props = { userId: 'u1', role: 'master_technician', pathname: '/dashboard', mode: 'dispatch', ...over }
  const view = render(<ModeRow {...props} setMode={setMode} onLand={onLand} />)
  const redraw = (next: Partial<Props>) => view.rerender(<ModeRow {...props} {...next} setMode={setMode} onLand={onLand} />)
  return { setMode, onLand, view, redraw }
}

/** Let time pass, in its own turn, so a timer the last turn started is there to ring. */
function pass(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

/** The whole way out: the five seconds, the slide and the dead strip. */
function untilGone() {
  pass(MODE_ROW_SHOW_MS)
  pass(MODE_ROW_OUT_MS + MODE_ROW_DEAD_MS)
}

const thirds = () => screen.queryAllByRole('button').filter((b) => b.hasAttribute('data-mode-third'))
const words = () => thirds().map((b) => b.textContent)
const handle = () => screen.queryByRole('button', { name: MODE_ROW_WORDS.handle })
const row = () => document.querySelector('.modeRowOver')
const phase = () => document.querySelector('.modeRowClip')?.getAttribute('data-mode-row-phase') ?? 'gone'

describe('ModeRow', () => {
  const realMatchMedia = window.matchMedia
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    sessionStorage.clear()
    vi.mocked(recordNavClick).mockClear()
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
    // The row is a phone's: a desk has the gear menu's list in its place.
    onAPhone()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    window.matchMedia = realMatchMedia
    localStorage.clear()
    sessionStorage.clear()
  })

  it('is drawn on the Dashboard for every role but the estimator, whose first page is Bids', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'primary', 'superintendent', 'subcontractor', 'helpers']) {
      const { view } = draw({ role })
      expect(thirds().length, role).toBe(3)
      view.unmount()
    }
    const { view } = draw({ role: 'estimator' })
    expect(view.container.innerHTML).toBe('')
    view.unmount()
  })

  it('is not drawn on another page, and is on the checklist only in Task Mode', () => {
    expect(draw({ pathname: '/jobs' }).view.container.innerHTML).toBe('')
    cleanup()
    expect(draw({ pathname: '/checklist', mode: 'full' }).view.container.innerHTML).toBe('')
    cleanup()
    draw({ pathname: '/checklist', mode: 'task' })
    expect(thirds().length).toBe(3)
  })

  it('reads Task Mode, Dashboard, Job Mode, with the mode drawn filled and no mark on any third', () => {
    const { view } = draw({ mode: 'job' })
    expect(words()).toEqual(['Task Mode', 'Dashboard', 'Job Mode'])
    expect(thirds().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true'])
    expect(screen.getByRole('group', { name: MODE_ROW_WORDS.group })).toBeTruthy()
    expect(view.container.querySelector('.modeRowNew')).toBeNull()
  })

  it('reads Dispatch Mode as the Dashboard', () => {
    draw({ mode: 'dispatch' })
    expect(thirds().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false'])
  })

  it('on a desk it is not drawn for any role, in Task Mode too', () => {
    window.matchMedia = realMatchMedia
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'primary', 'superintendent', 'subcontractor', 'helpers', 'estimator']) {
      const { view } = draw({ role })
      expect(view.container.innerHTML, role).toBe('')
      view.unmount()
    }
    expect(draw({ pathname: '/checklist', mode: 'task' }).view.container.innerHTML).toBe('')
  })

  it('on the Dashboard the handle is the page’s line and the row is drawn over it, in place on the first paint', () => {
    const { view } = draw()
    expect(view.container.querySelector('[data-mode-row="tucked"]')).toBeTruthy()
    expect(handle()).toBeTruthy()
    expect(phase()).toBe('showing')
    // The clip comes before the handle, so it starts where the line's own content does.
    expect(view.container.querySelector('[data-mode-row="tucked"]')?.firstElementChild?.className).toBe('modeRowClip')
    expect(row()?.hasAttribute('data-mode-row-in')).toBe(false)
    expect(row()?.querySelector('.modeRowBar')).toBeTruthy()
    expect(row()?.querySelectorAll('.modeRowBlocks > b').length).toBe(5)
    expect((row() as HTMLElement).style.getPropertyValue('--mode-row-show-ms')).toBe(`${MODE_ROW_SHOW_MS}ms`)
  })

  it('shows for five seconds, leaves, and then only the handle is left', () => {
    draw()
    pass(MODE_ROW_SHOW_MS - 100)
    expect(phase()).toBe('showing')
    expect(thirds().length).toBe(3)
    pass(100)
    expect(phase()).toBe('leaving')
    pass(MODE_ROW_OUT_MS + MODE_ROW_DEAD_MS - 1)
    expect(phase()).toBe('leaving')
    pass(1)
    expect(phase()).toBe('gone')
    expect(thirds().length).toBe(0)
    expect(handle()).toBeTruthy()
  })

  it('does the same on every visit, and keeps nothing on the phone', () => {
    const { redraw } = draw()
    untilGone()
    expect(thirds().length).toBe(0)
    redraw({ pathname: '/jobs' })
    redraw({ pathname: '/dashboard' })
    expect(thirds().length).toBe(3)
    // Arriving from another page, the row slides down.
    expect(row()?.hasAttribute('data-mode-row-in')).toBe(true)
    untilGone()
    expect(thirds().length).toBe(0)
    expect(localStorage.length).toBe(0)
  })

  it('a sub who is off Job Mode gets the same five seconds as everyone', () => {
    draw({ role: 'subcontractor', mode: 'full' })
    expect(thirds().length).toBe(3)
    untilGone()
    expect(thirds().length).toBe(0)
    expect(handle()).toBeTruthy()
  })

  it('a page the app sends on at once takes the row with it', () => {
    const { view, redraw } = draw({ role: 'assistant' })
    expect(thirds().length).toBe(3)
    redraw({ pathname: '/dispatch-mode/schedule' })
    expect(view.container.innerHTML).toBe('')
  })

  it('a finger on the row holds it, and the count starts whole when the finger lifts', () => {
    draw()
    pass(MODE_ROW_SHOW_MS - 100)
    finger('pointerdown', row()!)
    expect(phase()).toBe('held')
    pass(MODE_ROW_SHOW_MS * 2)
    expect(phase()).toBe('held')
    finger('pointerup', row()!)
    expect(phase()).toBe('showing')
    pass(MODE_ROW_SHOW_MS - 100)
    expect(phase()).toBe('showing')
    pass(100)
    expect(phase()).toBe('leaving')
  })

  it('a keyboard’s focus inside the row holds it until the focus leaves', () => {
    draw()
    const third = thirds()[2]!
    act(() => third.focus())
    expect(phase()).toBe('held')
    pass(MODE_ROW_SHOW_MS * 2)
    expect(phase()).toBe('held')
    act(() => third.blur())
    expect(phase()).toBe('showing')
    pass(MODE_ROW_SHOW_MS)
    expect(phase()).toBe('leaving')
  })

  it('a swipe up on the row sends it away at once, and a press on its way out does nothing', () => {
    const { setMode } = draw()
    finger('pointerdown', row()!, 40)
    finger('pointermove', row()!, 40 - MODE_ROW_SWIPE_PX + 2)
    expect(phase()).toBe('held')
    finger('pointermove', row()!, 40 - MODE_ROW_SWIPE_PX)
    expect(phase()).toBe('leaving')
    expect(vi.mocked(recordNavClick)).toHaveBeenCalledWith('u1', 'master_technician', 'mode_row_sent', '#swipe')
    fireEvent.click(screen.getByRole('button', { name: 'Job Mode' }))
    expect(setMode).not.toHaveBeenCalled()
    pass(MODE_ROW_OUT_MS + MODE_ROW_DEAD_MS)
    expect(thirds().length).toBe(0)
  })

  it('a tap on the handle brings the row down, sliding, for five seconds more', () => {
    draw()
    untilGone()
    fireEvent.click(handle()!)
    expect(words()).toEqual(['Task Mode', 'Dashboard', 'Job Mode'])
    expect(row()?.hasAttribute('data-mode-row-in')).toBe(true)
    expect(vi.mocked(recordNavClick)).toHaveBeenCalledWith('u1', 'master_technician', 'mode_row_shown', '#handle')
    untilGone()
    expect(thirds().length).toBe(0)
  })

  it('a pull down at the top of the page brings the row down, a short one does not, and none is read while the row shows', () => {
    draw()
    touch('touchstart', 100, 200)
    touch('touchmove', 102, 200 + MODE_ROW_PULL_PX + 4)
    touch('touchend', 0, 0)
    expect(vi.mocked(recordNavClick)).not.toHaveBeenCalled()
    untilGone()
    touch('touchstart', 100, 200)
    touch('touchmove', 100, 200 + MODE_ROW_PULL_PX - 6)
    touch('touchend', 0, 0)
    expect(thirds().length).toBe(0)
    touch('touchstart', 100, 200)
    touch('touchmove', 102, 200 + MODE_ROW_PULL_PX + 4)
    expect(thirds().length).toBe(3)
    expect(vi.mocked(recordNavClick)).toHaveBeenCalledWith('u1', 'master_technician', 'mode_row_shown', '#pull')
  })

  it('putting the phone away takes the row off, and coming back after a minute is a visit', () => {
    draw()
    expect(thirds().length).toBe(3)
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    const turn = (to: 'hidden' | 'visible') => {
      visibility.mockReturnValue(to)
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
    }
    turn('hidden')
    expect(thirds().length).toBe(0)
    expect(handle()).toBeTruthy()
    // A glance elsewhere: back in ten seconds, the row stays out of sight.
    pass(10_000)
    turn('visible')
    expect(thirds().length).toBe(0)
    // Away a minute and more: the row comes back, sliding, for five seconds.
    turn('hidden')
    pass(MODE_ROW_AWAY_MS + 1000)
    turn('visible')
    expect(thirds().length).toBe(3)
    expect(row()?.hasAttribute('data-mode-row-in')).toBe(true)
    untilGone()
    expect(thirds().length).toBe(0)
    visibility.mockRestore()
  })

  it('a press on the Dashboard link while on the Dashboard is a visit, and a window of the page opening is not', () => {
    const { redraw } = draw({ locationKey: 'a' })
    untilGone()
    expect(thirds().length).toBe(0)
    // The page opens a window by its address: the query changed, so the row stays away.
    redraw({ locationKey: 'b', search: '?task=12' })
    expect(thirds().length).toBe(0)
    redraw({ locationKey: 'c', search: '' })
    expect(thirds().length).toBe(0)
    // The router moved and the address is what it was: the Dashboard link, pressed on the Dashboard.
    redraw({ locationKey: 'd', search: '' })
    expect(thirds().length).toBe(3)
    expect(row()?.hasAttribute('data-mode-row-in')).toBe(true)
    untilGone()
    expect(thirds().length).toBe(0)
  })

  it('in Task Mode neither a return nor the checklist link pressed again starts a count', () => {
    const { redraw } = draw({ pathname: '/checklist', mode: 'task', locationKey: 'a' })
    redraw({ pathname: '/checklist', mode: 'task', locationKey: 'b' })
    expect(document.querySelector('.modeRowClip')).toBeNull()
    pass(30_000)
    expect(thirds().length).toBe(3)
  })

  it('in Task Mode the row is a line of the page, with no handle, no bar and no count', () => {
    const { view } = draw({ pathname: '/checklist', mode: 'task' })
    expect(view.container.querySelector('[data-mode-row="row"]')).toBeTruthy()
    expect(handle()).toBeNull()
    expect(view.container.querySelector('.modeRowBar')).toBeNull()
    pass(30_000)
    expect(thirds().length).toBe(3)
    expect(thirds().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
  })

  it('a press on Job Mode goes through the door as the row, is counted, and gets a fresh five seconds', () => {
    const { setMode, onLand, redraw } = draw()
    pass(3000)
    fireEvent.click(screen.getByRole('button', { name: 'Job Mode' }))
    expect(setMode.mock.calls).toEqual([['job', true, 'row']])
    expect(onLand).not.toHaveBeenCalled()
    expect(vi.mocked(recordNavClick)).toHaveBeenCalledWith('u1', 'master_technician', 'mode_row', '#job')
    expect(vi.mocked(recordNavClick)).toHaveBeenCalledWith('u1', 'master_technician', 'job_mode_enabled', '#row')
    redraw({ mode: 'job' })
    // Three seconds had gone. The row is still there five seconds after the press, less a moment.
    pass(MODE_ROW_SHOW_MS - 100)
    expect(phase()).toBe('showing')
    expect(thirds().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true'])
    pass(100)
    expect(phase()).toBe('leaving')
    expect(localStorage.length).toBe(0)
  })

  it('a press on Dashboard from the Task Mode checklist switches both modes off, lands on the Dashboard, and the row is counted there', () => {
    const { setMode, onLand, redraw } = draw({ pathname: '/checklist', mode: 'task' })
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))
    expect(setMode.mock.calls).toEqual([
      ['task', false, 'row'],
      ['job', false, 'row'],
    ])
    expect(onLand).toHaveBeenCalledWith('/dashboard')
    redraw({ pathname: '/dashboard', mode: 'full' })
    // The row was in sight in Task Mode, so it is drawn in place and not slid down.
    expect(phase()).toBe('showing')
    expect(row()?.hasAttribute('data-mode-row-in')).toBe(false)
    untilGone()
    expect(thirds().length).toBe(0)
  })

  it('a press on the third already on does nothing', () => {
    const { setMode } = draw({ mode: 'job' })
    fireEvent.click(screen.getByRole('button', { name: 'Job Mode' }))
    expect(setMode).not.toHaveBeenCalled()
    expect(vi.mocked(recordNavClick)).not.toHaveBeenCalled()
  })

  it('the thirds alone, as the look at another person’s Task Mode draws them: Task Mode filled, and a press does nothing', () => {
    render(<ModeRowThirds on="task" />)
    expect(words()).toEqual(['Task Mode', 'Dashboard', 'Job Mode'])
    expect(thirds().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))
    expect(thirds().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
  })
})
