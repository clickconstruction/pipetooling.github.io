// @vitest-environment jsdom
/**
 * The Job Mode press bar under the new phone layout (`lib/phoneLayout`): the same buttons on one row.
 * For every state the bar has, the one row draws exactly the buttons the two rows draw, in the same order,
 * with the same words, the same dead ones and the same presses, and the day's press keeps its colour.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { UserRole } from '../../hooks/useAuth'
import { buildJobModePressBar, pickJobModeDayPress, type PressBarButtonId } from '../../lib/jobMode/pressBar'
import type { JobModeState } from '../../lib/jobModePickCurrentNext'
import type { Leg } from '../../lib/jobMode/onMyWay'
import { PHONE_DAY_PRESS_COMPACT_MIN_PX, PHONE_DAY_PRESS_ROW_PX } from '../../lib/phoneLayout/phoneBar'
import { JOB_MODE_PRESS_BAR_ONE_ROW_CLASS, JobModePressBar } from './JobModePressBar'

vi.mock('../../hooks/useOnScreenKeyboardOpen', () => ({ useOnScreenKeyboardOpen: () => false }))

type Case = {
  name: string
  leg: Leg
  state: JobModeState
  hasNextBlock: boolean
  canClockOut: boolean
  role: UserRole
  sessionOpen: boolean
  hasCurrentJob: boolean
}

/** Every state the card hands the bar: the day's six presses, hourly and salaried, a helper and a leader. */
const CASES: Case[] = [
  { name: 'no schedule, not clocked in: Clock In', leg: 'unmarked', state: 'no-clock-no-schedule', hasNextBlock: false, canClockOut: true, role: 'helpers', sessionOpen: false, hasCurrentJob: false },
  { name: 'ready to start: On my way', leg: 'unmarked', state: 'not-clocked-in-with-schedule', hasNextBlock: true, canClockOut: true, role: 'helpers', sessionOpen: false, hasCurrentJob: false },
  { name: 'on the way: I’m here', leg: 'on-the-way', state: 'on-scheduled-job-not-last', hasNextBlock: true, canClockOut: true, role: 'helpers', sessionOpen: true, hasCurrentJob: true },
  { name: 'on site mid-day, a helper: five buttons', leg: 'on-site', state: 'on-scheduled-job-not-last', hasNextBlock: true, canClockOut: true, role: 'helpers', sessionOpen: true, hasCurrentJob: true },
  { name: 'on site mid-day, a leader: no % done', leg: 'on-site', state: 'on-scheduled-job-not-last', hasNextBlock: true, canClockOut: true, role: 'master_technician', sessionOpen: true, hasCurrentJob: true },
  { name: 'on site mid-day, a superintendent: % done', leg: 'on-site', state: 'on-scheduled-job-not-last', hasNextBlock: true, canClockOut: true, role: 'superintendent', sessionOpen: true, hasCurrentJob: true },
  { name: 'last job, hourly: Wrap Up Day', leg: 'on-site', state: 'on-scheduled-job-last', hasNextBlock: false, canClockOut: true, role: 'helpers', sessionOpen: true, hasCurrentJob: true },
  { name: 'last job, salaried: Last job of the day, dead', leg: 'on-site', state: 'on-scheduled-job-last', hasNextBlock: false, canClockOut: false, role: 'helpers', sessionOpen: true, hasCurrentJob: true },
  { name: 'off the schedule with a next job', leg: 'unmarked', state: 'on-off-schedule-job', hasNextBlock: true, canClockOut: true, role: 'subcontractor', sessionOpen: true, hasCurrentJob: true },
  { name: 'on a bid, nothing next: Choose Next Job', leg: 'unmarked', state: 'on-bid', hasNextBlock: false, canClockOut: true, role: 'helpers', sessionOpen: true, hasCurrentJob: false },
]

function draw(c: Case, opts: { oneRow?: boolean; held?: boolean } = {}) {
  const dayPress = pickJobModeDayPress({ leg: c.leg, state: c.state, hasNextBlock: c.hasNextBlock, canClockOut: c.canClockOut })
  const rows = buildJobModePressBar({ dayPress, role: c.role, sessionOpen: c.sessionOpen, canClockOut: c.canClockOut, hasCurrentJob: c.hasCurrentJob })
  const onPress = vi.fn<(id: PressBarButtonId) => void>()
  const { container } = render(<JobModePressBar rows={rows} dayPressTone={dayPress.tone} noJobReason="Start a job first." onPress={onPress} held={opts.held} oneRow={opts.oneRow} />)
  const bar = container.querySelector('[data-testid="job-mode-press-bar"]') as HTMLElement
  const buttons = Array.from(bar.querySelectorAll('button')) as HTMLButtonElement[]
  return { bar, buttons, onPress, rows, dayPress }
}

/** What a person meets of a button: which one, its words, its name aloud, its hover words and whether it is dead. */
const face = (b: HTMLButtonElement) => ({
  id: b.dataset.testid,
  words: (b.textContent ?? '').replace(/ /g, ' '),
  aria: b.getAttribute('aria-label'),
  title: b.getAttribute('title'),
  disabled: b.disabled,
})

afterEach(() => {
  cleanup()
  document.documentElement.style.removeProperty('--job-mode-press-bar')
})

