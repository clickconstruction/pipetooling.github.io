// @vitest-environment jsdom
/**
 * Render-smoke tests for the extracted Assigned Jobs + Superintendent Jobs
 * sections (v2.1004 job-row-family extraction). Structural pins: the verbatim
 * lift renders the same rows, buttons, and compact-mobile meta as before.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import { DashboardAssignedJobsSection } from './DashboardAssignedJobsSection'
import { DashboardSuperintendentJobsSection } from './DashboardSuperintendentJobsSection'
import type { DashboardTeamAssignedJobRow } from '../../lib/dashboardTeamAssignedJobRow'
import { renderWithProviders } from '../../test/renderSmokeMocks'

function makeRow(p: Partial<DashboardTeamAssignedJobRow> = {}): DashboardTeamAssignedJobRow {
  return {
    id: 'job-1',
    hcp_number: '928',
    job_name: 'Willow Brook Apartments',
    job_address: '412 E William Cannon Dr Austin, TX 78745',
    google_drive_link: null,
    job_plans_link: null,
    revenue: null,
    created_at: '2026-07-01T12:00:00Z',
    status: 'working',
    ...p,
  }
}

const noop = () => {}

// The section's DashboardGroupCard is defaultCollapsed; expand it for render smokes.
beforeEach(() => {
  localStorage.setItem('dash-assigned-jobs-collapsed', 'false')
})

function assignedProps(over: Partial<Parameters<typeof DashboardAssignedJobsSection>[0]> = {}) {
  const rows = [makeRow()]
  return {
    role: 'subcontractor' as const,
    isMobile: true,
    assignedJobs: rows,
    assignedJobsLoading: false,
    assignedJobsSearch: '',
    setAssignedJobsSearch: noop,
    filteredAssignedJobs: rows,
    openJobDetailFromDashboardJobRow: noop,
    setViewReportsJob: noop,
    setSubcontractorJobActivityModalJob: noop,
    leaveReportReminderForJobRow: () => false,
    setLeaveReportJob: noop,
    setReadyForBillingJob: noop,
    setReadyForBillingChecked1: noop,
    setReadyForBillingChecked2: noop,
    jobStatusUpdatingId: null,
    formatDatetime: (iso: string) => iso,
    ...over,
  }
}

describe('DashboardAssignedJobsSection (extracted)', () => {
  it('renders the section title, row, and both action buttons (sub, mobile)', () => {
    renderWithProviders(<DashboardAssignedJobsSection {...assignedProps()} />)
    expect(screen.getByText(/Assigned Jobs \(1\)/)).toBeTruthy()
    expect(screen.getByText(/Willow Brook Apartments/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Send to Billing/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Leave Report/ })).toBeTruthy()
    // v2.997 compact meta line: two-unit age, no "Last Activity" prefix
    expect(screen.getByText(/Open \d/)).toBeTruthy()
  })

  it('helpers see Leave Report but never Send to Billing', () => {
    renderWithProviders(<DashboardAssignedJobsSection {...assignedProps({ role: 'helpers' })} />)
    expect(screen.queryByRole('button', { name: /Send to Billing/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Leave Report/ })).toBeTruthy()
  })

  it('shows the search-empty note when a search hides every row', () => {
    renderWithProviders(
      <DashboardAssignedJobsSection
        {...assignedProps({ assignedJobsSearch: 'zzz', filteredAssignedJobs: [] })}
      />,
    )
    expect(screen.getByText(/No assigned jobs match/i)).toBeTruthy()
  })
})

describe('DashboardSuperintendentJobsSection (extracted)', () => {
  it('renders rows not already in Assigned Jobs, with View Reports', () => {
    renderWithProviders(
      <DashboardSuperintendentJobsSection
        role="superintendent"
        superintendentJobs={[makeRow({ id: 'sup-1', hcp_number: '857', job_name: 'TJ Brace' })]}
        superintendentJobsLoading={false}
        superintendentJobsExpanded
        setSuperintendentJobsExpanded={noop}
        assignedJobs={[]}
        openJobDetailFromDashboardJobRow={noop}
        setViewReportsJob={noop}
        isMobile={false}
        setReadyForBillingJob={noop}
        setReadyForBillingChecked1={noop}
        setReadyForBillingChecked2={noop}
        jobStatusUpdatingId={null}
      />,
    )
    expect(screen.getByText(/Superintendent Jobs \(1\)/)).toBeTruthy()
    expect(screen.getByText(/857 · TJ Brace/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /View Reports/i })).toBeTruthy()
  })

  it('renders nothing for non-superintendents', () => {
    const { container } = renderWithProviders(
      <DashboardSuperintendentJobsSection
        role="dev"
        superintendentJobs={[makeRow()]}
        superintendentJobsLoading={false}
        superintendentJobsExpanded
        setSuperintendentJobsExpanded={noop}
        assignedJobs={[]}
        openJobDetailFromDashboardJobRow={noop}
        setViewReportsJob={noop}
        isMobile={false}
        setReadyForBillingJob={noop}
        setReadyForBillingChecked1={noop}
        setReadyForBillingChecked2={noop}
        jobStatusUpdatingId={null}
      />,
    )
    expect(container.textContent?.trim()).toBe('')
  })
})
