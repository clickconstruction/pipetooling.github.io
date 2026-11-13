// @vitest-environment jsdom
/**
 * Render smokes for the Quickfill "Complete, no Total Bill" station since v2.6750 (punch list #176,
 * decision 4: the hidden Jobs Billing station's three checks folded in): each row wears a chip for
 * what its bill lacks, the Jobs Billing tab is a door, Edit job opens the job form, and empty is the
 * good state in the station's own words.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { QuickfillCompleteNoBillSection } from './QuickfillCompleteNoBillSection'
import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import type { CompleteNoBillRow } from '../../lib/quickfillCompleteNoBill'
import type { JobWithDetails } from '../../types/jobWithDetails'

const openEditJob = vi.fn()
const runFetchJobs = vi.fn(async () => undefined)

vi.mock('../../contexts/JobsListCacheContext', () => ({
  useJobsListCache: () => ({ runFetchJobs }),
}))
vi.mock('../../contexts/JobFormModalContext', () => ({
  useJobFormModal: () => ({ openEditJob }),
}))
vi.mock('../../contexts/JobDetailModalContext', () => ({
  useJobDetailModal: () => ({ openJobDetail: vi.fn() }),
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u-1' }, role: 'assistant', profileName: 'Marisol' }),
}))
vi.mock('../../hooks/useJobThreadNotesForModal', () => ({
  useJobThreadNotesForModal: () => ({ activity: [], loading: false, canPost: false, draft: '', setDraft: vi.fn(), submitNote: vi.fn(), submitting: false }),
}))

const rows: CompleteNoBillRow<JobWithDetails>[] = [
  { job: makeJob({ id: 'j-1010', hcp_number: '1010', job_name: 'Lot 4 Kestrel', job_address: '12 Finch Ln', revenue: null }), gaps: ['total', 'work', 'charges'] },
  { job: makeJob({ id: 'j-1060', hcp_number: '1060', job_name: 'Carrow Camera', revenue: 2500 }), gaps: ['work'] },
]

afterEach(() => cleanup())

describe('QuickfillCompleteNoBillSection · the three checks on each row (v2.6750)', () => {
  it('draws a chip for each gap, the rows in the kernel’s order, and the Jobs Billing tab as a door', () => {
    renderWithProviders(<QuickfillCompleteNoBillSection rows={rows} clockSummaryByJobId={new Map()} jobsListBusy={false} />)
    const first = document.querySelector('[data-complete-no-bill-row="j-1010"]')!
    expect(first.textContent).toContain('1010 · Lot 4 Kestrel')
    expect([...first.querySelectorAll('[data-bill-gap]')].map((el) => el.textContent)).toEqual(['no Total Bill', 'no Specific Work', 'no Other job charges'])
    const second = document.querySelector('[data-complete-no-bill-row="j-1060"]')!
    expect([...second.querySelectorAll('[data-bill-gap]')].map((el) => el.textContent)).toEqual(['no Specific Work'])
    expect(document.querySelectorAll('[data-complete-no-bill-row]')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Jobs Billing tab' }).getAttribute('href')).toBe('/jobs?tab=billing')
  })

  it('Edit job opens the job form on that job, and waits while the jobs list is busy', () => {
    const { rerender } = renderWithProviders(<QuickfillCompleteNoBillSection rows={rows} clockSummaryByJobId={new Map()} jobsListBusy={false} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit job' })[1]!)
    expect(openEditJob).toHaveBeenCalledTimes(1)
    expect(openEditJob.mock.calls[0]![0]).toBe('j-1060')
    rerender(<QuickfillCompleteNoBillSection rows={rows} clockSummaryByJobId={new Map()} jobsListBusy={true} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit job' })[0]!)
    expect(openEditJob).toHaveBeenCalledTimes(1)
  })

  it('says in its own words when no finished job is missing a field, and says it is reading while the count is not in yet', () => {
    const { rerender } = renderWithProviders(<QuickfillCompleteNoBillSection rows={[]} clockSummaryByJobId={new Map()} jobsListBusy={true} loading={true} />)
    expect(document.querySelector('[data-complete-no-bill-reading]')?.textContent).toBe("Reading the finished jobs' bills…")
    expect(screen.queryByText('No complete job is missing its Total Bill or its Specific Work.')).toBeNull()
    rerender(<QuickfillCompleteNoBillSection rows={[]} clockSummaryByJobId={new Map()} jobsListBusy={false} loading={false} />)
    expect(screen.getByText('No complete job is missing its Total Bill or its Specific Work.')).toBeTruthy()
    expect(document.querySelectorAll('[data-complete-no-bill-row]')).toHaveLength(0)
  })
})
