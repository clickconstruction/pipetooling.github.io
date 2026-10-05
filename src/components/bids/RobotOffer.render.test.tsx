// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RobotOffer } from './RobotOffer'

const live = { live: true, line: 'A robot was working 12 min ago.' }

describe('RobotOffer (v2.4136; one line since 2026-10-05)', () => {
  it('draws nothing while no seat is live', () => {
    const { container } = render(<MemoryRouter><RobotOffer kind="read_schedule" seat={{ live: false, line: 'No robot has run yet.' }} hasPlans busy={false} onAsk={() => {}} testId="ask" /></MemoryRouter>)
    expect(container.innerHTML).toBe('')
  })

  it('is one line: the ask button and a small ?; the three lines wait in a card', () => {
    const onAsk = vi.fn()
    render(<MemoryRouter><RobotOffer kind="read_schedule" seat={live} hasPlans busy={false} onAsk={onAsk} testId="ask" tour="submittals-robot" /></MemoryRouter>)
    const line = screen.getByTestId('robot-offer-read_schedule')
    expect(line.getAttribute('data-tour')).toBe('submittals-robot')
    expect(line.textContent).toBe('🤖Ask the robot to read the schedule?')
    expect(screen.queryByRole('note')).toBeNull()
    fireEvent.click(screen.getByTestId('ask'))
    expect(onAsk).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('ask').textContent).toBe('Ask the robot to read the schedule')
  })

  it('the card opens while the pointer is on the line: what it does, what it needs with the awake line, what you do after, and the guide', () => {
    render(<MemoryRouter><RobotOffer kind="read_schedule" seat={live} hasPlans busy={false} onAsk={() => {}} testId="ask" /></MemoryRouter>)
    const line = screen.getByTestId('robot-offer-read_schedule')
    fireEvent.mouseEnter(line)
    const card = screen.getByRole('note')
    expect(card.textContent).toContain('The robot can read the fixture schedule off the plans.')
    expect(screen.getByTestId('robot-needs-read_schedule').textContent).toBe('Needs the plans on this bid ✓ · A robot was working 12 min ago.')
    expect(card.textContent).toContain('You tick the right ones.')
    expect(within(card).getByRole('link', { name: 'What is the robot? →' }).getAttribute('href')).toBe('/help?g=build-a-submittal-package')
    // The button is never inside the card.
    expect(card.contains(screen.getByTestId('ask'))).toBe(false)
    fireEvent.mouseLeave(line)
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('a tap on the ? pins the card open with no pointer on it; Esc, a second tap or a press elsewhere closes it; so does the keyboard', () => {
    render(<MemoryRouter><div><RobotOffer kind="read_schedule" seat={live} hasPlans busy={false} onAsk={() => {}} testId="ask" /><button type="button">elsewhere</button></div></MemoryRouter>)
    const why = screen.getByRole('button', { name: 'What the robot does' })
    fireEvent.click(why)
    expect(screen.getByRole('note')).toBeTruthy()
    expect(why.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(why)
    expect(screen.queryByRole('note')).toBeNull()
    fireEvent.click(why)
    fireEvent.mouseDown(screen.getByRole('button', { name: 'elsewhere' }))
    expect(screen.queryByRole('note')).toBeNull()
    fireEvent.click(why)
    fireEvent.keyDown(why, { key: 'Escape' })
    expect(screen.queryByRole('note')).toBeNull()
    // Keyboard focus on the ask button opens it too, and leaving the line closes it.
    fireEvent.focus(screen.getByTestId('ask'))
    expect(screen.getByRole('note')).toBeTruthy()
    fireEvent.blur(screen.getByTestId('ask'), { relatedTarget: screen.getByRole('button', { name: 'elsewhere' }) })
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('a bid with no plans keeps the offer but holds the button, and says why beside it without a hover', () => {
    render(<MemoryRouter><RobotOffer kind="read_schedule" seat={live} hasPlans={false} busy={false} onAsk={() => {}} testId="ask" /></MemoryRouter>)
    expect((screen.getByTestId('ask') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('robot-offer-read_schedule-held').textContent).toBe('needs the plans link on the bid')
    fireEvent.mouseEnter(screen.getByTestId('robot-offer-read_schedule'))
    expect(screen.getByTestId('robot-needs-read_schedule').textContent).toContain('✗ Add the plans link on the bid first.')
  })
})