describe('JobModePressBar: one row under the new phone layout', () => {
  it.each(CASES)('$name: the same buttons, words and dead ones, in the same order', (c) => {
    const two = draw(c)
    const twoFaces = two.buttons.map(face)
    const dayTwo = two.buttons[two.buttons.length - 1]!
    const dayLook = { background: dayTwo.style.background, color: dayTwo.style.color }
    expect(twoFaces.length).toBeGreaterThanOrEqual(3)
    cleanup()

    const one = draw(c, { oneRow: true })
    expect(one.buttons.map(face)).toEqual(twoFaces)
    // One row: every button is the bar's own child, and the day's press is the last.
    expect(one.bar.getAttribute('data-one-row')).toBe('true')
    // The stylesheet holds the row to one line (`.jobModePressBarOneRow`), so the bar names no wrap of its own.
    expect(one.bar.className).toBe(JOB_MODE_PRESS_BAR_ONE_ROW_CLASS)
    expect(one.bar.style.flexWrap).toBe('')
    for (const b of one.buttons) expect(b.parentElement).toBe(one.bar)
    const day = one.buttons[one.buttons.length - 1]!
    expect(day.dataset.testid).toBe('job-mode-press-day-press')
    // The day's press keeps its label and its colour, dead or live.
    expect({ background: day.style.background, color: day.style.color }).toEqual(dayLook)
    expect((day.textContent ?? '').length).toBeGreaterThan(0)
  })

  it.each(CASES)('$name: every press is 44 px or more and the day’s press takes the rest of the row', (c) => {
    const { buttons } = draw(c, { oneRow: true })
    const day = buttons[buttons.length - 1]!
    for (const b of buttons.slice(0, -1)) {
      expect(Number.parseFloat(b.style.minHeight)).toBeGreaterThanOrEqual(PHONE_DAY_PRESS_COMPACT_MIN_PX)
      expect(PHONE_DAY_PRESS_COMPACT_MIN_PX).toBeGreaterThanOrEqual(44)
      // As wide as its words, never grown: the room is the day's press's.
      expect(b.style.flexGrow).toBe('0')
      expect(b.style.minWidth).toBe('min-content')
    }
    expect(Number.parseFloat(day.style.minHeight)).toBe(PHONE_DAY_PRESS_ROW_PX)
    expect(day.style.flexGrow).toBe('1')
  })

  it.each(CASES)('$name: each button runs the press it ran', (c) => {
    const { buttons, onPress } = draw(c, { oneRow: true })
    for (const b of buttons) {
      onPress.mockClear()
      fireEvent.click(b)
      const id = (b.dataset.testid ?? '').replace('job-mode-press-', '')
      if (b.disabled) expect(onPress).not.toHaveBeenCalled()
      else expect(onPress).toHaveBeenCalledWith(id)
    }
  })

  it('Turnaway keeps its amber, Leave report its blue under white words, and a dead one its grey', () => {
    const live = draw(CASES[3]!, { oneRow: true })
    const turnaway = live.buttons.find((b) => b.dataset.testid === 'job-mode-press-turnaway')!
    const leave = live.buttons.find((b) => b.dataset.testid === 'job-mode-press-leave-report')!
    expect(turnaway.style.background).toBe('var(--bg-amber-tint)')
    expect(leave.style.background).toBe('rgb(37, 99, 235)')
    expect(leave.style.color).toBe('white')
    cleanup()
    const dead = draw(CASES[1]!, { oneRow: true })
    const deadLeave = dead.buttons.find((b) => b.dataset.testid === 'job-mode-press-leave-report')!
    expect(deadLeave.disabled).toBe(true)
    expect(deadLeave.style.background).not.toBe('rgb(37, 99, 235)')
    expect(deadLeave.title).toBe('Start a job first.')
  })

  it('"% done" stays whole when the row is short of room and a label folds', () => {
    const { buttons } = draw(CASES[3]!, { oneRow: true })
    const pct = buttons.find((b) => b.dataset.testid === 'job-mode-press-pct-done')!
    expect(pct.textContent).toBe('% done')
  })

  it('a kept day holds every press on the one row too', () => {
    const { bar, buttons } = draw(CASES[3]!, { oneRow: true, held: true })
    expect(bar.getAttribute('data-held')).toBe('true')
    for (const b of buttons) {
      expect(b.disabled).toBe(true)
      expect(b.className).toBe('keptPress')
    }
  })

  it('the stylesheet keeps the row on one line at 350 px and wider, and lets it wrap under that', () => {
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../index.css'), 'utf8')
    const rules = [...css.matchAll(/\.jobModePressBarOneRow\s*\{([^}]*)\}/g)].map((m) => m[1]!.replace(/\s+/g, ' ').trim())
    expect(rules).toEqual(['flex-wrap: nowrap;', 'flex-wrap: wrap;'])
    expect(css).toMatch(/@media \(max-width: 349px\) \{\s*\.jobModePressBarOneRow/)
  })

  it('publishes its height for the page’s padding, as the two rows do', () => {
    draw(CASES[3]!, { oneRow: true })
    expect(document.documentElement.style.getPropertyValue('--job-mode-press-bar')).toMatch(/^\d+px$/)
  })

  it('off, the bar is its two rows: the small row over the big one, and no mark of the one row', () => {
    for (const oneRow of [false, undefined]) {
      const { bar, buttons, rows } = draw(CASES[3]!, { oneRow })
      expect(bar.hasAttribute('data-one-row')).toBe(false)
      expect(bar.hasAttribute('class')).toBe(false)
      expect(bar.children).toHaveLength(2)
      expect(bar.children[0]!.children).toHaveLength(rows.top.length)
      expect(bar.children[1]!.children).toHaveLength(rows.bottom.length)
      expect(bar.style.display).toBe('grid')
      for (const b of buttons) expect(b.style.flexGrow).toBe('')
      cleanup()
    }
  })
})
