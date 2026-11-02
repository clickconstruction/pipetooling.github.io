// @vitest-environment jsdom
/**
 * The job chip's hover card (v2.6353): rest on the chip and the card shows after a beat with the job's
 * full name, address and details; leave and it goes; the press still opens the job; keyboard focus shows
 * it under the chip and Escape or blur hides it; a finger's hold shows it and the hold's own tap opens
 * nothing, while a plain tap opens the job; with no provider the chip is the plain press. Made-up rows.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JobHoverCard } from '../../lib/developments/jobHoverCard'
import { JOB_CARD_ENTER_MS, JOB_CARD_HOLD_MS, JobCardsProvider, JobChip } from './JobChip'

const CARD: JobHoverCard = {
  number: 'JP1091',
  name: 'Lot 3 rough-in',
  address: '14 Gun Dog Trl, Driftwood, TX',
  lines: [
    { label: 'Customer', value: 'Harlow Homes' },
    { label: 'Stage', value: 'Working' },
    { label: 'Crew', value: 'Dana, Mel' },
  ],
}
const cardFor = (id: string) => (id === 'j1091' ? CARD : null)

beforeEach(() => {
  vi.useFakeTimers()
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

describe('JobChip', () => {
  it('rest on the chip: after a beat the card floats off the pointer with the name, the address and the details; leave and it goes', () => {
    const { chip } = draw()
    fireEvent.mouseEnter(chip, { clientX: 400, clientY: 300 })
    expect(screen.queryByTestId('job-hover-card')).toBeNull()
    tick(JOB_CARD_ENTER_MS)
    const card = screen.getByTestId('job-hover-card')
    expect(card.getAttribute('data-anchor')).toBe('pointer')
    expect(card.getAttribute('role')).toBe('tooltip')
    expect(chip.getAttribute('aria-describedby')).toBe(card.id)
    expect(screen.getByTestId('job-hover-card-name').textContent).toBe('Lot 3 rough-in')
    expect(screen.getByTestId('job-hover-card-address').textContent).toBe('14 Gun Dog Trl, Driftwood, TX')
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
    fireEvent.mouseLeave(chip)
    expect(screen.queryByTestId('job-hover-card')).toBeNull()
  })

  it('a pointer crossing the chip on its way elsewhere draws nothing', () => {
    const { chip } = draw()
    fireEvent.mouseEnter(chip, { clientX: 10, clientY: 10 })
    tick(JOB_CARD_ENTER_MS - 50)
    fireEvent.mouseLeave(chip)
    tick(JOB_CARD_ENTER_MS)
    expect(screen.queryByTestId('job-hover-card')).toBeNull()
  })

  it('the press still opens the job, and takes the card with it', () => {
    const { chip, onOpen } = draw()
    fireEvent.mouseEnter(chip, { clientX: 10, clientY: 10 })
    tick(JOB_CARD_ENTER_MS)
    expect(screen.getByTestId('job-hover-card')).toBeTruthy()
    fireEvent.click(chip)
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('job-hover-card')).toBeNull()
  })

  it('keyboard focus shows the card under the chip; Escape hides it; focus again and blur hides it', () => {
    const { chip } = draw()
    fireEvent.focus(chip)
    const card = screen.getByTestId('job-hover-card')
    expect(card.getAttribute('data-anchor')).toBe('chip')
    expect(card.getAttribute('data-held')).toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('job-hover-card')).toBeNull()
    fireEvent.focus(chip)
    expect(screen.getByTestId('job-hover-card')).toBeTruthy()
    fireEvent.blur(chip)
    expect(screen.queryByTestId('job-hover-card')).toBeNull()
  })

  it('a mouse press focuses the chip with no card of its own: the press opens the job', () => {
    const { chip, onOpen } = draw()
    fireEvent.mouseDown(chip)
    fireEvent.focus(chip)
    fireEvent.mouseUp(chip)
    fireEvent.click(chip)
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('job-hover-card')).toBeNull()
  })

  it('on a phone a hold shows the card, the hold’s own tap opens nothing, a tap elsewhere closes it, and a plain tap opens the job', () => {
    const { chip, onOpen } = draw()
    fireEvent.touchStart(chip)
    tick(JOB_CARD_HOLD_MS)
    const card = screen.getByTestId('job-hover-card')
    expect(card.getAttribute('data-anchor')).toBe('chip')
    expect(card.getAttribute('data-held')).toBe('1')
    expect(card.textContent).toContain('Tap elsewhere to close. Tap the number to open the job.')
    fireEvent.touchEnd(chip)
    fireEvent.click(chip)
    expect(onOpen).not.toHaveBeenCalled()
    expect(screen.getByTestId('job-hover-card')).toBeTruthy()
    fireEvent.click(document.body)
    expect(screen.queryByTestId('job-hover-card')).toBeNull()
    // A plain tap: the finger lifts before the hold.
    fireEvent.touchStart(chip)
    tick(JOB_CARD_HOLD_MS - 100)
    fireEvent.touchEnd(chip)
    tick(JOB_CARD_HOLD_MS)
    expect(screen.queryByTestId('job-hover-card')).toBeNull()
    fireEvent.click(chip)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('with no provider, or a job the page does not hold, the chip is the plain press: nothing shows', () => {
    const { chip, onOpen } = draw(vi.fn(), false)
    fireEvent.mouseEnter(chip, { clientX: 10, clientY: 10 })
    tick(JOB_CARD_ENTER_MS)
    fireEvent.focus(chip)
    expect(screen.queryByTestId('job-hover-card')).toBeNull()
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
    expect(screen.queryByTestId('job-hover-card')).toBeNull()
    fireEvent.click(screen.getByTestId('chip2'))
    expect(other).toHaveBeenCalledTimes(1)
  })
})
