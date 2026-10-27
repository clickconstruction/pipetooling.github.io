// @vitest-environment jsdom
/**
 * Render smoke for Dispatch Mode → Home's Job Pipeline (v2.5962): a lost signal reads the offline
 * sentence with Retry and Retry reads the pipeline again; a refused read shows its sentence with no
 * Retry. The schedule, the clock and the money above it are stubbed: their own smokes cover them.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { OFFLINE_ERROR_MESSAGE } from '../../lib/networkErrorMessage'

const H = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'subcontractor' })
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))
vi.mock('../../lib/fetchJobsLedgerWithDetailsForStages', () => ({
  fetchJobsLedgerWithDetailsForStages: (...a: unknown[]) => H.fetch(...a),
}))
vi.mock('../../hooks/useDashboardAssignedJobs', () => ({
  useDashboardAssignedJobs: () => ({ assignedJobs: [], assignedReadyToBillJobs: [], refreshDashboardAssignedJobLists: () => {} }),
}))
vi.mock('../../hooks/useDashboardSubSchedule', () => ({
  useDashboardSubSchedule: () => ({
    subScheduleLoading: false,
    subScheduleLabels: {},
    subSchedulePhones: {},
    subScheduleJobMeta: {},
    subScheduleDayPartition: null,
    leaveReportReminderForJobRow: () => null,
  }),
}))
vi.mock('../../hooks/useFirstAssistantDispatchPhone', () => ({ useFirstAssistantDispatchPhone: () => null }))
vi.mock('../dashboard/DashboardMyScheduleSection', () => ({ DashboardMyScheduleSection: () => null }))
vi.mock('../ClockInOutButton', () => ({ default: () => null }))
vi.mock('../DashboardFinancialsSection', () => ({ default: () => null }))
vi.mock('../AdditionalReportModal', () => ({ default: () => null }))

import DispatchModeHome from './DispatchModeHome'

describe('DispatchModeHome → Job Pipeline', () => {
  it('a lost signal reads the offline sentence with Retry, and Retry reads the pipeline again', async () => {
    H.fetch.mockReset()
    H.fetch.mockResolvedValueOnce({ ok: false, error: OFFLINE_ERROR_MESSAGE, errorKind: 'network' })
    H.fetch.mockResolvedValue({ ok: true, jobs: [] })
    renderWithProviders(<DispatchModeHome />)
    await screen.findByText(OFFLINE_ERROR_MESSAGE)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(document.querySelector('[data-empty-state]')?.textContent ?? '').toContain('No open jobs.'))
    expect(H.fetch).toHaveBeenCalledTimes(2)
  })

  it('a refused read shows its sentence with no Retry', async () => {
    H.fetch.mockReset()
    H.fetch.mockResolvedValue({ ok: false, error: "You don't have access to this job pipeline.", errorKind: 'server' })
    renderWithProviders(<DispatchModeHome />)
    await screen.findByText("You don't have access to this job pipeline.")
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })
})
