// @vitest-environment jsdom
/**
 * Dispatch Mode's home takes the Dashboard's top row (punch list #392, the owner's yes of 2026-11-25). The
 * simulator's sitting of 2026-11-25, through View as the sample leader, opened his bar's Dashboard tab on a page
 * with a bare **Clock In** and no Tally, no Job Report and no Paint a map: the press the card says is always on the
 * Dashboard was not on the page his bar calls Dashboard. The row itself is the real one. The clock, the schedule
 * and the money are stood in for: their own smokes cover them.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const who = vi.hoisted(() => ({ role: 'master_technician' as string }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const mock = useAuthModuleMock({ role: 'master_technician' })
  const base = mock.useAuth
  return { ...mock, useAuth: () => ({ ...base(), role: who.role }), useOptionalAuth: () => ({ ...base(), role: who.role }) }
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))
vi.mock('../../lib/fetchJobsLedgerWithDetailsForStages', () => ({ fetchJobsLedgerWithDetailsForStages: async () => ({ ok: true, jobs: [] }) }))
vi.mock('../../hooks/useDashboardAssignedJobs', () => ({
  useDashboardAssignedJobs: () => ({ assignedJobs: [], assignedReadyToBillJobs: [], refreshDashboardAssignedJobLists: () => {} }),
}))
vi.mock('../../hooks/useDashboardSubSchedule', () => ({
  useDashboardSubSchedule: () => ({ subScheduleLoading: false, subScheduleLabels: {}, subSchedulePhones: {}, subScheduleJobMeta: {}, subScheduleDayPartition: null, leaveReportReminderForJobRow: () => null }),
}))
vi.mock('../../hooks/useFirstAssistantDispatchPhone', () => ({ useFirstAssistantDispatchPhone: () => null }))
vi.mock('../dashboard/DashboardMyScheduleSection', () => ({ DashboardMyScheduleSection: () => <div data-testid="my-schedule" /> }))
vi.mock('../ClockInOutButton', () => ({ default: ({ embedded }: { embedded?: boolean }) => <button type="button" data-embedded={String(Boolean(embedded))}>Clock In</button> }))
vi.mock('../DashboardFinancialsSection', () => ({ default: () => null }))
vi.mock('../AdditionalReportModal', () => ({ default: () => null }))

import { JobsListCacheProvider } from '../../contexts/JobsListCacheContext'
import DispatchModeHome from './DispatchModeHome'

afterEach(() => {
  cleanup()
  who.role = 'master_technician'
})

describe('DispatchModeHome, the Dashboard’s top row', () => {
  it('a leader’s first row reads Tally, Clock In, Job Report, Paint a map, above My schedule', async () => {
    // The app mounts this provider over every page (`App.tsx`); the row's Job Report window reads it.
    renderWithProviders(
      <JobsListCacheProvider>
        <DispatchModeHome />
      </JobsListCacheProvider>,
    )
    const row = await waitFor(() => {
      const el = document.querySelector('[data-dispatch-home-top-row]') as HTMLElement
      expect(el.querySelector('[data-paint-a-map-press]') ?? screen.queryByRole('button', { name: /Paint a map/ })).toBeTruthy()
      return el
    })
    const tally = row.querySelector('a[href^="/tally"]') as HTMLElement
    const clock = screen.getByRole('button', { name: 'Clock In' })
    const report = screen.getByRole('button', { name: /Job Report/i })
    const paint = screen.getByRole('button', { name: /Paint a map/ })
    for (const press of [tally, clock, report, paint]) expect(row.contains(press)).toBe(true)
    // In that order across the row.
    const after = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(after(tally, clock)).toBe(true)
    expect(after(clock, report)).toBe(true)
    expect(after(report, paint)).toBe(true)
    // The clock is the row's own middle, not a bare button over it.
    expect(clock.getAttribute('data-embedded')).toBe('true')
    // The row stands above the day.
    expect(after(row, screen.getByTestId('my-schedule'))).toBe(true)
    // No notice of the Dashboard is drawn here: they live in this mode's Inbox tab.
    expect(document.querySelector('[data-needs-you-card], [data-needs-you-door]')).toBeNull()
  })
})
