// @vitest-environment jsdom
/**
 * Render tests for the Week range section's assistant hours window (v2.1592):
 * without minDateYmd nothing changes (no hint, back button enabled); with a
 * floor the date inputs carry min=, the hint names the floor date, and the
 * previous-week button disables exactly when the range start sits at the floor.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PeopleHoursWeekRange } from './PeopleHoursWeekRange'

const baseProps = {
  narrowViewport: false,
  hoursDateStart: '2026-08-09',
  hoursDateEnd: '2026-08-15',
  setHoursDateStart: () => {},
  setHoursDateEnd: () => {},
  shiftHoursWeek: () => {},
}

describe('PeopleHoursWeekRange assistant window', () => {
  it('without minDateYmd there is no hint and last week stays enabled', () => {
    render(<PeopleHoursWeekRange {...baseProps} />)
    expect(screen.queryByText(/is not available for your role/)).toBeNull()
    expect((screen.getByText('← last week') as HTMLButtonElement).disabled).toBe(false)
  })

  it('with a floor below the range: hint shows, inputs carry min, back stays enabled', () => {
    const { container } = render(<PeopleHoursWeekRange {...baseProps} minDateYmd="2026-07-26" />)
    expect(screen.getByText(/Hours history before Jul 26, 2026 is not available/)).toBeTruthy()
    const dateInputs = Array.from(container.querySelectorAll('input[type="date"]')) as HTMLInputElement[]
    expect(dateInputs).toHaveLength(2)
    for (const input of dateInputs) expect(input.min).toBe('2026-07-26')
    expect((screen.getByText('← last week') as HTMLButtonElement).disabled).toBe(false)
  })

  it('at the floor the previous-week button disables and stops firing', () => {
    const shiftHoursWeek = vi.fn()
    render(
      <PeopleHoursWeekRange
        {...baseProps}
        hoursDateStart="2026-07-26"
        hoursDateEnd="2026-08-01"
        shiftHoursWeek={shiftHoursWeek}
        minDateYmd="2026-07-26"
      />
    )
    const back = screen.getByText('← last week') as HTMLButtonElement
    expect(back.disabled).toBe(true)
    fireEvent.click(back)
    expect(shiftHoursWeek).not.toHaveBeenCalled()
  })

  it('narrow layout: the ‹ button disables at the floor too', () => {
    render(
      <PeopleHoursWeekRange
        {...baseProps}
        narrowViewport
        hoursDateStart="2026-07-26"
        hoursDateEnd="2026-08-01"
        minDateYmd="2026-07-26"
      />
    )
    expect((screen.getByLabelText('Previous week') as HTMLButtonElement).disabled).toBe(true)
  })
})
