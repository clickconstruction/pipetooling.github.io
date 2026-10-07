// @vitest-environment jsdom
/**
 * Render smoke for the Man hours picture: the two charts and their columns,
 * the legend, and the box that names a column's numbers on hover or focus.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { buildManHoursPeriods, type ManHoursEntry } from '../../lib/manHours/manHoursByPeriod'
import { ManHoursChart } from './ManHoursChart'

const entry = (workDate: string, side: ManHoursEntry['side'], hours: number, pending = false): ManHoursEntry => ({ workDate, userId: 'u1', side, hours, pending })

const periods = buildManHoursPeriods({
  zoom: 'month',
  todayYmd: '2026-10-04',
  entries: [
    entry('2026-08-01', 'field', 300),
    entry('2026-08-03', 'office', 100),
    entry('2026-09-10', 'field', 300),
    entry('2026-09-11', 'office', 60),
    entry('2026-09-12', 'bid', 40),
    entry('2026-09-13', 'unassigned', 20, true),
    entry('2026-10-02', 'field', 40),
  ],
}).periods

afterEach(cleanup)

describe('ManHoursChart', () => {
  it('draws a column per period on both charts, with the legend and the open-period note', () => {
    const { container } = renderWithProviders(<ManHoursChart periods={periods} zoom="month" />)

    expect(screen.getByRole('img', { name: /^Hours per period, stacked by field, office, bids and not on a job/ })).toBeTruthy()
    expect(screen.getByRole('img', { name: /^Office share of hours per period/ })).toBeTruthy()
    expect(container.querySelectorAll('g[data-period]')).toHaveLength(3)
    // September stacks all four sides; August has two.
    const sides = (key: string) => [...(container.querySelector(`g[data-period="${key}"]`)?.querySelectorAll('[data-side]') ?? [])].map((n) => n.getAttribute('data-side'))
    expect(sides('2026-09-01')).toEqual(['field', 'office', 'bid', 'unassigned'])
    expect(sides('2026-08-01')).toEqual(['field', 'office'])
    expect(screen.getByText('Not on a job')).toBeTruthy()
    expect(screen.getByText('A faded bar is a period that is not over yet.')).toBeTruthy()
    // The first point and the last finished one carry their share; the third 25% is the axis tick.
    expect(screen.getAllByText('25%').length).toBe(3)
    expect(screen.queryByText('0%', { selector: 'text[font-weight]' })).toBeNull()
  })

  it('names a column for a screen reader', () => {
    renderWithProviders(<ManHoursChart periods={periods} zoom="month" />)
    expect(
      screen.getByRole('img', {
        name: 'September 2026: field 300 h, office 60 h, bids 40 h, not on a job 20 h, total 420 h, office share 25%',
      }),
    ).toBeTruthy()
    expect(screen.getByRole('img', { name: /^October 2026 so far: field 40 h/ })).toBeTruthy()
  })

  it('lets a click or Enter on a column pick its period, and marks the picked one', () => {
    const onSelect = vi.fn()
    renderWithProviders(<ManHoursChart periods={periods} zoom="month" selectedKey="2026-09-01" onSelect={onSelect} />)

    const sep = screen.getByRole('button', { name: /^September 2026: field 300 h/ })
    expect(sep.getAttribute('aria-pressed')).toBe('true')
    const aug = screen.getByRole('button', { name: /^August 2026: field 300 h/ })
    expect(aug.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(aug)
    fireEvent.keyDown(sep, { key: 'Enter' })
    expect(onSelect.mock.calls).toEqual([['2026-08-01'], ['2026-09-01']])
  })

  it('shows a column’s numbers on hover and on focus, and clears them on leave', () => {
    const { container } = renderWithProviders(<ManHoursChart periods={periods} zoom="month" />)
    const sep = container.querySelector('g[data-period="2026-09-01"]') as Element
    expect(screen.queryByRole('status')).toBeNull()

    fireEvent.mouseMove(sep)
    const tip = screen.getByRole('status')
    expect(within(tip).getByText('September 2026')).toBeTruthy()
    expect(tip.textContent).toContain('Field300 h')
    expect(tip.textContent).toContain('Not on a job20 h')
    expect(tip.textContent).toContain('Total420 h')
    expect(tip.textContent).toContain('Office share25%')
    expect(tip.textContent).toContain('Waiting for approval20 h')

    fireEvent.mouseLeave(tip.parentElement as Element)
    expect(screen.queryByRole('status')).toBeNull()

    fireEvent.focus(container.querySelector('g[data-period="2026-10-01"]') as Element)
    expect(screen.getByRole('status').textContent).toContain('October 2026 (so far)')
    // A period with no time off a job leaves that line out.
    expect(screen.getByRole('status').textContent).not.toContain('Not on a job')
  })
})
