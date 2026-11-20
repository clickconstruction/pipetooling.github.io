// @vitest-environment jsdom
/**
 * The short Job Mode page's order (punch list #384): what the Dashboard hands in is drawn top to bottom as the
 * strips, the card, Waiting on you, Tomorrow, Everything else, and each row's press goes where it says.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { JobModeShortPage } from './JobModeShortPage'

afterEach(cleanup)

function draw(over: Partial<Parameters<typeof JobModeShortPage>[0]> = {}) {
  const props = {
    top: <div data-testid="top">strips</div>,
    card: <div data-testid="card">the job card</div>,
    waiting: <div data-testid="waiting">Waiting on you</div>,
    tomorrow: { title: 'Tomorrow', note: '3 stops. First at 8:00 AM, 2050 Linden vanity faucet.' },
    coursesOwed: 2,
    onTomorrow: vi.fn(),
    onEverythingElse: vi.fn(),
    tail: <div data-testid="tail">windows</div>,
    ...over,
  }
  const view = render(<JobModeShortPage {...props} />)
  return { props, ...view }
}

describe('JobModeShortPage', () => {
  it('draws the day\'s row first when the Dashboard hands one in, above the strips and the card', () => {
    const { container } = draw({ row: <div data-testid="row">the day's row</div> })
    const order = [...container.querySelectorAll('[data-testid]')].map((el) => el.getAttribute('data-testid'))
    expect(order.slice(0, 3)).toEqual(['row', 'top', 'card'])
  })

  it('draws the strips, the card, what waits, tomorrow and the door, in that order', () => {
    const { container } = draw()
    const order = [...container.querySelectorAll('[data-testid]')].map((n) => n.getAttribute('data-testid'))
    expect(order).toEqual(['top', 'card', 'waiting', 'job-mode-short-tomorrow', 'job-mode-short-door', 'tail'])
    expect(container.querySelector('[data-job-mode-short]')).toBeTruthy()
  })

  it('tomorrow is one line, and its press opens the schedule', () => {
    const { props } = draw()
    const row = screen.getByTestId('job-mode-short-tomorrow')
    expect(row.textContent).toContain('Tomorrow')
    expect(row.textContent).toContain('3 stops. First at 8:00 AM, 2050 Linden vanity faucet.')
    fireEvent.click(row)
    expect(props.onTomorrow).toHaveBeenCalledTimes(1)
    expect(props.onEverythingElse).not.toHaveBeenCalled()
  })

  it('the door says what is behind it and how many courses are owed', () => {
    const { props } = draw()
    const door = screen.getByTestId('job-mode-short-door')
    expect(door.textContent).toContain('Everything else')
    expect(door.textContent).toContain('Your hours, your schedule, training and the full Dashboard. 2 courses to do.')
    fireEvent.click(door)
    expect(props.onEverythingElse).toHaveBeenCalledTimes(1)
  })

  it('with no course owed and a clean record the page is the card and two rows', () => {
    const { container } = draw({ coursesOwed: 0, waiting: null, top: null, tail: null })
    expect([...container.querySelectorAll('[data-testid]')].map((n) => n.getAttribute('data-testid'))).toEqual(['card', 'job-mode-short-tomorrow', 'job-mode-short-door'])
    expect(screen.getByTestId('job-mode-short-door').textContent).toContain('Your hours, your schedule, training and the full Dashboard.')
    expect(screen.getByTestId('job-mode-short-door').textContent).not.toContain('course')
  })
})
