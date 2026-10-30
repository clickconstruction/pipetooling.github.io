// @vitest-environment jsdom
/**
 * The Hours grid's pending banner in its two shapes (punch list #217, people-docs-15): the
 * sentence with its two presses as it is; with the strip on, the presses alone, the first with the
 * hours; under `?sbs=1` both, captioned.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import type { PeopleHoursPendingSummary } from '../../lib/peopleHoursPendingByCell'
import type { ShapeView } from '../prototypes/SideBySide'
import { PeopleHoursPendingBanner } from './PeopleHoursPendingBanner'

beforeAll(installDomShims)
afterEach(() => cleanup())

const summary: PeopleHoursPendingSummary = { totalSessions: 5, totalDiffHours: 12.5, peopleCount: 3, workDates: ['2026-10-23', '2026-10-27', '2026-10-28', '2026-10-29'], allSessionIds: ['a', 'b', 'c', 'd', 'e'] }

function view(on: boolean, sideBySide = false): ShapeView {
  return { on, setOn: () => {}, sideBySide }
}

function banner(strip: ShapeView | null, onOpenQueue = vi.fn(), onReviewApprove = vi.fn()) {
  return <PeopleHoursPendingBanner summary={summary} canAccessHours canAccessPay onReviewApprove={onReviewApprove} onOpenQueue={onOpenQueue} outsideWeekLine="+7 sessions in earlier weeks" strip={strip} />
}

describe('PeopleHoursPendingBanner · the sentence and the strip', () => {
  it('as it is: the sentence, the earlier-weeks link and the two presses', () => {
    const onOpenQueue = vi.fn()
    renderWithProviders(banner(view(false), onOpenQueue))
    const status = screen.getByRole('status')
    expect(status.getAttribute('data-pending-banner')).toBe('today')
    expect(status.textContent).toContain('Pending: 3 people · 12.50 h not yet in payroll across 4 days.')
    fireEvent.click(screen.getByRole('button', { name: '+7 sessions in earlier weeks' }))
    expect(onOpenQueue).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Review & approve' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'All weeks' })).toBeTruthy()
  })

  it('with the strip on: no sentence, the first press carries the hours, both presses work', () => {
    const onOpenQueue = vi.fn()
    const onReviewApprove = vi.fn()
    renderWithProviders(banner(view(true), onOpenQueue, onReviewApprove))
    const status = screen.getByRole('status')
    expect(status.getAttribute('data-pending-banner')).toBe('strip')
    expect(status.textContent).not.toContain('not yet in payroll')
    expect(screen.queryByRole('button', { name: '+7 sessions in earlier weeks' })).toBeNull()
    const review = screen.getByRole('button', { name: 'Review & approve · 12.5 h' })
    expect(review.getAttribute('title')).toBe('3 people · 12.50 h not yet in payroll across 4 days. Opens Review & approve for the week shown.')
    fireEvent.click(review)
    expect(onReviewApprove).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'All weeks' }))
    expect(onOpenQueue).toHaveBeenCalledTimes(1)
  })

  it('with no switch given the banner reads as it is, and with nothing pending it is not drawn', () => {
    renderWithProviders(<PeopleHoursPendingBanner summary={summary} canAccessHours canAccessPay onReviewApprove={() => {}} />)
    expect(screen.getByRole('status').getAttribute('data-pending-banner')).toBe('today')
    cleanup()
    renderWithProviders(<PeopleHoursPendingBanner summary={{ ...summary, totalSessions: 0 }} canAccessHours canAccessPay onReviewApprove={() => {}} strip={view(true)} />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('side by side: both shapes, captioned', () => {
    render(
      <MemoryRouter initialEntries={['/people?tab=hours&sbs=1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {banner(view(false, true))}
      </MemoryRouter>,
    )
    const sbs = screen.getByTestId('people-hours-pending-banner-sbs')
    expect(sbs.querySelector('[data-side-by-side-today] p')?.textContent).toBe('Today')
    expect(sbs.querySelector('[data-side-by-side-shape] p')?.textContent).toBe('With the strip')
    expect(sbs.querySelector('[data-side-by-side-today] [data-pending-banner="today"]')).toBeTruthy()
    expect(sbs.querySelector('[data-side-by-side-shape] [data-pending-banner="strip"]')).toBeTruthy()
  })
})
