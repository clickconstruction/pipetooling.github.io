// @vitest-environment jsdom
/**
 * Render-smoke tests for JobsBillingTab (extracted from Jobs.tsx in v2.821).
 * Guards against crash-on-mount / missed-prop regressions; not a behavior suite.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

// src/lib/supabase throws at import time without env vars (and is reached
// transitively via lib/jobs/jobAddressUrls) — always stub it in render smokes.
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import JobsBillingTab, { type JobsBillingTabProps } from './JobsBillingTab'
import { makeJob, makeTeamMember, renderWithProviders } from '../../test/renderSmokeMocks'

const AUTH_USER_ID = 'billing-user-1'

function makeProps(overrides: Partial<JobsBillingTabProps> = {}): JobsBillingTabProps {
  return {
    jobs: [],
    jobsListLoading: false,
    jobsListRefreshing: false,
    jobsListError: null,
    error: null,
    authUserId: AUTH_USER_ID,
    authRole: 'dev',
    shortNewJobButtonLabel: false,
    laborJobHcps: new Set<string>(),
    teamLaborJobIds: new Set<string>(),
    teamLaborLoading: false,
    openNew: vi.fn(),
    openEdit: vi.fn(),
        ...overrides,
  }
}

function twoJobs() {
  const alpha = makeJob({
    hcp_number: '2001',
    job_name: 'Alpha Remodel',
    job_address: '1 Alpha Way, Austin, TX',
    revenue: 1500,
    team_members: [makeTeamMember('u-1', 'Tech One')],
  })
  const beta = makeJob({
    hcp_number: '2002',
    job_name: 'Beta Repipe',
    job_address: '2 Beta Blvd, Austin, TX',
    revenue: 900,
    team_members: [],
  })
  return { alpha, beta }
}

describe('JobsBillingTab render smoke', () => {
  it('renders the empty state with no jobs', () => {
    renderWithProviders(<JobsBillingTab {...makeProps()} />)
    expect(screen.getByText('No HCP jobs yet. Click New Job to add one.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New job' })).toBeTruthy()
  })

  it('renders populated rows including both red-icon conditions', () => {
    const { alpha, beta } = twoJobs()
    // alpha: HCP not in laborJobHcps → red Add-Labor icon; not in teamLaborJobIds → red no-team-labor icon.
    // beta: both sets satisfied → no red icons on its row.
    renderWithProviders(
      <JobsBillingTab
        {...makeProps({
          jobs: [alpha, beta],
          laborJobHcps: new Set(['2002']),
          teamLaborJobIds: new Set([beta.id]),
        })}
      />,
    )
    expect(screen.getByText('Alpha Remodel')).toBeTruthy()
    expect(screen.getByText('Beta Repipe')).toBeTruthy()
    // The Add Labor fill button is gone (v2.1623) — labor gaps surface via the
    // Needs labor filter; only the team-labor icon remains on rows.
    expect(screen.queryByTitle('Add Labor: fill from Billing and open Labor')).toBeNull()
    // Red icon 2: missing Team Job Labor flag (only alpha qualifies)
    // v2.1627: one combined flag with a precise label per missing condition.
    expect(screen.getAllByTitle(/recorded for this job/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Tech One')).toBeTruthy()
  })

  it('hides both red icons for the primary role', () => {
    const { alpha } = twoJobs()
    renderWithProviders(<JobsBillingTab {...makeProps({ jobs: [alpha], authRole: 'primary' })} />)
    expect(screen.queryByTitle(/recorded for this job/)).toBeNull()
  })

  it('filters rows as the search box is typed into', () => {
    const { alpha, beta } = twoJobs()
    renderWithProviders(<JobsBillingTab {...makeProps({ jobs: [alpha, beta] })} />)
    const search = screen.getByPlaceholderText('Search jobs…')
    fireEvent.change(search, { target: { value: 'beta' } })
    expect(screen.queryByText('Alpha Remodel')).toBeNull()
    expect(screen.getByText('Beta Repipe')).toBeTruthy()
    fireEvent.change(search, { target: { value: '' } })
    expect(screen.getByText('Alpha Remodel')).toBeTruthy()
  })

  it('sort toggle flips row order and persists the per-user localStorage key', () => {
    const { alpha, beta } = twoJobs()
    renderWithProviders(<JobsBillingTab {...makeProps({ jobs: [alpha, beta] })} />)
    // Merged Job cell (v2.1620): identity + chip + name + address share the cell —
    // sort assertions read just the leading job number.
    const rowText = () =>
      Array.from(document.querySelectorAll('tbody tr td:first-child')).map((td) =>
        ((td.textContent ?? '').trim().match(/\d+/) ?? [''])[0],
      )
    // Default: highest HCP first (desc)
    expect(rowText()).toEqual(['2002', '2001'])
    fireEvent.click(screen.getByRole('button', { name: 'Sort descending' }))
    expect(rowText()).toEqual(['2001', '2002'])
    expect(localStorage.getItem(`jobs_billing_sort_asc_${AUTH_USER_ID}`)).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Sort ascending' }))
    expect(rowText()).toEqual(['2002', '2001'])
    expect(localStorage.getItem(`jobs_billing_sort_asc_${AUTH_USER_ID}`)).toBe('false')
  })
})
