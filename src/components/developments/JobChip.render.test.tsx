// @vitest-environment jsdom
/**
 * The job chip's hover card (v2.6353): rest on the chip and the card shows after a beat with the job's
 * full name, address and details; leave and it goes; the press still opens the job, however slow; keyboard
 * focus shows it under the chip, it rides along when the window scrolls, and Escape or blur hides it; a
 * finger's hold shows it as the finger lifts and a plain tap opens the job; with no provider the chip is
 * the plain press. It is one chip in every place: a row of a count card and a History line's window. Made-up rows.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { LONG_PRESS_MS } from '../../hooks/useLongPress'
import type { CountCard } from '../../lib/developments/countCards'
import type { JobHoverCard } from '../../lib/developments/jobHoverCard'
import type { ChangeLine } from '../../lib/developments/whatChanged'
import { CountCardBody } from './DevelopmentCounts'
import { DevelopmentLineWindow } from './DevelopmentLineWindow'
import { JOB_CARD_ENTER_MS, JobCardsProvider, JobChip } from './JobChip'

/** jsdom has no PointerEvent, so a press arrives with no type or place (`HubPeopleDayCell.gestures.render.test.tsx` does the same). */
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number
  readonly isPrimary: boolean
  readonly pointerType: string
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerId = init.pointerId ?? 1
    this.isPrimary = init.isPrimary ?? true
    this.pointerType = init.pointerType ?? 'mouse'
  }
}
const realPointerEvent = (globalThis as { PointerEvent?: unknown }).PointerEvent
beforeAll(() => {
  vi.stubGlobal('PointerEvent', TestPointerEvent)
  ;(window as unknown as { PointerEvent: unknown }).PointerEvent = TestPointerEvent
})
afterAll(() => {
  vi.unstubAllGlobals()
  ;(window as unknown as { PointerEvent: unknown }).PointerEvent = realPointerEvent
})

const CARD: JobHoverCard = {
  number: 'JP1091',
  name: 'Lot 3 rough-in',
  address: '14 Gray Fox Trl, Driftwood, TX',
  lines: [
    { label: 'Customer', value: 'Harlow Homes' },
    { label: 'Stage', value: 'Working' },
    { label: 'Crew', value: 'Dana, Mel' },
  ],
}
const cardFor = (id: string) => (id === 'j1091' ? CARD : null)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-02T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function draw(onOpen = vi.fn(), provider = true) {
  const chip = (
    <JobChip jobId="j1091" onOpen={onOpen} strong testId="chip">
      JP1091
    </JobChip>
  )
  render(provider ? <JobCardsProvider cardFor={cardFor}>{chip}</JobCardsProvider> : chip)
  return { chip: screen.getByTestId('chip'), onOpen }
}
const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })
const shown = () => screen.queryByTestId('job-hover-card')
const mouse = { pointerType: 'mouse', button: 0 }
const finger = { pointerType: 'touch', button: 0 }
const rest = (chip: HTMLElement) => {
  fireEvent.pointerEnter(chip, { ...mouse, clientX: 400, clientY: 300 })
  tick(JOB_CARD_ENTER_MS)
}

