// @vitest-environment jsdom
/**
 * Render smoke for the mode row (punch lists #425 and #433): who it is drawn for, the three thirds in
 * order, the five seconds it shows when the app opens with what holds it and what closes it, the way
 * out into the gear, the nothing it leaves in its place, the phone's switch, Task Mode where it
 * stays, and what a press sends through the page mode's door.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))

import { ModeRow, ModeRowThirds } from './ModeRow'
import { recordNavClick } from '../../lib/navClickTelemetry'
import { MODE_ROW_HOME_ATTR, MODE_ROW_WORDS } from '../../lib/modeRow'
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

/** A finger on an element. jsdom has no `PointerEvent`, and React reads the event by its name. */
function finger(type: 'pointerdown' | 'pointermove' | 'pointerup', el: Element, y = 30) {
  act(() => {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientY: y }))
  })
}

type Props = { userId: string; role: string; pathname: string; mode: PageMode; atOpen?: boolean }

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

/** The whole way out: the five seconds, the way to the gear and the dead strip. */
function untilGone() {
  pass(MODE_ROW_SHOW_MS)
  pass(MODE_ROW_OUT_MS + MODE_ROW_DEAD_MS)
}

const thirds = () => screen.queryAllByRole('button').filter((b) => b.hasAttribute('data-mode-third'))
const words = () => thirds().map((b) => b.textContent)
/** A box on the screen: jsdom lays nothing out, so a test that needs one says where it is. */
function box(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect
}
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
    // The row is a phone's: a desk has the gear menu's list alone.
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

  it('on the Dashboard the row lies over the page from a line of no height that is no banner, drawn in place when the app opens', () => {
    const { view } = draw()
    const host = view.container.querySelector('[data-mode-row="over"]')
    expect(host?.className).toBe('modeRowHost')
    // No `AppTopBanner`: the header under it keeps paying the status bar, so nothing moves.
    expect(view.container.querySelector('.appTopBanner')).toBeNull()
    expect(host?.firstElementChild?.className).toBe('modeRowClip')
    expect(phase()).toBe('showing')
    expect(row()?.hasAttribute('data-mode-row-in')).toBe(false)
    expect(row()?.querySelector('.modeRowBar')).toBeTruthy()
    expect(row()?.querySelectorAll('.modeRowBlocks > b').length).toBe(5)
    expect((row() as HTMLElement).style.getPropertyValue('--mode-row-show-ms')).toBe(`${MODE_ROW_SHOW_MS}ms`)
    expect((row() as HTMLElement).style.getPropertyValue('--mode-row-out-ms')).toBe(`${MODE_ROW_OUT_MS}ms`)
  })

  it('shows for five seconds, leaves, and then nothing is left in its place: no handle, no line', () => {
    const { view } = draw()
    pass(MODE_ROW_SHOW_MS - 100)
    expect(phase()).toBe('showing')
    expect(thirds().length).toBe(3)
    pass(100)
    expect(phase()).toBe('leaving')
    pass(MODE_ROW_OUT_MS + MODE_ROW_DEAD_MS - 1)
    expect(phase()).toBe('leaving')
    pass(1)
    expect(phase()).toBe('gone')
    expect(view.container.innerHTML).toBe('')
  })

  it('shows once for an opening: another page and back, or a pull down at the top, brings nothing', () => {
    const { view, redraw } = draw()
    untilGone()
    redraw({ pathname: '/jobs' })
    redraw({ pathname: '/dashboard' })
    expect(view.container.innerHTML).toBe('')
    for (const [type, y] of [['touchstart', 200], ['touchmove', 300], ['touchend', 300]] as const) {
      const e = new Event(type, { bubbles: true })
      Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : [{ clientX: 100, clientY: y }] })
      act(() => {
        document.body.dispatchEvent(e)
      })
    }
    pass(1000)
    expect(view.container.innerHTML).toBe('')
    expect(localStorage.length).toBe(0)
  })

  it('an app that opens on another page shows the row on its first Dashboard, once', () => {
    const { view, redraw } = draw({ pathname: '/jobs' })
    expect(view.container.innerHTML).toBe('')
    redraw({ pathname: '/dashboard' })
    expect(phase()).toBe('showing')
    expect(row()?.hasAttribute('data-mode-row-in')).toBe(false)
    untilGone()
    redraw({ pathname: '/jobs' })
    redraw({ pathname: '/dashboard' })
    expect(view.container.innerHTML).toBe('')
  })

  it('a sub who is off Job Mode gets the same five seconds as everyone', () => {
    const { view } = draw({ role: 'subcontractor', mode: 'full' })
    expect(thirds().length).toBe(3)
    untilGone()
    expect(view.container.innerHTML).toBe('')
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
    const { setMode, view } = draw()
    finger('pointerdown', row()!, 40)
    finger('pointermove', row()!, 40 - MODE_ROW_SWIPE_PX + 2)
    expect(phase()).toBe('held')
    finger('pointermove', row()!, 40 - MODE_ROW_SWIPE_PX)
    expect(phase()).toBe('leaving')
    expect(vi.mocked(recordNavClick)).toHaveBeenCalledWith('u1', 'master_technician', 'mode_row_sent', '#swipe')
    fireEvent.click(screen.getByRole('button', { name: 'Job Mode' }))
    expect(setMode).not.toHaveBeenCalled()
    pass(MODE_ROW_OUT_MS + MODE_ROW_DEAD_MS)
    expect(view.container.innerHTML).toBe('')
  })

  it('on its way out the row shrinks into the gear: it is told how far and how small, and the gear answers', () => {
    const gear = document.createElement('button')
    gear.setAttribute(MODE_ROW_HOME_ATTR, '')
    gear.getBoundingClientRect = () => box(344, 58, 36, 36)
    const answers = vi.fn()
    gear.animate = answers as unknown as typeof gear.animate
    document.body.appendChild(gear)
    try {
      draw()
      row()!.getBoundingClientRect = () => box(0, 47, 390, 60)
      pass(MODE_ROW_SHOW_MS)
      expect(phase()).toBe('leaving')
      const style = (row() as HTMLElement).style
      expect(row()?.getAttribute('data-mode-row-out')).toBe('gear')
      expect(style.getPropertyValue('--mode-row-to-x')).toBe('167px')
      expect(style.getPropertyValue('--mode-row-to-y')).toBe('-1px')
      expect(style.getPropertyValue('--mode-row-to-sx')).toBe('0.092')
      expect(style.getPropertyValue('--mode-row-to-sy')).toBe('0.6')
      // The gear answers once, as the row lands: after most of the way out, for the dead moment.
      expect(answers).toHaveBeenCalledTimes(1)
      const [frames, timing] = answers.mock.calls[0] as [Keyframe[], KeyframeAnimationOptions]
      expect(frames).toHaveLength(3)
      expect(timing.delay).toBe(MODE_ROW_OUT_MS - 80)
      expect(timing.duration).toBe(MODE_ROW_DEAD_MS + 80)
    } finally {
      gear.remove()
    }
  })

  it('with no gear on the screen the row slides up, as the role dock’s bar has none', () => {
    draw()
    pass(MODE_ROW_SHOW_MS)
    expect(phase()).toBe('leaving')
    expect(row()?.getAttribute('data-mode-row-out')).toBe('up')
  })

  it('putting the phone away takes the row off, and coming back after a minute is an opening', () => {
    const { view } = draw()
    expect(thirds().length).toBe(3)
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    const turn = (to: 'hidden' | 'visible') => {
      visibility.mockReturnValue(to)
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
    }
    turn('hidden')
    expect(view.container.innerHTML).toBe('')
    // A glance elsewhere: back in ten seconds, there is still no row.
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
    expect(view.container.innerHTML).toBe('')
    visibility.mockRestore()
  })

  it('the phone’s switch: unticked, the Dashboard opens with no row, and ticking it shows the row there and then', () => {
    const { view, redraw } = draw({ atOpen: false })
    expect(view.container.innerHTML).toBe('')
    pass(MODE_ROW_SHOW_MS)
    expect(view.container.innerHTML).toBe('')
    redraw({ atOpen: true })
    expect(phase()).toBe('showing')
    untilGone()
    expect(view.container.innerHTML).toBe('')
    // Unticked and ticked again in the same opening: the row shows again, so the tick is seen to work.
    redraw({ atOpen: false })
    redraw({ atOpen: true })
    expect(phase()).toBe('showing')
  })

  it('the switch does not take Task Mode’s row, which is the way out', () => {
    draw({ pathname: '/checklist', mode: 'task', atOpen: false })
    expect(thirds().length).toBe(3)
  })

  it('in Task Mode the row is a line of the page, with no bar and no count, and coming back to the app starts none', () => {
    const { view } = draw({ pathname: '/checklist', mode: 'task' })
    expect(view.container.querySelector('.appTopBanner[data-mode-row="row"]')).toBeTruthy()
    expect(view.container.querySelector('.modeRowBar')).toBeNull()
    expect(document.querySelector('.modeRowClip')).toBeNull()
    pass(30_000)
    expect(thirds().length).toBe(3)
    expect(thirds().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
  })

  it('a press on Job Mode goes through the door as the row, is counted, and closes the row at once', () => {
    const { setMode, onLand, redraw, view } = draw()
    pass(3000)
    fireEvent.click(screen.getByRole('button', { name: 'Job Mode' }))
    expect(setMode.mock.calls).toEqual([['job', true, 'row']])
    expect(onLand).not.toHaveBeenCalled()
    expect(vi.mocked(recordNavClick)).toHaveBeenCalledWith('u1', 'master_technician', 'mode_row', '#job')
    expect(vi.mocked(recordNavClick)).toHaveBeenCalledWith('u1', 'master_technician', 'job_mode_enabled', '#row')
    redraw({ mode: 'job' })
    // The choice is made: the row is on its way to the gear, with the new mode lit, and takes no more presses.
    expect(phase()).toBe('leaving')
    expect(thirds().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true'])
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))
    expect(setMode).toHaveBeenCalledTimes(1)
    pass(MODE_ROW_OUT_MS + MODE_ROW_DEAD_MS)
    expect(view.container.innerHTML).toBe('')
    expect(localStorage.length).toBe(0)
  })

  it('a press on the lit third is a choice to stay: nothing is written and the row closes', () => {
    const { setMode, onLand, view } = draw({ mode: 'dispatch' })
    pass(1000)
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))
    expect(setMode).not.toHaveBeenCalled()
    expect(onLand).not.toHaveBeenCalled()
    expect(phase()).toBe('leaving')
    expect(vi.mocked(recordNavClick).mock.calls).toEqual([['u1', 'master_technician', 'mode_row_sent', '#lit']])
    pass(MODE_ROW_OUT_MS + MODE_ROW_DEAD_MS)
    expect(view.container.innerHTML).toBe('')
  })

  it('a press on Task Mode switches to it, and the row is then a line of the page', () => {
    const { setMode, redraw, view } = draw()
    fireEvent.click(screen.getByRole('button', { name: 'Task Mode' }))
    expect(setMode.mock.calls).toEqual([['task', true, 'row']])
    redraw({ mode: 'task' })
    expect(view.container.querySelector('.appTopBanner[data-mode-row="row"]')).toBeTruthy()
    expect(document.querySelector('.modeRowClip')).toBeNull()
    pass(30_000)
    expect(thirds().length).toBe(3)
  })

  it('a press on Dashboard from the Task Mode checklist switches both modes off, lands on the Dashboard, and the row is drawn there for its way out alone', () => {
    const { setMode, onLand, redraw, view } = draw({ pathname: '/checklist', mode: 'task' })
    pass(20_000)
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))
    expect(setMode.mock.calls).toEqual([
      ['task', false, 'row'],
      ['job', false, 'row'],
    ])
    expect(onLand).toHaveBeenCalledWith('/dashboard')
    redraw({ pathname: '/dashboard', mode: 'full' })
    // No five seconds: the row was in sight, the choice is made, and it goes to the gear from where it lay.
    expect(phase()).toBe('leaving')
    expect(thirds().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false'])
    pass(MODE_ROW_OUT_MS + MODE_ROW_DEAD_MS)
    expect(view.container.innerHTML).toBe('')
    // The app opened in Task Mode: the Dashboard later opens nothing.
    redraw({ pathname: '/jobs', mode: 'full' })
    redraw({ pathname: '/dashboard', mode: 'full' })
    expect(view.container.innerHTML).toBe('')
  })

  it('a press on the lit third of Task Mode’s row does nothing: that row stays', () => {
    const { setMode } = draw({ pathname: '/checklist', mode: 'task' })
    fireEvent.click(screen.getByRole('button', { name: 'Task Mode' }))
    expect(setMode).not.toHaveBeenCalled()
    expect(vi.mocked(recordNavClick)).not.toHaveBeenCalled()
    pass(5000)
    expect(thirds().length).toBe(3)
  })

  it('the thirds alone, as the look at another person’s Task Mode draws them: Task Mode filled, and a press does nothing', () => {
    render(<ModeRowThirds on="task" />)
    expect(words()).toEqual(['Task Mode', 'Dashboard', 'Job Mode'])
    expect(thirds().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))
    expect(thirds().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
  })
})
