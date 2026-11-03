// @vitest-environment jsdom
/**
 * Render smoke for one day on a job (punch list #242, PR 1): the hours and the money first,
 * then who clocked, the subs, what was bought and the report; the same rows as a hover card
 * and as a window whose Close press closes it.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { DayDetailsBody, DayDetailsModal, DayHoverCard } from './DayDetailsModal'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { JobChargeEvent, JobValueEvent } from '../../lib/jobChargesTimeline'

const events: JobChargeEvent[] = [
  { source: 'team_labor', dateKey: '2026-10-22', amount: 360, label: 'Ana · 8 h', who: 'Ana', hours: 8 },
  { source: 'team_labor', dateKey: '2026-10-22', amount: 180, label: 'Luis · 4 h', who: 'Luis', hours: 4 },
  { source: 'sub_labor', dateKey: '2026-10-22', amount: 500, label: 'Sub Co', who: 'Sub Co' },
  { source: 'supply_house', dateKey: '2026-10-22', amount: 120, label: 'Ferguson · copper' },
  { source: 'team_labor', dateKey: '2026-10-23', amount: 360, label: 'Ana · 8 h', who: 'Ana', hours: 8 },
]
const valueEvents: JobValueEvent[] = [{ dateKey: '2026-10-22', percent: 40, label: 'Field report', kind: 'report' }]

describe('DayDetailsBody', () => {
  it('reads the day\'s hours and money first, then who, the subs, what was bought and the report', () => {
    renderWithProviders(<DayDetailsBody ymd="2026-10-22" events={events} valueEvents={valueEvents} />)
    expect(screen.getByText('12 h · $1,160')).toBeTruthy()
    expect(screen.getByText('Ana')).toBeTruthy()
    expect(screen.getByText('Luis')).toBeTruthy()
    expect(screen.getByText('Sub Co')).toBeTruthy()
    expect(screen.getByText('Ferguson · copper')).toBeTruthy()
    expect(screen.getByText('40% done')).toBeTruthy()
  })

  it('says so on a day with nobody, nothing bought and no report', () => {
    renderWithProviders(<DayDetailsBody ymd="2026-10-25" events={events} valueEvents={valueEvents} />)
    expect(screen.getByText('Nobody clocked on this job that day.')).toBeTruthy()
    expect(screen.getByText('Nothing bought or charged that day.')).toBeTruthy()
    expect(screen.getByText('No field report that day.')).toBeTruthy()
  })
})

describe('DayDetailsBody for a viewer whose read carries no wages', () => {
  it('reads each person\'s hours and the report, with no dollar and no subs or purchases', () => {
    renderWithProviders(<DayDetailsBody ymd="2026-10-22" events={events} valueEvents={valueEvents} hoursOnly />)
    const day = screen.getByTestId('day-details')
    expect(screen.getByText('12 h')).toBeTruthy()
    expect(day.textContent).toContain('Ana')
    expect(day.textContent).toContain('8 h')
    expect(day.textContent).toContain('40% done')
    expect(day.textContent).not.toContain('$')
    expect(day.textContent).not.toContain('Sub Co')
    expect(day.textContent).not.toContain('Bought that day')
  })
})

describe('DayHoverCard and DayDetailsModal', () => {
  it('pins the card near the pointer with the day and the job', () => {
    renderWithProviders(<DayHoverCard jobLabel="J1044 · Lodge" ymd="2026-10-22" x={100} y={80} events={events} valueEvents={valueEvents} />)
    const card = screen.getByTestId('day-hover')
    expect(card.textContent).toContain('Thu, Oct 22')
    expect(card.textContent).toContain('J1044 · Lodge')
    expect(card.style.pointerEvents).toBe('none')
  })

  it('opens the day as a window and closes on Close', () => {
    const onClose = vi.fn()
    renderWithProviders(<DayDetailsModal jobLabel="J1044 · Lodge" ymd="2026-10-23" events={events} valueEvents={valueEvents} onClose={onClose} />)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Fri, Oct 23 · J1044 · Lodge')).toBeTruthy()
    expect(screen.getByText('8 h · $360')).toBeTruthy()
    // The shell's own × and the foot's Close both close it; the foot's is the one under a long day on a phone.
    const closes = screen.getAllByRole('button', { name: 'Close' })
    expect(closes).toHaveLength(2)
    fireEvent.click(closes[closes.length - 1]!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
