// @vitest-environment jsdom
/**
 * Render smoke for the mode row (punch list #425): who it is drawn for, the three thirds in order,
 * the tuck on a phone with its handle and its pull, and what a press sends through the page mode's door.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))

import { ModeRow } from './ModeRow'
import { recordNavClick } from '../../lib/navClickTelemetry'
import { MODE_ROW_PULL_PX, MODE_ROW_WORDS, modeRowOpensKey, modeRowPressedKey, writeModeRowMemory } from '../../lib/modeRow'
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

function draw(over: Partial<{ userId: string; role: string; pathname: string; mode: PageMode }> = {}) {
  const setMode = vi.fn()
  const onLand = vi.fn()
  const props = { userId: 'u1', role: 'master_technician', pathname: '/dashboard', mode: 'dispatch' as PageMode, ...over }
  const view = render(<ModeRow {...props} setMode={setMode} onLand={onLand} />)
  return { setMode, onLand, view }
}

const thirds = () => screen.queryAllByRole('button').filter((b) => b.hasAttribute('data-mode-third'))
const words = () => thirds().map((b) => b.textContent)

describe('ModeRow', () => {
  const realMatchMedia = window.matchMedia
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.mocked(recordNavClick).mockClear()
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  })
  afterEach(() => {
    cleanup()
    window.matchMedia = realMatchMedia
    localStorage.clear()
    sessionStorage.clear()
  })

  it('is drawn for the four field roles on the Dashboard, and for nobody else', () => {
    for (const role of ['master_technician', 'superintendent', 'subcontractor', 'helpers']) {
      const { view } = draw({ role })
      expect(thirds().length, role).toBe(3)
      view.unmount()
    }
    for (const role of ['dev', 'assistant', 'controller', 'estimator', 'primary']) {
      const { view } = draw({ role })
      expect(view.container.innerHTML, role).toBe('')
      view.unmount()
    }
  })

  it('is not drawn on another page, and is on the checklist only in Task Mode', () => {
    expect(draw({ pathname: '/jobs' }).view.container.innerHTML).toBe('')
    cleanup()
    expect(draw({ pathname: '/checklist', mode: 'full' }).view.container.innerHTML).toBe('')
    cleanup()
    draw({ pathname: '/checklist', mode: 'task' })
    expect(thirds().length).toBe(3)
  })

  it('reads Task Mode, Dashboard, Job Mode, with the mode drawn filled', () => {
    draw({ mode: 'job' })
    expect(words()).toEqual(['Task Mode', 'Dashboard', 'Job Mode'])
    expect(thirds().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true'])
    expect(screen.getByRole('group', { name: MODE_ROW_WORDS.group })).toBeTruthy()
  })

  it('reads Dispatch Mode as the Dashboard', () => {
    draw({ mode: 'dispatch' })
    expect(thirds().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false'])
  })

  it('on a desk it always shows, and counts no opens', () => {
    writeModeRowMemory('u1', { pressed: true, opens: 6 })
    draw()
    expect(thirds().length).toBe(3)
    expect(localStorage.getItem(modeRowOpensKey('u1'))).toBe('6')
  })

  it('on a phone it shows on the first visits with Job Mode marked new, and counts the open once', () => {
    onAPhone()
    const { view } = draw()
    expect(words()).toEqual(['Task Mode', 'Dashboard', `Job Mode${MODE_ROW_WORDS.newMark}`])
    expect(localStorage.getItem(modeRowOpensKey('u1'))).toBe('1')
    view.rerender(<ModeRow userId="u1" role="master_technician" pathname="/dashboard" mode="dispatch" setMode={() => {}} onLand={() => {}} />)
    expect(localStorage.getItem(modeRowOpensKey('u1'))).toBe('1')
  })

  it('tucks on the sixth open with no press, and leaves only the handle', () => {
    onAPhone()
    writeModeRowMemory('u1', { pressed: false, opens: 5 })
    draw()
    expect(thirds().length).toBe(0)
    expect(screen.getByRole('button', { name: MODE_ROW_WORDS.handle })).toBeTruthy()
  })

  it('a tap on the handle brings the row down', () => {
    onAPhone()
    writeModeRowMemory('u1', { pressed: true, opens: 2 })
    draw()
    expect(thirds().length).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: MODE_ROW_WORDS.handle }))
    expect(words()).toEqual(['Task Mode', 'Dashboard', 'Job Mode'])
    expect(vi.mocked(recordNavClick)).toHaveBeenCalledWith('u1', 'master_technician', 'mode_row_shown', '#handle')
  })

  it('a pull down at the top of the page brings the row down, and a short one does not', () => {
    onAPhone()
    writeModeRowMemory('u1', { pressed: true, opens: 2 })
    draw()
    touch('touchstart', 100, 200)
    touch('touchmove', 100, 200 + MODE_ROW_PULL_PX - 6)
    touch('touchend', 0, 0)
    expect(thirds().length).toBe(0)
    touch('touchstart', 100, 200)
    touch('touchmove', 102, 200 + MODE_ROW_PULL_PX + 4)
    expect(thirds().length).toBe(3)
    expect(vi.mocked(recordNavClick)).toHaveBeenCalledWith('u1', 'master_technician', 'mode_row_shown', '#pull')
  })

  it('holds open in Task Mode and for a sub who is off Job Mode, whatever the phone remembers', () => {
    onAPhone()
    writeModeRowMemory('u1', { pressed: true, opens: 6 })
    draw({ pathname: '/checklist', mode: 'task' })
    expect(thirds().length).toBe(3)
    cleanup()
    draw({ role: 'subcontractor', mode: 'full' })
    expect(thirds().length).toBe(3)
    cleanup()
    draw({ role: 'subcontractor', mode: 'job' })
    expect(thirds().length).toBe(0)
  })

  it('a press on Job Mode goes through the door as the row, is remembered and is counted', () => {
    onAPhone()
    const { setMode, onLand } = draw()
    fireEvent.click(screen.getByRole('button', { name: /Job Mode/ }))
    expect(setMode.mock.calls).toEqual([['job', true, 'row']])
    expect(onLand).not.toHaveBeenCalled()
    expect(localStorage.getItem(modeRowPressedKey('u1'))).toBe('1')
    expect(vi.mocked(recordNavClick)).toHaveBeenCalledWith('u1', 'master_technician', 'mode_row', '#job')
    expect(vi.mocked(recordNavClick)).toHaveBeenCalledWith('u1', 'master_technician', 'job_mode_enabled', '#row')
    // The row stays in sight after the switch, with no mark left on Job Mode.
    expect(words()).toEqual(['Task Mode', 'Dashboard', 'Job Mode'])
  })

  it('a press on Dashboard from the Task Mode checklist switches both modes off and lands on the Dashboard', () => {
    const { setMode, onLand } = draw({ pathname: '/checklist', mode: 'task' })
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))
    expect(setMode.mock.calls).toEqual([
      ['task', false, 'row'],
      ['job', false, 'row'],
    ])
    expect(onLand).toHaveBeenCalledWith('/dashboard')
  })

  it('a press on the third already on does nothing', () => {
    const { setMode } = draw({ mode: 'job' })
    fireEvent.click(screen.getByRole('button', { name: 'Job Mode' }))
    expect(setMode).not.toHaveBeenCalled()
    expect(vi.mocked(recordNavClick)).not.toHaveBeenCalled()
  })

  it('keeps one memory per person on a shared phone', () => {
    onAPhone()
    writeModeRowMemory('u1', { pressed: true, opens: 2 })
    draw({ userId: 'u2' })
    expect(thirds().length).toBe(3)
    expect(localStorage.getItem(modeRowOpensKey('u2'))).toBe('1')
  })
})
