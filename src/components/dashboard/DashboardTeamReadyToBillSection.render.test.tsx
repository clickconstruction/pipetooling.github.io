// @vitest-environment jsdom
/**
 * Render-smoke tests for the Dashboard team "Ready to Bill (N)" section.
 *
 * The contract under test (v2.846): job cards in this section never show a
 * `Job: <status>` line — every row comes from
 * `list_ready_to_bill_assigned_jobs_for_dashboard`, so the status only
 * repeated the section heading. Subcontractor-like rows keep their other
 * lines (address, Open age, activity block).
 */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import {
  DashboardTeamReadyToBillSection,
  type DashboardTeamReadyToBillSectionProps,
} from './DashboardTeamReadyToBillSection'
import type { DashboardTeamAssignedJobRow } from '../../lib/dashboardTeamAssignedJobRow'
import { renderWithProviders } from '../../test/renderSmokeMocks'

function makeRow(p: Partial<DashboardTeamAssignedJobRow> = {}): DashboardTeamAssignedJobRow {
  return {
    id: 'job-1',
    hcp_number: '846',
    job_name: 'David and Diana Uhl',
    job_address: '26138 Park Bend Dr New Braunfels, TX 78132',
    google_drive_link: null,
    job_plans_link: null,
    revenue: null,
    created_at: '2026-07-01T12:00:00Z',
    status: 'ready_to_bill',
    ...p,
  }
}

function makeProps(
  overrides: Partial<DashboardTeamReadyToBillSectionProps> = {},
): DashboardTeamReadyToBillSectionProps {
  return {
    role: 'subcontractor',
    isMobile: false,
    narrowViewport660: false,
    assignedReadyToBillJobs: [makeRow()],
    assignedReadyToBillLoading: false,
    refreshAssignedReadyToBill: vi.fn(),
    leaveReportReminderForJobRow: vi.fn(() => false),
    openJobDetailFromDashboardJobRow: vi.fn(),
    setViewReportsJob: vi.fn(),
    setLeaveReportJob: vi.fn(),
    setSubcontractorJobActivityModalJob: vi.fn(),
    ...overrides,
  }
}

describe('DashboardTeamReadyToBillSection', () => {
  it('renders the job card for a subcontractor without a "Job: <status>" line', () => {
    renderWithProviders(<DashboardTeamReadyToBillSection {...makeProps()} />)

    expect(screen.getByText('Ready to Bill (1)')).toBeTruthy()
    expect(screen.getByText('846 · David and Diana Uhl')).toBeTruthy()
    expect(screen.getByText('26138 Park Bend Dr New Braunfels, TX 78132')).toBeTruthy()
    expect(screen.queryByText(/^Job:/)).toBeNull()
  })

  it('renders nothing for roles outside the team Ready to Bill set', () => {
    renderWithProviders(<DashboardTeamReadyToBillSection {...makeProps({ role: 'dev' })} />)

    expect(screen.queryByText(/Ready to Bill/)).toBeNull()
  })
})
