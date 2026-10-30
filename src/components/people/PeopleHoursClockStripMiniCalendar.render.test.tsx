// @vitest-environment jsdom
/**
 * The Hours tab's eleven-day mini calendar in its two shapes (punch list #217, people-docs-15):
 * the counts under the days as they are; with `strip`, an amber ring on each day with a session
 * waiting, its hours under it, and the *N earlier ›* stub at the left edge that opens the queue.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { buildPeopleHoursClockStripMiniCalendarYmds, PeopleHoursClockStripMiniCalendar } from './PeopleHoursClockStripMiniCalendar'

beforeAll(installDomShims)
afterEach(() => cleanup())

const today = '2026-10-30'
const ymds = buildPeopleHoursClockStripMiniCalendarYmds(today)
const counts = { '2026-10-23': 1, '2026-10-27': 2, '2026-10-28': 1, '2026-10-29': 1 }
const hours = { '2026-10-23': 2, '2026-10-27': 3, '2026-10-28': 4, '2026-10-29': 3.5 }

function calendar(strip: { earlier: number | null; onOpen?: () => void } | null) {
  return (
    <PeopleHoursClockStripMiniCalendar
      miniCalendarYmds={ymds}
      todayDenver={today}
      selectedYmd={today}
      onSelectYmd={() => {}}
      pendingUnapprovedCountByWorkDate={counts}
      countsLoading={false}
      narrowViewport640={false}
      strip={strip ? { pendingHoursByWorkDate: hours, earlier: { count: strip.earlier, onOpen: strip.onOpen } } : null}
    />
  )
}

describe('PeopleHoursClockStripMiniCalendar · today and the strip', () => {
  it('as it is: eleven days with the unapproved counts under them, no ring and no stub', () => {
    renderWithProviders(calendar(null))
    expect(document.querySelector('[data-mini-calendar="today"]')).toBeTruthy()
    expect(screen.getAllByRole('button')).toHaveLength(11)
    expect(document.querySelectorAll('[data-pending-ring="1"]')).toHaveLength(0)
    expect(document.querySelector('[data-earlier-stub]')).toBeNull()
    expect(screen.getByRole('group', { name: 'Unapproved session counts per day for strip scope' }).textContent).toBe('00010002110')
    expect(screen.getByRole('button', { name: /Tuesday, October 27, 2026/ }).getAttribute('aria-label')).toBe('Select Tuesday, October 27, 2026. 2 unapproved sessions.')
  })

  it('with the strip: a ring and the hours on each pending day, and the stub opens the queue', () => {
    const onOpen = vi.fn()
    renderWithProviders(calendar({ earlier: 7, onOpen }))
    expect(document.querySelector('[data-mini-calendar="strip"]')).toBeTruthy()
    expect(document.querySelectorAll('[data-pending-ring="1"]')).toHaveLength(4)
    expect(screen.getByRole('group', { name: 'Hours waiting on approval per day for strip scope' }).textContent).toBe('2 h3 h4 h3.5 h')
    expect(screen.getByRole('button', { name: /Tuesday, October 27, 2026/ }).getAttribute('aria-label')).toBe('Select Tuesday, October 27, 2026. 3 h waiting on approval.')
    expect(screen.getByRole('button', { name: /Friday, October 30, 2026/ }).getAttribute('aria-label')).toBe('Select Friday, October 30, 2026. Nothing waiting on approval.')
    const stub = screen.getByRole('button', { name: '7 earlier ›' })
    fireEvent.click(stub)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('no stub at zero or while the all-weeks count is unknown', () => {
    renderWithProviders(calendar({ earlier: 0 }))
    expect(document.querySelector('[data-earlier-stub]')).toBeNull()
    cleanup()
    renderWithProviders(calendar({ earlier: null }))
    expect(document.querySelector('[data-earlier-stub]')).toBeNull()
    expect(document.querySelectorAll('[data-pending-ring="1"]')).toHaveLength(4)
  })
})
