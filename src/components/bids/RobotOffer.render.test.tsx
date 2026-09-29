// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RobotOffer } from './RobotOffer'

const live = { live: true, line: 'A robot was working 12 min ago.' }

describe('RobotOffer (v2.4136)', () => {
  it('draws nothing while no seat is live', () => {
    const { container } = render(<MemoryRouter><RobotOffer kind="read_schedule" seat={{ live: false, line: 'No robot has run yet.' }} hasPlans busy={false} onAsk={() => {}} testId="ask" /></MemoryRouter>)
    expect(container.innerHTML).toBe('')
  })

  it('the three lines, the awake line, the button and the ? — and the ask', () => {
    const onAsk = vi.fn()
    render(<MemoryRouter><RobotOffer kind="read_schedule" seat={live} hasPlans busy={false} onAsk={onAsk} testId="ask" tour="submittals-robot" /></MemoryRouter>)
    const block = screen.getByTestId('robot-offer-read_schedule')
    expect(block.getAttribute('data-tour')).toBe('submittals-robot')
    expect(block.textContent).toContain('The robot can read the fixture schedule off the plans.')
    expect(screen.getByTestId('robot-needs-read_schedule').textContent).toBe('Needs the plans on this bid ✓ · A robot was working 12 min ago.')
    expect(block.textContent).toContain('You tick the right ones.')
    expect(screen.getByRole('link', { name: 'What is the robot? →' }).getAttribute('href')).toBe('/help?g=build-a-submittal-package')
    fireEvent.click(screen.getByTestId('ask'))
    expect(onAsk).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('ask').textContent).toBe('Ask the robot to read the schedule')
  })

  it('a bid with no plans keeps the offer but holds the button, and says what to add', () => {
    render(<MemoryRouter><RobotOffer kind="read_schedule" seat={live} hasPlans={false} busy={false} onAsk={() => {}} testId="ask" /></MemoryRouter>)
    expect((screen.getByTestId('ask') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('robot-needs-read_schedule').textContent).toContain('✗ Add the plans link on the bid first.')
  })
})
