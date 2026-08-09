// @vitest-environment jsdom
/**
 * Render tests for the Pipeline "Hide groups…" modal (v2.1476): the three
 * dimension sections render their values with counts, clicking a row reports
 * the toggled filters through onChange, and "Show everything" resets.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import JobsStagesHideGroupsModal from './JobsStagesHideGroupsModal'
import { EMPTY_STAGES_EXCLUDE_FILTERS, STAGES_EXCLUDE_NONE } from '../../lib/jobsStagesExcludeFilters'
import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import type { JobWithDetails } from '../../types/jobWithDetails'

const JOBS: JobWithDetails[] = [
  makeJob({
    development: { id: 'dev-1', name: 'Gun Dog' },
    account_manager_user_id: 'u-trace',
    account_manager: { id: 'u-trace', name: 'Trace' },
    account_manager_relationship: 'only',
  } as Partial<JobWithDetails>),
  makeJob({ gcCustomer: { id: 'gc-1', name: 'Heron Construction Group' } } as Partial<JobWithDetails>),
]

describe('JobsStagesHideGroupsModal', () => {
  it('renders nothing when closed', () => {
    renderWithProviders(
      <JobsStagesHideGroupsModal open={false} onClose={vi.fn()} jobs={JOBS} filters={EMPTY_STAGES_EXCLUDE_FILTERS} onChange={vi.fn()} />,
    )
    expect(screen.queryByText('Hide groups from the board')).toBeNull()
  })

  it('lists values with counts and toggles through onChange', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <JobsStagesHideGroupsModal open onClose={vi.fn()} jobs={JOBS} filters={EMPTY_STAGES_EXCLUDE_FILTERS} onChange={onChange} />,
    )
    expect(screen.getByText('Hide groups from the board')).toBeTruthy()
    expect(screen.getByText('Gun Dog')).toBeTruthy()
    expect(screen.getByText('Heron Construction Group')).toBeTruthy()
    expect(screen.getByText('Trace')).toBeTruthy()
    fireEvent.click(screen.getByText('Gun Dog'))
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_STAGES_EXCLUDE_FILTERS, development: ['dev-1'] })
  })

  it('marks hidden rows and resets via Show everything', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <JobsStagesHideGroupsModal
        open
        onClose={vi.fn()}
        jobs={JOBS}
        filters={{ gc: [], development: ['dev-1'], accountMan: [STAGES_EXCLUDE_NONE] }}
        onChange={onChange}
      />,
    )
    const hiddenBadges = screen.getAllByText('Hidden')
    expect(hiddenBadges).toHaveLength(2)
    fireEvent.click(screen.getByText('Show everything'))
    expect(onChange).toHaveBeenCalledWith(EMPTY_STAGES_EXCLUDE_FILTERS)
  })
})