describe('JobChip', () => {
  it('rest on the chip: after a beat the card floats off the pointer with the name, the address and the details; leave and it goes', () => {
    const { chip } = draw()
    fireEvent.pointerEnter(chip, { ...mouse, clientX: 400, clientY: 300 })
    expect(shown()).toBeNull()
    tick(JOB_CARD_ENTER_MS)
    const card = screen.getByTestId('job-hover-card')
    expect(card.getAttribute('data-anchor')).toBe('pointer')
    expect(card.getAttribute('role')).toBe('tooltip')
    expect(chip.getAttribute('aria-describedby')).toBe(card.id)
    expect(screen.getByTestId('job-hover-card-name').textContent).toBe('Lot 3 rough-in')
    expect(screen.getByTestId('job-hover-card-address').textContent).toBe('14 Gray Fox Trl, Driftwood, TX')
    expect(screen.getByTestId('job-hover-card-lines').textContent).toBe('CustomerHarlow HomesStageWorkingCrewDana, Mel')
    // It never stands between the pointer and the press.
    expect(card.style.pointerEvents).toBe('none')
    expect(card.style.position).toBe('fixed')
    // Off the pointer: a gap to the lower right (jsdom gives the card no size, so the clamp leaves it there).
    expect(card.style.left).toBe('414px')
    expect(card.style.top).toBe('314px')
    // The chip is still the press it was: no border, the link colour, the strong weight.
    expect(chip.style.color).toBe('var(--text-link)')
    expect(chip.style.fontWeight).toBe('600')
    fireEvent.pointerLeave(chip, mouse)
    expect(shown()).toBeNull()
  })

  it('a pointer crossing the chip on its way elsewhere draws nothing', () => {
    const { chip } = draw()
    fireEvent.pointerEnter(chip, { ...mouse, clientX: 10, clientY: 10 })
    tick(JOB_CARD_ENTER_MS - 50)
    fireEvent.pointerLeave(chip, mouse)
    tick(JOB_CARD_ENTER_MS)
    expect(shown()).toBeNull()
  })

  it('the press still opens the job, and takes the card with it', () => {
    const { chip, onOpen } = draw()
    rest(chip)
    expect(shown()).not.toBeNull()
    fireEvent.click(chip)
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(shown()).toBeNull()
  })

  it('keyboard focus shows the card under the chip; Escape hides it; focus again and blur hides it', () => {
    const { chip } = draw()
    fireEvent.focus(chip)
    const card = screen.getByTestId('job-hover-card')
    expect(card.getAttribute('data-anchor')).toBe('chip')
    expect(card.getAttribute('data-held')).toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(shown()).toBeNull()
    fireEvent.focus(chip)
    expect(shown()).not.toBeNull()
    fireEvent.blur(chip)
    expect(shown()).toBeNull()
  })

  it('a Tab onto a chip past the window’s edge: the scroll that follows the focus leaves the card up, under the chip where it landed', () => {
    const { chip } = draw()
    const box = (top: number) => ({ left: 100, right: 150, top, bottom: top + 20, width: 50, height: 20, x: 100, y: top, toJSON: () => ({}) })
    chip.getBoundingClientRect = () => box(900)
    fireEvent.focus(chip)
    chip.getBoundingClientRect = () => box(300)
    fireEvent.scroll(window)
    const card = screen.getByTestId('job-hover-card')
    expect(card.getAttribute('data-anchor')).toBe('chip')
    expect(card.style.top).toBe('326px')
    expect(card.style.left).toBe('100px')
  })

  it('the window scrolling takes away a resting pointer’s card and a held one', () => {
    const { chip } = draw()
    rest(chip)
    expect(shown()).not.toBeNull()
    fireEvent.scroll(window)
    expect(shown()).toBeNull()
    fireEvent.pointerDown(chip, finger)
    tick(LONG_PRESS_MS)
    fireEvent.pointerUp(chip, finger)
    expect(shown()?.getAttribute('data-held')).toBe('1')
    fireEvent.scroll(window)
    expect(shown()).toBeNull()
  })

  it('a mouse press focuses the chip with no card of its own, and a slow one still opens the job', () => {
    const { chip, onOpen } = draw()
    fireEvent.pointerDown(chip, mouse)
    fireEvent.focus(chip)
    tick(LONG_PRESS_MS * 3)
    fireEvent.pointerUp(chip, mouse)
    expect(shown()).toBeNull()
    fireEvent.click(chip)
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(shown()).toBeNull()
  })

  it('a mouse dragged off the chip mid-press leaves the keyboard’s next focus its card', () => {
    const { chip } = draw()
    fireEvent.pointerDown(chip, mouse)
    fireEvent.pointerLeave(chip, mouse)
    fireEvent.focus(chip)
    expect(shown()).not.toBeNull()
  })

  it('a right press at a desk keeps its menu; a finger’s hold does not', () => {
    const { chip } = draw()
    expect(fireEvent.contextMenu(chip)).toBe(true)
    fireEvent.pointerDown(chip, finger)
    expect(fireEvent.contextMenu(chip)).toBe(false)
    fireEvent.pointerUp(chip, finger)
    expect(fireEvent.contextMenu(chip)).toBe(true)
  })

  it('on a phone the card shows as a held finger lifts; the tap that ends the hold opens nothing, and a tap elsewhere closes', () => {
    const { chip, onOpen } = draw()
    // A finger arriving is no pointer resting.
    fireEvent.pointerEnter(chip, finger)
    fireEvent.pointerDown(chip, finger)
    tick(LONG_PRESS_MS)
    expect(shown()).toBeNull()
    fireEvent.pointerUp(chip, finger)
    const card = screen.getByTestId('job-hover-card')
    expect(card.getAttribute('data-anchor')).toBe('chip')
    expect(card.getAttribute('data-held')).toBe('1')
    expect(card.textContent).toContain('Tap elsewhere to close. Tap the number to open the job.')
    fireEvent.click(chip)
    expect(onOpen).not.toHaveBeenCalled()
    expect(shown()).not.toBeNull()
    fireEvent.click(document.body)
    expect(shown()).toBeNull()
  })

  it('a plain tap opens the job with no card, even though the browser focuses the chip after the finger lifts', () => {
    const { chip, onOpen } = draw()
    fireEvent.pointerEnter(chip, finger)
    fireEvent.pointerDown(chip, finger)
    tick(100)
    fireEvent.pointerUp(chip, finger)
    fireEvent.focus(chip)
    expect(shown()).toBeNull()
    tick(JOB_CARD_ENTER_MS)
    expect(shown()).toBeNull()
    fireEvent.click(chip)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('a finger that wobbles is still a hold; one that travels is a scroll', () => {
    const { chip } = draw()
    fireEvent.pointerDown(chip, { ...finger, clientX: 50, clientY: 50 })
    fireEvent.pointerMove(chip, { ...finger, clientX: 54, clientY: 53 })
    tick(LONG_PRESS_MS)
    fireEvent.pointerUp(chip, finger)
    expect(shown()).not.toBeNull()
    fireEvent.click(document.body)
    fireEvent.pointerDown(chip, { ...finger, clientX: 50, clientY: 50 })
    fireEvent.pointerMove(chip, { ...finger, clientX: 50, clientY: 90 })
    tick(LONG_PRESS_MS)
    fireEvent.pointerUp(chip, finger)
    expect(shown()).toBeNull()
  })

  it('with no provider, or a job the page does not hold, the chip is the plain press: nothing shows', () => {
    const { chip, onOpen } = draw(vi.fn(), false)
    rest(chip)
    fireEvent.focus(chip)
    fireEvent.pointerDown(chip, finger)
    tick(LONG_PRESS_MS)
    fireEvent.pointerUp(chip, finger)
    expect(shown()).toBeNull()
    expect(chip.getAttribute('aria-describedby')).toBeNull()
    fireEvent.click(chip)
    expect(onOpen).toHaveBeenCalledTimes(1)
    cleanup()
    const other = vi.fn()
    render(
      <JobCardsProvider cardFor={cardFor}>
        <JobChip jobId="j-elsewhere" onOpen={other} testId="chip2">
          JP2
        </JobChip>
      </JobCardsProvider>,
    )
    fireEvent.focus(screen.getByTestId('chip2'))
    expect(shown()).toBeNull()
    fireEvent.click(screen.getByTestId('chip2'))
    expect(other).toHaveBeenCalledTimes(1)
  })
})

describe('the chip in the page’s other places', () => {
  const countCard: CountCard = {
    head: 'Jobs',
    headMeta: null,
    empty: null,
    groups: [
      {
        label: 'Working',
        rows: [
          { key: 'job:j1091', door: { kind: 'job', id: 'j1091' }, number: 'JP1091', name: 'Lot 3 rough-in', value: null, meta: null, press: null },
          { key: 'bid:b1', door: { kind: 'bid', id: 'b1' }, number: 'BP401', name: 'Phase 2 water', value: null, meta: null, press: null },
        ],
      },
    ],
    more: 0,
    folded: null,
    foot: { door: 'jobs', label: 'See them in Jobs & bids ›', note: null },
  }

  it('a count card’s row that opens a job is a chip: it rests, it presses; a bid’s row stays the plain press', () => {
    const onRow = vi.fn()
    render(
      <JobCardsProvider cardFor={cardFor}>
        <CountCardBody card={countCard} sheet={false} onRow={onRow} onFoot={() => {}} onPress={() => {}} onClose={() => {}} />
      </JobCardsProvider>,
    )
    const chip = document.querySelector<HTMLElement>('[data-job-chip="j1091"]')!
    expect(chip.textContent).toBe('JP1091')
    rest(chip)
    expect(screen.getByTestId('job-hover-card-name').textContent).toBe('Lot 3 rough-in')
    fireEvent.click(chip)
    expect(onRow).toHaveBeenCalledWith({ kind: 'job', id: 'j1091' })
    expect(shown()).toBeNull()
    expect(document.querySelector('[data-job-chip="b1"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'BP401' }))
    expect(onRow).toHaveBeenCalledWith({ kind: 'bid', id: 'b1' })
  })

  it('a History line’s window names its job with a chip, and its bid with the plain press', () => {
    const line = (about: ChangeLine['about']): ChangeLine => ({ id: 'l1', at: '2026-11-01T15:00:00Z', kind: 'note', verb: 'Note', about, detail: 'The whole of a long line.', by: null, waitingDays: null })
    const openAbout = vi.fn()
    const { rerender } = render(
      <JobCardsProvider cardFor={cardFor}>
        <DevelopmentLineWindow line={line({ kind: 'job', id: 'j1091', label: 'JP1091 Lot 3 rough-in' })} onClose={() => {}} openAbout={openAbout} />
      </JobCardsProvider>,
    )
    const chip = document.querySelector<HTMLElement>('[data-job-chip="j1091"]')!
    fireEvent.focus(chip)
    expect(shown()).not.toBeNull()
    fireEvent.click(chip)
    expect(openAbout).toHaveBeenCalledWith({ kind: 'job', id: 'j1091', label: 'JP1091 Lot 3 rough-in' })
    rerender(
      <JobCardsProvider cardFor={cardFor}>
        <DevelopmentLineWindow line={line({ kind: 'bid', id: 'b1', label: 'BP401 Phase 2 water' })} onClose={() => {}} openAbout={openAbout} />
      </JobCardsProvider>,
    )
    expect(document.querySelector('[data-job-chip]')).toBeNull()
    expect(screen.getByRole('button', { name: 'BP401 Phase 2 water' })).toBeTruthy()
  })
})
